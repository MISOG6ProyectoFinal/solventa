#!/usr/bin/env node
// Reporte de la prueba de carga a partir de los JSON de Newman de load-tests/run.sh.
//   node load-tests/report.mjs <carpeta> [--umbral-p95 1000] [--umbral-cotizacion 400] [--umbral-errores 1] [--usuarios 5]
// Genera en la carpeta: reporte.html (gráficas), resumen.md, resumen.csv y resumen.json.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHART_JS = {
  src: 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  integrity: 'sha384-bs/nf9FbdNouRbMiFcrcZfLXYPKiPaGVGplVbv7dLGECccEXDW+S3zjqSKR5ZEaD',
};
const TOTAL = 'Total';
const COTIZACION = /^Cotizar/;

export function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(rank, 1)) - 1];
}

export function muestras(corrida, usuario) {
  const inicio = corrida.run.timings.started;
  return corrida.run.executions.map((ejecucion) => {
    const respuesta = ejecucion.response;
    const fecha = respuesta?.header?.find((h) => h.key.toLowerCase() === 'date');
    const instante = fecha ? Date.parse(fecha.value) : Number.NaN;
    const codigo = respuesta?.code ?? 0;
    const asercionFallida = (ejecucion.assertions ?? []).some((a) => a.error);
    return {
      usuario,
      peticion: ejecucion.item.name,
      codigo,
      ms: respuesta?.responseTime ?? 0,
      bytes: respuesta?.responseSize ?? 0,
      segundo: Math.floor((Number.isNaN(instante) ? inicio : instante) / 1000),
      error: !respuesta || codigo < 200 || codigo >= 300 || asercionFallida || Boolean(ejecucion.requestError),
    };
  });
}

export function estadisticas(lista) {
  const tiempos = lista.map((m) => m.ms).sort((a, b) => a - b);
  const errores = lista.filter((m) => m.error).length;
  const suma = tiempos.reduce((acc, t) => acc + t, 0);
  return {
    peticiones: lista.length,
    errores,
    pctErrores: lista.length ? (100 * errores) / lista.length : 0,
    promedio: lista.length ? suma / lista.length : 0,
    min: tiempos[0] ?? 0,
    p50: percentile(tiempos, 50),
    p90: percentile(tiempos, 90),
    p95: percentile(tiempos, 95),
    p99: percentile(tiempos, 99),
    max: tiempos.at(-1) ?? 0,
  };
}

export function porPeticion(lista) {
  const grupos = new Map();
  for (const muestra of lista) {
    if (!grupos.has(muestra.peticion)) grupos.set(muestra.peticion, []);
    grupos.get(muestra.peticion).push(muestra);
  }
  const filas = [...grupos].map(([peticion, grupo]) => ({ peticion, ...estadisticas(grupo) }));
  filas.push({ peticion: TOTAL, ...estadisticas(lista) });
  return filas;
}

export function lineaDeTiempo(lista) {
  if (lista.length === 0) return [];
  const segundos = lista.map((m) => m.segundo);
  const primero = Math.min(...segundos);
  const ultimo = Math.max(...segundos);
  const cubetas = Array.from({ length: ultimo - primero + 1 }, () => []);
  for (const muestra of lista) cubetas[muestra.segundo - primero].push(muestra);
  return cubetas.map((cubeta, i) => {
    const tiempos = cubeta.map((m) => m.ms).sort((a, b) => a - b);
    return {
      segundo: i,
      peticiones: cubeta.length,
      errores: cubeta.filter((m) => m.error).length,
      promedio: cubeta.length ? tiempos.reduce((a, t) => a + t, 0) / cubeta.length : 0,
      p95: percentile(tiempos, 95),
    };
  });
}

export function histograma(lista, cubetas = 20) {
  if (lista.length === 0) return [];
  const tiempos = lista.map((m) => m.ms).sort((a, b) => a - b);
  const tope = Math.max(percentile(tiempos, 99), 1);
  const ancho = Math.max(Math.ceil(tope / cubetas / 10) * 10, 10);
  const conteos = Array.from({ length: cubetas + 1 }, () => 0);
  for (const t of tiempos) conteos[Math.min(Math.floor(t / ancho), cubetas)] += 1;
  return conteos.map((cantidad, i) => ({
    desde: i * ancho,
    etiqueta: i === cubetas ? `>= ${i * ancho} ms` : `${i * ancho}-${(i + 1) * ancho} ms`,
    cantidad,
  }));
}

