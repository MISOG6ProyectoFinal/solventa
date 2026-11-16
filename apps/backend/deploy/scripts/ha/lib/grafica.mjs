const INTERVALO_MS = 5000;

const COLOR = {
  venta: "#0d7a45",
  siniestros: "#1565c0",
  fallo: "#c62828",
  eje: "#4b5563",
  grilla: "#e5e7eb",
  hueco: "#f3f4f6",
  evento: "#374151",
  rto: "#fecaca",
  texto: "#111827",
};

function escapar(texto) {
  return String(texto ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function esMuestraEvaluada(muestra) {
  return muestra?.alcance !== "no-evaluado" && muestra?.alcance !== "no-observado" && muestra?.origen !== "monitor" && Boolean(muestra?.ts);
}

export function segmentosDe(muestras, flujo, t0, intervaloMs = INTERVALO_MS) {
  const puntos = muestras
    .filter((muestra) => muestra.flow === flujo && esMuestraEvaluada(muestra))
    .map((muestra) => ({
      t: Date.parse(muestra.ts),
      ok: Boolean(muestra.ok),
      latencia: Number.isFinite(muestra.latency_ms) ? muestra.latency_ms : null,
    }))
    .filter((punto) => !Number.isNaN(punto.t))
    .sort((a, b) => a.t - b.t)
    .map((punto) => ({ ...punto, s: (punto.t - t0) / 1000 }));
  const segmentos = [];
  let actual = [];
  for (const punto of puntos) {
    const previo = actual.at(-1);
    if (previo && punto.t - previo.t > intervaloMs * 2.5) {
      segmentos.push(actual);
      actual = [];
    }
    actual.push(punto);
  }
  if (actual.length) segmentos.push(actual);
  return segmentos;
}

export function huecosDeSegmentos(segmentos, intervaloMs = INTERVALO_MS) {
  const planos = segmentos.flat();
  const huecos = [];
  for (let i = 1; i < planos.length; i += 1) {
    const delta = planos[i].t - planos[i - 1].t;
    if (delta > intervaloMs * 2.5) huecos.push({ desde: planos[i - 1].s, hasta: planos[i].s });
  }
  return huecos;
}

function rangoTemporal(muestras, eventos) {
  const tiempos = [
    ...muestras.filter(esMuestraEvaluada).map((muestra) => Date.parse(muestra.ts)),
    ...eventos.map((evento) => Date.parse(evento.ts)),
  ].filter((t) => !Number.isNaN(t));
  if (!tiempos.length) return { t0: 0, t1: 1 };
  return { t0: Math.min(...tiempos), t1: Math.max(...tiempos) };
}

function pasoEje(duracion) {
  if (duracion <= 90) return 20;
  if (duracion <= 180) return 30;
  if (duracion <= 360) return 60;
  return 120;
}

function segundos(ms) {
  return `${(ms / 1000).toFixed(3).replace(".", ",")} s`;
}

function documento(ancho, alto, cuerpo) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}" viewBox="0 0 ${ancho} ${alto}">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <style>text { font-family: "Segoe UI", sans-serif; fill: ${COLOR.texto}; }</style>
  ${cuerpo}
</svg>
`;
}

function panelBinario({ titulo, flujo, segmentos, duracion, eventos, rto, t0, x, y, w, h }) {
  const izquierda = 78;
  const derecha = 24;
  const arriba = 86;
  const abajo = 36;
  const x0 = x + izquierda;
  const y0 = y + arriba;
  const ancho = w - izquierda - derecha;
  const alto = h - arriba - abajo;
  const xDe = (s) => x0 + (duracion === 0 ? ancho / 2 : (s / duracion) * ancho);
  const yDe = (ok) => y0 + (ok ? 8 : alto - 8);
  const partes = [
    `<text x="${x + 8}" y="${y + 18}" font-size="15" font-weight="600">${escapar(titulo)}</text>`,
    `<rect x="${x0}" y="${y0}" width="${ancho}" height="${alto}" fill="#ffffff" stroke="${COLOR.grilla}"/>`,
  ];
  if (rto) {
    const xa = xDe(Math.max(0, (rto.desde - rto.t0) / 1000));
    const xb = xDe(Math.min(duracion, (rto.hasta - rto.t0) / 1000));
    partes.push(`<rect x="${xa}" y="${y0}" width="${Math.max(1, xb - xa)}" height="${alto}" fill="${COLOR.rto}" opacity="0.55"/>`);
  }
  for (const hueco of huecosDeSegmentos(segmentos)) {
    const xa = xDe(hueco.desde);
    const xb = xDe(hueco.hasta);
    partes.push(`<rect x="${xa}" y="${y0}" width="${Math.max(1, xb - xa)}" height="${alto}" fill="${COLOR.hueco}"/>`);
    if (xb - xa > 36) {
      if (xb - xa > 78) {
        partes.push(`<text x="${(xa + xb) / 2}" y="${y0 + alto / 2}" font-size="11" fill="#6b7280" text-anchor="middle">sin observación</text>`);
      }
    }
  }
  const color = COLOR[flujo] || COLOR.venta;
  for (const segmento of segmentos) {
    let trazo = "";
    segmento.forEach((punto, indice) => {
      const px = xDe(punto.s).toFixed(1);
      const py = yDe(punto.ok).toFixed(1);
      if (indice === 0) trazo = `M ${px} ${py}`;
      else trazo += ` H ${px} V ${py}`;
    });
    if (segmento.length > 1) partes.push(`<path d="${trazo}" fill="none" stroke="${color}" stroke-width="2"/>`);
    for (const punto of segmento) {
      partes.push(`<circle cx="${xDe(punto.s).toFixed(1)}" cy="${yDe(punto.ok).toFixed(1)}" r="4.5" fill="${punto.ok ? color : COLOR.fallo}" stroke="#ffffff" stroke-width="1"/>`);
    }
  }
  partes.push(`<text x="${x + 8}" y="${y0 + 14}" font-size="12" fill="${COLOR.eje}">100 %</text>`);
  partes.push(`<text x="${x + 8}" y="${y0 + alto - 2}" font-size="12" fill="${COLOR.eje}">0 %</text>`);
  partes.push(`<text x="22" y="${y0 + alto / 2}" font-size="12" fill="${COLOR.eje}" text-anchor="middle" transform="rotate(-90 22 ${y0 + alto / 2})">Resultado de la solicitud</text>`);
  const paso = pasoEje(duracion);
  for (let s = 0; s <= duracion + 0.01; s += paso) {
    const px = xDe(Math.min(s, duracion));
    partes.push(`<line x1="${px}" y1="${y0 + alto}" x2="${px}" y2="${y0 + alto + 5}" stroke="${COLOR.eje}"/>`);
    partes.push(`<text x="${px}" y="${y0 + alto + 18}" font-size="11" fill="${COLOR.eje}" text-anchor="middle">${Math.round(Math.min(s, duracion))} s</text>`);
  }
  partes.push(`<text x="${x0 + ancho / 2}" y="${y + h - 4}" font-size="12" fill="${COLOR.eje}" text-anchor="middle">Tiempo transcurrido (s)</text>`);
  const filas = [];
  for (const evento of eventos) {
    const s = (Date.parse(evento.ts) - t0) / 1000;
    if (Number.isNaN(s) || s < -1 || s > duracion + 1) continue;
    const px = xDe(Math.max(0, Math.min(duracion, s)));
    const anchoTexto = evento.etiqueta.length * 6.6;
    const alBorde = px > x0 + ancho - 170;
    const caja = alBorde ? [px - 4 - anchoTexto, px] : [px, px + 4 + anchoTexto];
    let fila = 0;
    while ((filas[fila] || []).some(([a, b]) => caja[0] < b + 14 && caja[1] + 14 > a)) fila += 1;
    (filas[fila] ??= []).push(caja);
    partes.push(`<line x1="${px}" y1="${y0}" x2="${px}" y2="${y0 + alto}" stroke="${COLOR.evento}" stroke-dasharray="3 3"/>`);
    partes.push(`<text x="${alBorde ? px - 4 : px + 4}" y="${y0 - 12 - fila * 18}" font-size="11" fill="${COLOR.evento}" text-anchor="${alBorde ? "end" : "start"}">${escapar(evento.etiqueta)}</text>`);
  }
  return partes.join("\n");
}

function leyenda(x, y) {
  return `<circle cx="${x}" cy="${y}" r="5" fill="${COLOR.venta}"/><text x="${x + 10}" y="${y + 4}" font-size="12">Venta exitosa</text>
    <circle cx="${x + 130}" cy="${y}" r="5" fill="${COLOR.siniestros}"/><text x="${x + 140}" y="${y + 4}" font-size="12">Siniestros exitoso</text>
    <circle cx="${x + 300}" cy="${y}" r="5" fill="${COLOR.fallo}"/><text x="${x + 310}" y="${y + 4}" font-size="12">Solicitud fallida</text>
    <rect x="${x + 450}" y="${y - 6}" width="14" height="12" fill="${COLOR.hueco}" stroke="#d1d5db"/><text x="${x + 470}" y="${y + 4}" font-size="12">Sin observación</text>`;
}

export function graficaDisponibilidad({ titulo, experimento, muestras, eventos = [], resumen = [], rto = null, intervaloMs = INTERVALO_MS } = {}) {
  const { t0, t1 } = rangoTemporal(muestras, [...eventos, ...(rto ? [{ ts: new Date(rto.desde).toISOString() }, { ts: new Date(rto.hasta).toISOString() }] : [])]);
  const duracion = Math.max(1, (t1 - t0) / 1000);
  const rtoDibujo = rto?.desde != null && rto?.hasta != null ? { ...rto, t0 } : null;
  const ancho = 1240;
  const alto = 860;
  const cuerpo = [
    `<text x="24" y="28" font-size="20" font-weight="700">${escapar(titulo)}</text>`,
    `<text x="24" y="50" font-size="13" fill="#374151">${escapar(experimento || "")}</text>`,
    leyenda(24, 72),
    panelBinario({
      titulo: "Disponibilidad de venta",
      flujo: "venta",
      segmentos: segmentosDe(muestras, "venta", t0, intervaloMs),
      duracion,
      eventos,
      rto: rtoDibujo,
      t0,
      x: 16,
      y: 96,
      w: ancho - 32,
      h: 310,
    }),
    panelBinario({
      titulo: "Disponibilidad de siniestros",
      flujo: "siniestros",
      segmentos: segmentosDe(muestras, "siniestros", t0, intervaloMs),
      duracion,
      eventos,
      rto: rtoDibujo,
      t0,
      x: 16,
      y: 420,
      w: ancho - 32,
      h: 310,
    }),
    ...resumen.map((linea, indice) => `<text x="24" y="${752 + indice * 18}" font-size="14">${escapar(linea)}</text>`),
  ];
  const marcas = ["venta", "siniestros"].flatMap((flujo) => segmentosDe(muestras, flujo, t0, intervaloMs).flat());
  return { svg: documento(ancho, alto, cuerpo.join("\n")), marcas, t0, duracion };
}

export function graficaLatencia({ titulo, experimento, muestras, eventos = [], intervaloMs = INTERVALO_MS } = {}) {
  const { t0, t1 } = rangoTemporal(muestras, eventos);
  const duracion = Math.max(1, (t1 - t0) / 1000);
  const series = ["venta", "siniestros"].map((flujo) => {
    const puntos = segmentosDe(muestras, flujo, t0, intervaloMs).flat().filter((punto) => punto.ok && punto.latencia != null);
    const segmentos = [];
    let actual = [];
    for (const punto of puntos) {
      const previo = actual.at(-1);
      if (previo && punto.t - previo.t > intervaloMs * 2.5) {
        if (actual.length) segmentos.push(actual);
        actual = [];
      }
      actual.push(punto);
    }
    if (actual.length) segmentos.push(actual);
    return { flujo, segmentos };
  });
  const valores = series.flatMap((serie) => serie.segmentos.flat().map((punto) => punto.latencia));
  const maximo = Math.max(50, ...valores, 0);
  const ancho = 1240;
  const alto = 560;
  const x0 = 84;
  const y0 = 110;
  const w = ancho - 120;
  const h = 360;
  const xDe = (s) => x0 + (s / duracion) * w;
  const yDe = (ms) => y0 + h - (ms / maximo) * h;
  const partes = [
    `<text x="24" y="28" font-size="20" font-weight="700">${escapar(titulo)}</text>`,
    `<text x="24" y="50" font-size="13" fill="#374151">${escapar(experimento || "")} Las solicitudes sin respuesta no se dibujan en este eje.</text>`,
    `<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#ffffff" stroke="${COLOR.grilla}"/>`,
    `<text x="16" y="${y0 + h / 2}" font-size="12" fill="${COLOR.eje}" transform="rotate(-90 16 ${y0 + h / 2})">Latencia (ms)</text>`,
  ];
  for (const marca of [0, maximo / 2, maximo]) {
    const py = yDe(marca);
    partes.push(`<text x="${x0 - 8}" y="${py + 4}" font-size="11" fill="${COLOR.eje}" text-anchor="end">${Math.round(marca)}</text>`);
    partes.push(`<line x1="${x0}" y1="${py}" x2="${x0 + w}" y2="${py}" stroke="${COLOR.grilla}"/>`);
  }
  for (const serie of series) {
    const color = COLOR[serie.flujo];
    for (const segmento of serie.segmentos) {
      if (segmento.length > 1) {
        const d = segmento.map((punto, indice) => `${indice === 0 ? "M" : "L"} ${xDe(punto.s).toFixed(1)} ${yDe(punto.latencia).toFixed(1)}`).join(" ");
        partes.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="2"/>`);
      }
      for (const punto of segmento) {
        partes.push(`<circle cx="${xDe(punto.s).toFixed(1)}" cy="${yDe(punto.latencia).toFixed(1)}" r="4" fill="${color}"/>`);
      }
    }
  }
  const filas = [];
  eventos.forEach((evento) => {
    const s = (Date.parse(evento.ts) - t0) / 1000;
    if (Number.isNaN(s)) return;
    const px = xDe(Math.max(0, Math.min(duracion, s)));
    const anchoTexto = evento.etiqueta.length * 6.6;
    const alBorde = px > x0 + w - 170;
    const caja = alBorde ? [px - 4 - anchoTexto, px] : [px, px + 4 + anchoTexto];
    let fila = 0;
    while ((filas[fila] || []).some(([a, b]) => caja[0] < b + 14 && caja[1] + 14 > a)) fila += 1;
    (filas[fila] ??= []).push(caja);
    partes.push(`<line x1="${px}" y1="${y0}" x2="${px}" y2="${y0 + h}" stroke="${COLOR.evento}" stroke-dasharray="3 3"/>`);
    partes.push(`<text x="${alBorde ? px - 4 : px + 4}" y="${y0 - 12 - fila * 18}" font-size="11" fill="${COLOR.evento}" text-anchor="${alBorde ? "end" : "start"}">${escapar(evento.etiqueta)}</text>`);
  });
  const paso = pasoEje(duracion);
  for (let s = 0; s <= duracion + 0.01; s += paso) {
    const px = xDe(Math.min(s, duracion));
    partes.push(`<text x="${px}" y="${y0 + h + 20}" font-size="11" fill="${COLOR.eje}" text-anchor="middle">${Math.round(Math.min(s, duracion))} s</text>`);
  }
  partes.push(`<text x="${x0 + w / 2}" y="${alto - 16}" font-size="12" fill="${COLOR.eje}" text-anchor="middle">Tiempo transcurrido (s)</text>`);
  partes.push(`<circle cx="24" cy="${alto - 36}" r="5" fill="${COLOR.venta}"/><text x="34" y="${alto - 32}" font-size="12">Venta</text>`);
  partes.push(`<circle cx="110" cy="${alto - 36}" r="5" fill="${COLOR.siniestros}"/><text x="120" y="${alto - 32}" font-size="12">Siniestros</text>`);
  return { svg: documento(ancho, alto, partes.join("\n")), t0, duracion };
}

export function graficaInfra({ titulo, muestras = [], eventos = [] } = {}) {
  const tiempos = [...muestras.map((m) => Date.parse(m.ts)), ...eventos.map((e) => Date.parse(e.ts))].filter((t) => !Number.isNaN(t));
  const t0 = tiempos.length ? Math.min(...tiempos) : 0;
  const t1 = tiempos.length ? Math.max(...tiempos) : 1;
  const duracion = Math.max(1, (t1 - t0) / 1000);
  const ancho = 1240;
  const alto = 760;
  const x0 = 84;
  const yN = 128;
  const h = 200;
  const w = ancho - 130;
  const xDe = (s) => x0 + (s / duracion) * w;
  const partes = [
    `<text x="24" y="28" font-size="20" font-weight="700">${escapar(titulo)}</text>`,
    `<text x="24" y="50" font-size="13" fill="#374151">Cada punto es una lectura del clúster. No se rellenan los instantes sin lectura.</text>`,
  ];
  const paneles = [
    { titulo: "Nodos listos por zona", y: yN, series: ["ha-zone-a", "ha-zone-b"], valor: (m, zona) => m.zonas?.[zona]?.nodo, max: 1, unidad: "nodos" },
    { titulo: "Réplicas críticas listas por zona", y: yN + 270, series: ["ha-zone-a", "ha-zone-b"], valor: (m, zona) => m.zonas?.[zona]?.replicas, max: 6, unidad: "réplicas" },
  ];
  const coloresZona = { "ha-zone-a": COLOR.venta, "ha-zone-b": COLOR.siniestros };
  for (const panel of paneles) {
    partes.push(`<text x="24" y="${panel.y - 36}" font-size="15" font-weight="600">${panel.titulo}</text>`);
    partes.push(`<rect x="${x0}" y="${panel.y}" width="${w}" height="${h}" fill="#ffffff" stroke="${COLOR.grilla}"/>`);
    partes.push(`<text x="16" y="${panel.y + h / 2}" font-size="12" fill="${COLOR.eje}" transform="rotate(-90 16 ${panel.y + h / 2})">${panel.unidad}</text>`);
    for (const zona of panel.series) {
      const puntos = muestras
        .map((m) => ({ t: Date.parse(m.ts), v: panel.valor(m, zona) }))
        .filter((p) => !Number.isNaN(p.t) && p.v != null)
        .sort((a, b) => a.t - b.t);
      const segmentos = [];
      let actual = [];
      for (const punto of puntos) {
        const previo = actual.at(-1);
        if (previo && punto.t - previo.t > 15000) {
          segmentos.push(actual);
          actual = [];
        }
        actual.push(punto);
      }
      if (actual.length) segmentos.push(actual);
      for (const segmento of segmentos) {
        if (segmento.length > 1) {
          const d = segmento.map((punto, indice) => `${indice === 0 ? "M" : "L"} ${xDe((punto.t - t0) / 1000).toFixed(1)} ${(panel.y + h - (punto.v / panel.max) * (h - 16) - 8).toFixed(1)}`).join(" ");
          partes.push(`<path d="${d}" fill="none" stroke="${coloresZona[zona]}" stroke-width="2"/>`);
        }
        for (const punto of segmento) {
          const py = panel.y + h - (punto.v / panel.max) * (h - 16) - 8;
          partes.push(`<circle cx="${xDe((punto.t - t0) / 1000).toFixed(1)}" cy="${py.toFixed(1)}" r="3.5" fill="${coloresZona[zona]}"/>`);
        }
      }
    }
    partes.push(`<text x="${x0 + w / 2}" y="${panel.y + h + 28}" font-size="12" fill="${COLOR.eje}" text-anchor="middle">Tiempo transcurrido (s)</text>`);
  }
  const filas = [];
  eventos.forEach((evento) => {
    const s = (Date.parse(evento.ts) - t0) / 1000;
    if (Number.isNaN(s)) return;
    const px = xDe(Math.max(0, Math.min(duracion, s)));
    const anchoTexto = evento.etiqueta.length * 6.6;
    const alBorde = px > x0 + w - 170;
    const caja = alBorde ? [px - 4 - anchoTexto, px] : [px, px + 4 + anchoTexto];
    let fila = 0;
    while ((filas[fila] || []).some(([a, b]) => caja[0] < b + 14 && caja[1] + 14 > a)) fila += 1;
    (filas[fila] ??= []).push(caja);
    partes.push(`<line x1="${px}" y1="${yN}" x2="${px}" y2="${yN + h}" stroke="${COLOR.evento}" stroke-dasharray="3 3"/>`);
    partes.push(`<text x="${alBorde ? px - 4 : px + 4}" y="${yN - 12 - fila * 18}" font-size="11" fill="${COLOR.evento}" text-anchor="${alBorde ? "end" : "start"}">${escapar(evento.etiqueta)}</text>`);
  });
  partes.push(`<circle cx="24" cy="${alto - 28}" r="5" fill="${COLOR.venta}"/><text x="34" y="${alto - 24}" font-size="12">ha-zone-a</text>`);
  partes.push(`<circle cx="150" cy="${alto - 28}" r="5" fill="${COLOR.siniestros}"/><text x="160" y="${alto - 24}" font-size="12">ha-zone-b</text>`);
  return { svg: documento(ancho, alto, partes.join("\n")), t0, duracion };
}

export function eventosDisponibilidad(tipo, eventos, resultado) {
  const marcas = [];
  const poner = (ts, etiqueta) => {
    if (ts && !Number.isNaN(Date.parse(ts))) marcas.push({ ts, etiqueta });
  };
  if (tipo === "arq12") {
    poner(eventos.find((e) => e.tipo === "arq12-normal-inicio")?.ts, "Inicio del monitoreo");
    poner(eventos.find((e) => e.tipo === "rolling-inicio")?.ts, "Inicio del rolling update");
    poner(eventos.find((e) => e.tipo === "rolling-fin")?.ts, "Fin del rolling update");
    poner(resultado?.fin, "Fin del monitoreo");
  }
  if (tipo === "arq13") {
    poner(resultado?.inicio, "Inicio del monitoreo");
    poner(eventos.find((e) => e.tipo === "falla-zona-a")?.ts || resultado?.inicioFalla, "Interrupción de ha-zone-a");
    poner(resultado?.recuperacion?.primerFallo, "Primera solicitud fallida");
    poner(resultado?.recuperacion?.recuperacionEstable, "Recuperación estable");
    poner(eventos.find((e) => e.tipo === "restaurar-nodo")?.ts, "Restauración del worker");
    poner(resultado?.fin, "Fin del experimento");
  }
  return marcas;
}

export function eventosInfra(muestras, eventos, resultado) {
  const marcas = eventosDisponibilidad("arq13", eventos, resultado).filter((marca) =>
    ["Interrupción de ha-zone-a", "Restauración del worker", "Recuperación estable"].includes(marca.etiqueta),
  );
  let previo = null;
  let viFailover = false;
  for (const muestra of muestras) {
    if (previo && muestra.primario && previo.primario && muestra.primario !== previo.primario) {
      marcas.push({ ts: muestra.ts, etiqueta: "Promoción de la réplica" });
    }
    if (!viFailover && previo && /fail|switchover/i.test(muestra.fase || "") && !/fail|switchover/i.test(previo.fase || "")) {
      viFailover = true;
      marcas.push({ ts: muestra.ts, etiqueta: "Inicio del failover de PostgreSQL" });
    }
    previo = muestra;
  }
  return marcas;
}

export function resumenArq12(resultado) {
  const d = resultado?.disponibilidad;
  if (!d) return ["Sin resultado de ARQ-12."];
  return [
    `${d.exitos ?? 0} solicitudes exitosas / ${d.total ?? 0} evaluadas`,
    `Disponibilidad observada: ${d.disponibilidadObservada == null ? "sin muestras" : `${(d.disponibilidadObservada * 100).toFixed(2).replace(".", ",")} %`}`,
    "Esta ventana no demuestra el 99,97 % mensual.",
  ];
}

export function resumenArq13(resultado) {
  const d = resultado?.disponibilidad;
  const r = resultado?.recuperacion;
  const lineas = [
    `Durante la falla: ${d?.total ?? 0} evaluadas, ${d?.exitos ?? 0} exitosas, ${d?.fallos ?? 0} fallidas.`,
    `Disponibilidad observada: ${d?.disponibilidadObservada == null ? "sin muestras" : `${(d.disponibilidadObservada * 100).toFixed(2).replace(".", ",")} %`}`,
    `Zona interrumpida: ${resultado?.nodo?.zona || "ha-zone-a"}`,
  ];
  if (r?.conclusion === "recuperado" && r.rtoMs != null) {
    lineas.push(`RTO observado: ${segundos(r.rtoMs)}`);
    lineas.push(`RTO máximo permitido: ${segundos(r.rtoMaximoMs ?? 600000)}`);
  } else if (r?.conclusion === "continuidad") {
    lineas.push("Continuidad observada. El RTO queda sin valor.");
  }
  return lineas;
}

export function rtoDe(resultado) {
  const r = resultado?.recuperacion;
  if (r?.conclusion !== "recuperado" || r.rtoMs == null || !r.inicioFalla || !r.recuperacionEstable) return null;
  return { desde: Date.parse(r.inicioFalla), hasta: Date.parse(r.recuperacionEstable), texto: segundos(r.rtoMs) };
}
