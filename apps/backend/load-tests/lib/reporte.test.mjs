import assert from 'node:assert/strict';
import { test } from 'node:test';

import { analizar, csv, generarReportes, html, markdown, PETICIONES } from './reporte.mjs';

const UMBRALES = { umbralP95: 1000, umbralCotizacion: 400, umbralErrores: 1 };

function tendencia(p95, extra = {}) {
  return { values: { avg: p95 / 2, min: 1, med: p95 / 2, 'p(90)': p95 - 1, 'p(95)': p95, 'p(99)': p95 + 1, max: p95 + 2, ...extra } };
}

function resumen(peticiones, { duracionMs = 60000, cotizaciones = 0, perdidas = 0, erroresTotal = 0 } = {}) {
  const metrics = {
    'http_req_duration{fase:prueba}': tendencia(300),
    errores: { values: { rate: erroresTotal } },
    cotizaciones: { values: { count: cotizaciones } },
    dropped_iterations: { values: { count: perdidas } },
    vus_max: { values: { max: 10 } },
  };
  for (const [nombre, { p95, cantidad = 10, errores = 0 }] of Object.entries(peticiones)) {
    metrics[`http_req_duration{name:${nombre}}`] = tendencia(p95);
    metrics[`http_reqs{name:${nombre}}`] = { values: { count: cantidad } };
    metrics[`errores{name:${nombre}}`] = { values: { rate: errores } };
  }
  return { state: { testRunDurationMs: duracionMs }, metrics };
}

test('cada cotización se mide contra ASR-01 y el resto contra el umbral general', () => {
  const analisis = analizar(
    resumen({ 'Cotizar como socio': { p95: 450 }, 'Cotizar desde el móvil': { p95: 350 }, 'Listar socios': { p95: 450 } }),
    UMBRALES,
  );
  assert.deepEqual(
    analisis.filas.map((f) => [f.peticion, f.objetivo, f.cumple]),
    [
      ['Cotizar desde el móvil', 400, true],
      ['Listar socios', 1000, true],
      ['Cotizar como socio', 400, false],
      ['Total', null, true],
    ],
  );
  assert.equal(analisis.p95Cotizaciones, 450);
  assert.equal(analisis.cumple, false);
});

test('las filas siguen el orden de PETICIONES y omiten las que no corrieron', () => {
  const nombres = PETICIONES.map((p) => p.nombre);
  const analisis = analizar(resumen({ [nombres[5]]: { p95: 10 }, [nombres[1]]: { p95: 10 }, [nombres[3]]: { p95: 10, cantidad: 0 } }), UMBRALES);
  assert.deepEqual(
    analisis.filas.map((f) => f.peticion),
    [nombres[1], nombres[5], 'Total'],
  );
});

test('una petición rápida con errores no cumple', () => {
  const analisis = analizar(resumen({ 'Listar socios': { p95: 10, errores: 0.02 } }, { erroresTotal: 0.02 }), UMBRALES);
  assert.equal(analisis.filas[0].pctErrores, 2);
  assert.equal(analisis.filas[0].cumple, false);
  assert.equal(analisis.filas.at(-1).cumple, false);
});

test('reporta cotizaciones por minuto y no cumple si k6 no sostuvo la tasa', () => {
  const datos = resumen({ 'Cotizar como socio': { p95: 100 } }, { duracionMs: 30000, cotizaciones: 250, perdidas: 3 });
  const analisis = analizar(datos, UMBRALES);
  assert.equal(analisis.cotizacionesPorMinuto, 500);
  assert.equal(analisis.iteracionesPerdidas, 3);
  assert.equal(analisis.cumple, false);
  assert.equal(analizar(resumen({ 'Cotizar como socio': { p95: 100 } }), UMBRALES).cumple, true);
});

test('las salidas incluyen cada petición, el total y escapan el HTML', () => {
  const analisis = analizar(resumen({ 'Listar socios': { p95: 100 } }), UMBRALES);
  analisis.perfil = '<carga>';
  assert.match(csv(analisis), /^canal,peticion,peticiones/);
  assert.match(csv(analisis), /"Portal web","Listar socios",10,0\.00/);
  assert.match(markdown(analisis), /\|\s+\| \*\*Total\*\* \|/);
  const pagina = html(analisis);
  assert.match(pagina, /Perfil &lt;carga&gt;/);
  assert.match(pagina, /integrity="sha384-/);
  assert.match(pagina, /href="dashboard.html"/);
});

test('generarReportes escribe los archivos en la carpeta indicada', () => {
  const archivos = generarReportes(resumen({ 'Listar socios': { p95: 100 } }), { ...UMBRALES, carpeta: 'resultados/x/' });
  assert.deepEqual(Object.keys(archivos).sort(), [
    'resultados/x/reporte.html',
    'resultados/x/resumen.csv',
    'resultados/x/resumen.json',
    'resultados/x/resumen.md',
    'stdout',
  ]);
  assert.equal(JSON.parse(archivos['resultados/x/resumen.json']).cumple, true);
});
