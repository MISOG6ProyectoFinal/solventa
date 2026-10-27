export const PETICIONES = [
  { canal: 'Móvil', nombre: 'BFF móvil disponible' },
  { canal: 'Móvil', nombre: 'Registrar cliente' },
  { canal: 'Móvil', nombre: 'Iniciar sesión' },
  { canal: 'Móvil', nombre: 'Consultar sesión' },
  { canal: 'Móvil', nombre: 'Catálogo de productos' },
  { canal: 'Móvil', nombre: 'Cotizar desde el móvil', cotizacion: true },
  { canal: 'Móvil', nombre: 'Reportar siniestro' },
  { canal: 'Móvil', nombre: 'Solicitar carga de evidencia' },
  { canal: 'Móvil', nombre: 'Subir evidencia' },
  { canal: 'Móvil', nombre: 'Confirmar evidencia' },
  { canal: 'Móvil', nombre: 'Listar evidencias' },
  { canal: 'Móvil', nombre: 'Radicar siniestro' },
  { canal: 'Móvil', nombre: 'Listar siniestros' },
  { canal: 'Móvil', nombre: 'Prestadores cercanos', objetivoMs: 200 },
  { canal: 'Portal web', nombre: 'Cotizar desde el portal', cotizacion: true },
  { canal: 'Portal web', nombre: 'Listar socios' },
  { canal: 'Portal web', nombre: 'Detalle del socio' },
  { canal: 'Portal web', nombre: 'Configuración del socio' },
  { canal: 'API de socios', nombre: 'Cotizar como socio', cotizacion: true },
  { canal: 'API de socios', nombre: 'Cotizar para vender', cotizacion: true },
  { canal: 'API de socios', nombre: 'Pagar como socio' },
  { canal: 'API de socios', nombre: 'Emitir póliza como socio' },
  { canal: 'API de socios', nombre: 'Reintentar la emisión' },
];

const CHART_JS = {
  src: 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  integrity: 'sha384-bs/nf9FbdNouRbMiFcrcZfLXYPKiPaGVGplVbv7dLGECccEXDW+S3zjqSKR5ZEaD',
};

function valores(data, metrica) {
  return data.metrics[metrica]?.values;
}

function latencias(v) {
  return {
    promedio: v.avg,
    min: v.min,
    p50: v.med,
    p90: v['p(90)'],
    p95: v['p(95)'],
    p99: v['p(99)'],
    max: v.max,
  };
}

export function analizar(data, { umbralP95, umbralCotizacion, umbralErrores, perfil = 'carga' }) {
  const duracionS = Math.max(data.state.testRunDurationMs / 1000, 0.001);
  const filas = PETICIONES.flatMap(({ canal, nombre, cotizacion, objetivoMs }) => {
    const duracion = valores(data, `http_req_duration{name:${nombre}}`);
    const peticiones = valores(data, `http_reqs{name:${nombre}}`)?.count ?? 0;
    if (!duracion || peticiones === 0) return [];
    const pctErrores = 100 * (valores(data, `errores{name:${nombre}}`)?.rate ?? 0);
    const objetivo = objetivoMs ?? (cotizacion ? umbralCotizacion : umbralP95);
    const fila = { canal, peticion: nombre, cotizacion: Boolean(cotizacion), peticiones, pctErrores, objetivo };
    return [{ ...fila, ...latencias(duracion), cumple: duracion['p(95)'] <= objetivo && pctErrores <= umbralErrores }];
  });

  const totalErrores = 100 * (valores(data, 'errores')?.rate ?? 0);
  const total = {
    canal: '',
    peticion: 'Total',
    cotizacion: false,
    peticiones: filas.reduce((suma, f) => suma + f.peticiones, 0),
    pctErrores: totalErrores,
    objetivo: null,
    ...latencias(valores(data, 'http_req_duration{fase:prueba}') ?? {}),
    cumple: totalErrores <= umbralErrores,
  };

  const cotizacionesOk = valores(data, 'cotizaciones')?.count ?? 0;
  const p95Cotizaciones = Math.max(0, ...filas.filter((f) => f.cotizacion).map((f) => f.p95));
  const iteracionesPerdidas = valores(data, 'dropped_iterations')?.count ?? 0;

  return {
    perfil,
    duracionS,
    vusMaximos: valores(data, 'vus_max')?.max ?? 0,
    rendimiento: total.peticiones / duracionS,
    cotizacionesPorMinuto: (cotizacionesOk * 60000) / Math.max(data.state.testRunDurationMs, 1),
    p95Cotizaciones,
    iteracionesPerdidas,
    umbralP95,
    umbralCotizacion,
    umbralErrores,
    cumple: [...filas, total].every((f) => f.cumple) && iteracionesPerdidas === 0,
    filas: [...filas, total],
  };
}