export function analizar(corridas, { umbralP95, umbralErrores, umbralCotizacion = umbralP95, usuarios }) {
  const lista = corridas.flatMap(({ corrida, usuario }) => muestras(corrida, usuario));
  const inicio = Math.min(...corridas.map(({ corrida }) => corrida.run.timings.started));
  const fin = Math.max(...corridas.map(({ corrida }) => corrida.run.timings.completed));
  const duracionS = Math.max((fin - inicio) / 1000, 0.001);
  const filas = porPeticion(lista).map((fila) => {
    if (fila.peticion === TOTAL) return { ...fila, objetivo: null, cumple: fila.pctErrores <= umbralErrores };
    const objetivo = COTIZACION.test(fila.peticion) ? umbralCotizacion : umbralP95;
    return { ...fila, objetivo, cumple: fila.p95 <= objetivo && fila.pctErrores <= umbralErrores };
  });
  const total = filas.at(-1);
  const cotizaciones = estadisticas(lista.filter((m) => COTIZACION.test(m.peticion)));
  return {
    inicio: new Date(inicio).toISOString(),
    duracionS,
    usuarios: usuarios ?? corridas.length,
    rendimiento: total.peticiones / duracionS,
    cotizacionesPorMinuto: (cotizaciones.peticiones / duracionS) * 60,
    p95Cotizaciones: cotizaciones.p95,
    umbralP95,
    umbralCotizacion,
    umbralErrores,
    cumple: filas.every((fila) => fila.cumple),
    filas,
    linea: lineaDeTiempo(lista),
    histograma: histograma(lista),
  };
}

const ms = (valor) => Math.round(valor).toString();
const pct = (valor) => valor.toFixed(2);

export function csv(analisis) {
  const encabezado =
    'peticion,peticiones,errores,pct_errores,promedio_ms,min_ms,p50_ms,p90_ms,p95_ms,p99_ms,max_ms,objetivo_p95_ms,cumple';
  const filas = analisis.filas.map((f) =>
    [
      `"${f.peticion}"`,
      f.peticiones,
      f.errores,
      pct(f.pctErrores),
      ms(f.promedio),
      f.min,
      f.p50,
      f.p90,
      f.p95,
      f.p99,
      f.max,
      f.objetivo ?? '',
      f.cumple ? 'si' : 'no',
    ].join(','),
  );
  return [encabezado, ...filas].join('\n') + '\n';
}

export function markdown(analisis) {
  const veredicto = analisis.cumple ? 'Cumple' : 'No cumple';
  const lineas = [
    '# Prueba de carga de Canales',
    '',
    `- **Inicio:** ${analisis.inicio}`,
    `- **Usuarios en paralelo:** ${analisis.usuarios}`,
    `- **Duración:** ${analisis.duracionS.toFixed(1)} s`,
    `- **Rendimiento:** ${analisis.rendimiento.toFixed(2)} peticiones/s`,
    `- **Cotizaciones:** ${Math.round(analisis.cotizacionesPorMinuto)} por minuto con p95 de ${analisis.p95Cotizaciones} ms`,
    `- **Resultado:** ${veredicto}`,
    '',
    '| Petición | Peticiones | Errores (%) | Promedio | p50 | p90 | p95 | p99 | Máx | Objetivo p95 | Cumple |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|',
    ...analisis.filas.map(
      (f) =>
        `| ${f.peticion === TOTAL ? `**${TOTAL}**` : f.peticion} | ${f.peticiones} | ${pct(f.pctErrores)} | ${ms(f.promedio)} | ${f.p50} | ${f.p90} | ${f.p95} | ${f.p99} | ${f.max} | ${f.objetivo ?? '-'} | ${f.cumple ? 'Sí' : 'No'} |`,
    ),
    '',
    `Tiempos en milisegundos. Las cotizaciones se miden contra ${analisis.umbralCotizacion} ms (ASR-01) y el resto contra ${analisis.umbralP95} ms. Cada fila y el total cumplen además si los errores no superan ${analisis.umbralErrores} %.`,
  ];
  return lineas.join('\n') + '\n';
}