const entero = (valor) => (valor === null || valor === undefined ? '-' : Math.round(valor).toString());
const pct = (valor) => valor.toFixed(2);

export function csv(analisis) {
  const encabezado =
    'canal,peticion,peticiones,pct_errores,promedio_ms,min_ms,p50_ms,p90_ms,p95_ms,p99_ms,max_ms,objetivo_p95_ms,cumple';
  const filas = analisis.filas.map((f) =>
    [
      `"${f.canal}"`,
      `"${f.peticion}"`,
      f.peticiones,
      pct(f.pctErrores),
      entero(f.promedio),
      entero(f.min),
      entero(f.p50),
      entero(f.p90),
      entero(f.p95),
      entero(f.p99),
      entero(f.max),
      f.objetivo ?? '',
      f.cumple ? 'si' : 'no',
    ].join(','),
  );
  return [encabezado, ...filas].join('\n') + '\n';
}

export function markdown(analisis) {
  const lineas = [
    '# Prueba de carga de Canales',
    '',
    `- **Perfil:** ${analisis.perfil}`,
    `- **Duración:** ${analisis.duracionS.toFixed(1)} s, hasta ${analisis.vusMaximos} usuarios virtuales`,
    `- **Rendimiento:** ${analisis.rendimiento.toFixed(2)} peticiones/s`,
    `- **Cotizaciones:** ${entero(analisis.cotizacionesPorMinuto)} por minuto con p95 de ${entero(analisis.p95Cotizaciones)} ms (ASR-01: ${analisis.umbralCotizacion} ms; ASR-04: 50.000 por minuto)`,
    `- **Iteraciones que k6 no alcanzó a lanzar:** ${analisis.iteracionesPerdidas}`,
    `- **Resultado:** ${analisis.cumple ? 'Cumple' : 'No cumple'}`,
    '',
    '| Canal | Petición | Peticiones | Errores (%) | Promedio | p50 | p90 | p95 | p99 | Máx | Objetivo p95 | Cumple |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|',
    ...analisis.filas.map((f) => {
      const nombre = f.peticion === 'Total' ? '**Total**' : f.peticion;
      return `| ${f.canal} | ${nombre} | ${f.peticiones} | ${pct(f.pctErrores)} | ${entero(f.promedio)} | ${entero(f.p50)} | ${entero(f.p90)} | ${entero(f.p95)} | ${entero(f.p99)} | ${entero(f.max)} | ${f.objetivo ?? '-'} | ${f.cumple ? 'Sí' : 'No'} |`;
    }),
    '',
    `Tiempos en milisegundos. Las cotizaciones se miden contra ${analisis.umbralCotizacion} ms (ASR-01) y el resto contra ${analisis.umbralP95} ms; cada petición cumple además si sus errores no superan ${analisis.umbralErrores} %. La prueba no cumple si k6 dejó iteraciones sin lanzar, porque entonces no sostuvo la tasa pedida.`,
  ];
  return lineas.join('\n') + '\n';
}