const escapar = (texto) =>
  String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function html(analisis) {
  const peticiones = analisis.filas.filter((f) => f.peticion !== TOTAL);
  const total = analisis.filas.at(-1);
  const datos = JSON.stringify({
    peticiones: peticiones.map((f) => ({ nombre: f.peticion, p50: f.p50, p95: f.p95, p99: f.p99, errores: f.pctErrores })),
    linea: analisis.linea,
    histograma: analisis.histograma,
    umbralP95: analisis.umbralP95,
  }).replace(/</g, '\\u003c');
  const tabla = analisis.filas
    .map(
      (f) =>
        `<tr${f.peticion === TOTAL ? ' class="total"' : ''}><td>${escapar(f.peticion)}</td><td>${f.peticiones}</td><td>${pct(f.pctErrores)}</td><td>${ms(f.promedio)}</td><td>${f.p50}</td><td>${f.p90}</td><td>${f.p95}</td><td>${f.p99}</td><td>${f.max}</td><td>${f.objetivo ?? '-'}</td><td class="${f.cumple ? 'ok' : 'mal'}">${f.cumple ? 'Sí' : 'No'}</td></tr>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prueba de carga Canales</title>
<style>
:root { --fondo: #f7f7f5; --panel: #fff; --texto: #1f2328; --suave: #59636e; --borde: #d8dee4; --ok: #1a7f37; --mal: #cf222e;
  --s1: #2563eb; --s2: #d97706; --s3: #7c3aed; --s4: #dc2626; }
@media (prefers-color-scheme: dark) { :root { --fondo: #0d1117; --panel: #161b22; --texto: #e6edf3; --suave: #9198a1; --borde: #30363d;
  --ok: #3fb950; --mal: #f85149; --s1: #60a5fa; --s2: #fbbf24; --s3: #a78bfa; --s4: #f87171; } }
* { box-sizing: border-box; }
body { margin: 0; padding: 24px 16px; background: var(--fondo); color: var(--texto); font: 15px/1.5 system-ui, sans-serif; }
main { max-width: 1100px; margin: 0 auto; }
h1 { font-size: 1.5rem; margin: 0 0 4px; }
.sub { color: var(--suave); margin: 0 0 20px; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
.kpi, .panel { background: var(--panel); border: 1px solid var(--borde); border-radius: 10px; padding: 14px 16px; }
.kpi span { display: block; color: var(--suave); font-size: .8rem; }
.kpi strong { font-size: 1.4rem; font-variant-numeric: tabular-nums; }
.ok { color: var(--ok); } .mal { color: var(--mal); }
.graficas { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 480px), 1fr)); gap: 16px; margin-bottom: 20px; }
.panel h2 { font-size: 1rem; margin: 0 0 10px; }
.lienzo { position: relative; height: 280px; }
.tabla { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
th, td { padding: 6px 10px; border-bottom: 1px solid var(--borde); text-align: right; white-space: nowrap; }
th:first-child, td:first-child { text-align: left; }
th { color: var(--suave); font-weight: 600; font-size: .85rem; }
tr.total td { font-weight: 700; }
</style>
</head>
<body>
<main>
<h1>Prueba de carga de Canales</h1>
<p class="sub">${escapar(analisis.inicio)} · ${analisis.usuarios} usuarios en paralelo · ${analisis.duracionS.toFixed(1)} s</p>
<section class="kpis">
  <div class="kpi"><span>Resultado</span><strong class="${analisis.cumple ? 'ok' : 'mal'}">${analisis.cumple ? 'Cumple' : 'No cumple'}</strong></div>
  <div class="kpi"><span>Peticiones</span><strong>${total.peticiones}</strong></div>
  <div class="kpi"><span>Rendimiento</span><strong>${analisis.rendimiento.toFixed(2)} /s</strong></div>
  <div class="kpi"><span>p95 cotizaciones (ASR-01: ${analisis.umbralCotizacion} ms)</span><strong>${analisis.p95Cotizaciones} ms</strong></div>
  <div class="kpi"><span>Cotizaciones por minuto (ASR-04: 50.000)</span><strong>${Math.round(analisis.cotizacionesPorMinuto)}</strong></div>
  <div class="kpi"><span>p95 total</span><strong>${total.p95} ms</strong></div>
  <div class="kpi"><span>Errores (umbral ${analisis.umbralErrores} %)</span><strong>${pct(total.pctErrores)} %</strong></div>
</section>
<section class="graficas">
  <div class="panel"><h2>Latencia por petición (ms)</h2><div class="lienzo" style="height: ${Math.max(280, peticiones.length * 34)}px"><canvas id="latencia"></canvas></div></div>
  <div class="panel"><h2>Peticiones y errores por segundo</h2><div class="lienzo"><canvas id="rendimiento"></canvas></div></div>
  <div class="panel"><h2>Latencia en el tiempo (ms)</h2><div class="lienzo"><canvas id="tiempo"></canvas></div></div>
  <div class="panel"><h2>Distribución de latencias</h2><div class="lienzo"><canvas id="histograma"></canvas></div></div>
</section>
<section class="panel tabla">
<table>
<thead><tr><th>Petición</th><th>Peticiones</th><th>Errores %</th><th>Promedio</th><th>p50</th><th>p90</th><th>p95</th><th>p99</th><th>Máx</th><th>Objetivo p95</th><th>Cumple</th></tr></thead>
<tbody>
${tabla}
</tbody>
</table>
</section>
</main>
<script src="${CHART_JS.src}" integrity="${CHART_JS.integrity}" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
<script>
const datos = ${datos};
const css = getComputedStyle(document.documentElement);
const color = (nombre) => css.getPropertyValue(nombre).trim();
Chart.defaults.color = color('--suave');
Chart.defaults.borderColor = color('--borde');
Chart.defaults.maintainAspectRatio = false;
const umbral = { label: 'Umbral p95', type: 'line', pointRadius: 0, borderDash: [6, 4], borderColor: color('--s4'), borderWidth: 1.5 };

new Chart(document.getElementById('latencia'), {
  type: 'bar',
  data: {
    labels: datos.peticiones.map((p) => p.nombre),
    datasets: [
      { label: 'p50', data: datos.peticiones.map((p) => p.p50), backgroundColor: color('--s1') },
      { label: 'p95', data: datos.peticiones.map((p) => p.p95), backgroundColor: color('--s2') },
      { label: 'p99', data: datos.peticiones.map((p) => p.p99), backgroundColor: color('--s3') },
    ],
  },
  options: { indexAxis: 'y', scales: { x: { beginAtZero: true }, y: { ticks: { autoSkip: false } } } },
});

const segundos = datos.linea.map((s) => s.segundo + ' s');
new Chart(document.getElementById('rendimiento'), {
  type: 'bar',
  data: {
    labels: segundos,
    datasets: [
      { label: 'Correctas', data: datos.linea.map((s) => s.peticiones - s.errores), backgroundColor: color('--s1') },
      { label: 'Con error', data: datos.linea.map((s) => s.errores), backgroundColor: color('--s4') },
    ],
  },
  options: { scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } },
});

new Chart(document.getElementById('tiempo'), {
  type: 'line',
  data: {
    labels: segundos,
    datasets: [
      { label: 'Promedio', data: datos.linea.map((s) => Math.round(s.promedio)), borderColor: color('--s1'), pointRadius: 0, tension: 0.2 },
      { label: 'p95', data: datos.linea.map((s) => s.p95), borderColor: color('--s2'), pointRadius: 0, tension: 0.2 },
      { ...umbral, data: datos.linea.map(() => datos.umbralP95) },
    ],
  },
  options: { scales: { y: { beginAtZero: true } } },
});

new Chart(document.getElementById('histograma'), {
  type: 'bar',
  data: {
    labels: datos.histograma.map((c) => c.etiqueta),
    datasets: [{ label: 'Peticiones', data: datos.histograma.map((c) => c.cantidad), backgroundColor: color('--s3') }],
  },
  options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
});
</script>
</body>
</html>
`;
}

export function leerCorridas(carpeta) {
  return readdirSync(carpeta)
    .filter((archivo) => /^usuario-\d+\.json$/.test(archivo))
    .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]))
    .map((archivo) => ({
      usuario: Number(archivo.match(/\d+/)[0]),
      corrida: JSON.parse(readFileSync(join(carpeta, archivo), 'utf8')),
    }));
}