const escapar = (texto) =>
  String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function html(analisis) {
  const filas = analisis.filas.filter((f) => f.peticion !== 'Total');
  const total = analisis.filas.at(-1);
  const datos = JSON.stringify({
    nombres: filas.map((f) => f.peticion),
    p50: filas.map((f) => Math.round(f.p50)),
    p95: filas.map((f) => Math.round(f.p95)),
    p99: filas.map((f) => Math.round(f.p99)),
    objetivo: filas.map((f) => f.objetivo),
  }).replace(/</g, '\\u003c');
  const tabla = analisis.filas
    .map(
      (f) =>
        `<tr${f.peticion === 'Total' ? ' class="total"' : ''}><td>${escapar(f.canal)}</td><td>${escapar(f.peticion)}</td><td>${f.peticiones}</td><td>${pct(f.pctErrores)}</td><td>${entero(f.promedio)}</td><td>${entero(f.p50)}</td><td>${entero(f.p90)}</td><td>${entero(f.p95)}</td><td>${entero(f.p99)}</td><td>${entero(f.max)}</td><td>${f.objetivo ?? '-'}</td><td class="${f.cumple ? 'ok' : 'mal'}">${f.cumple ? 'Sí' : 'No'}</td></tr>`,
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
a { color: var(--s1); }
.sub { color: var(--suave); margin: 0 0 20px; }
.kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; margin-bottom: 20px; }
.kpi, .panel { background: var(--panel); border: 1px solid var(--borde); border-radius: 10px; padding: 14px 16px; }
.kpi span { display: block; color: var(--suave); font-size: .8rem; }
.kpi strong { font-size: 1.4rem; font-variant-numeric: tabular-nums; }
.ok { color: var(--ok); } .mal { color: var(--mal); }
.panel { margin-bottom: 20px; }
.panel h2 { font-size: 1rem; margin: 0 0 10px; }
.lienzo { position: relative; }
.tabla { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; }
th, td { padding: 6px 10px; border-bottom: 1px solid var(--borde); text-align: right; white-space: nowrap; }
th:nth-child(-n+2), td:nth-child(-n+2) { text-align: left; }
th { color: var(--suave); font-weight: 600; font-size: .85rem; }
tr.total td { font-weight: 700; }
</style>
</head>
<body>
<main>
<h1>Prueba de carga de Canales</h1>
<p class="sub">Perfil ${escapar(analisis.perfil)} · ${analisis.duracionS.toFixed(1)} s · hasta ${analisis.vusMaximos} usuarios virtuales · <a href="dashboard.html">gráficas en el tiempo</a></p>
<section class="kpis">
  <div class="kpi"><span>Resultado</span><strong class="${analisis.cumple ? 'ok' : 'mal'}">${analisis.cumple ? 'Cumple' : 'No cumple'}</strong></div>
  <div class="kpi"><span>p95 cotizaciones (ASR-01: ${analisis.umbralCotizacion} ms)</span><strong>${entero(analisis.p95Cotizaciones)} ms</strong></div>
  <div class="kpi"><span>Cotizaciones por minuto (ASR-04: 50.000)</span><strong>${entero(analisis.cotizacionesPorMinuto)}</strong></div>
  <div class="kpi"><span>Rendimiento</span><strong>${analisis.rendimiento.toFixed(1)} /s</strong></div>
  <div class="kpi"><span>Errores (umbral ${analisis.umbralErrores} %)</span><strong>${pct(total.pctErrores)} %</strong></div>
  <div class="kpi"><span>Iteraciones sin lanzar</span><strong>${analisis.iteracionesPerdidas}</strong></div>
</section>
<section class="panel"><h2>Latencia por petición frente a su objetivo (ms)</h2>
<div class="lienzo" style="height: ${Math.max(280, filas.length * 34)}px"><canvas id="latencia"></canvas></div></section>
<section class="panel tabla">
<table>
<thead><tr><th>Canal</th><th>Petición</th><th>Peticiones</th><th>Errores %</th><th>Promedio</th><th>p50</th><th>p90</th><th>p95</th><th>p99</th><th>Máx</th><th>Objetivo p95</th><th>Cumple</th></tr></thead>
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
new Chart(document.getElementById('latencia'), {
  type: 'bar',
  data: {
    labels: datos.nombres,
    datasets: [
      { label: 'p50', data: datos.p50, backgroundColor: color('--s1') },
      { label: 'p95', data: datos.p95, backgroundColor: color('--s2') },
      { label: 'p99', data: datos.p99, backgroundColor: color('--s3') },
      { label: 'Objetivo p95', data: datos.objetivo, backgroundColor: 'transparent', borderColor: color('--s4'), borderWidth: 2 },
    ],
  },
  options: { indexAxis: 'y', scales: { x: { beginAtZero: true }, y: { ticks: { autoSkip: false } } } },
});
</script>
</body>
</html>
`;
}

export function generarReportes(data, opciones) {
  const analisis = analizar(data, opciones);
  const carpeta = opciones.carpeta.replace(/\/$/, '');
  const texto = markdown(analisis);
  return {
    stdout: `\n${texto}\nReporte: ${carpeta}/reporte.html\n`,
    [`${carpeta}/resumen.md`]: texto,
    [`${carpeta}/resumen.csv`]: csv(analisis),
    [`${carpeta}/resumen.json`]: JSON.stringify(analisis, null, 2),
    [`${carpeta}/reporte.html`]: html(analisis),
  };
}