function opcion(args, nombre, porDefecto) {
  const i = args.indexOf(nombre);
  return i >= 0 && args[i + 1] !== undefined ? Number(args[i + 1]) : porDefecto;
}

export function main(args) {
  const carpeta = args[0];
  if (!carpeta) {
    console.error(
      'Uso: node load-tests/report.mjs <carpeta> [--umbral-p95 1000] [--umbral-cotizacion 400] [--umbral-errores 1] [--usuarios N]',
    );
    return 2;
  }
  const corridas = leerCorridas(carpeta);
  if (corridas.length === 0) {
    console.error(`No hay archivos usuario-N.json en ${carpeta}`);
    return 2;
  }
  const analisis = analizar(corridas, {
    umbralP95: opcion(args, '--umbral-p95', 1000),
    umbralErrores: opcion(args, '--umbral-errores', 1),
    umbralCotizacion: opcion(args, '--umbral-cotizacion', 400),
    usuarios: opcion(args, '--usuarios', undefined),
  });
  writeFileSync(join(carpeta, 'resumen.json'), JSON.stringify(analisis, null, 2));
  writeFileSync(join(carpeta, 'resumen.csv'), csv(analisis));
  writeFileSync(join(carpeta, 'resumen.md'), markdown(analisis));
  writeFileSync(join(carpeta, 'reporte.html'), html(analisis));
  console.log(markdown(analisis));
  console.log(`Reporte: ${join(carpeta, 'reporte.html')}`);
  return analisis.cumple ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
