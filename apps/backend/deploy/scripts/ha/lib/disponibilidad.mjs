import { readFileSync } from "node:fs";
import { SLO_MENSUAL } from "./constantes.mjs";

function observada(muestra) {
  return muestra.alcance !== "no-evaluado" && muestra.alcance !== "no-observado" && muestra.origen !== "monitor";
}

/** Un ciclo cuenta una vez por flujo. Un error de acceso del cliente también cuenta: es indisponibilidad vista desde fuera. */
export function ciclos(muestras) {
  const grupos = new Map();
  for (const muestra of muestras) {
    if (!observada(muestra)) continue;
    const clave = `${muestra.tick}|${muestra.flow}`;
    const actual = grupos.get(clave) ?? {
      tick: muestra.tick,
      ts: muestra.ts,
      flow: muestra.flow,
      ok: true,
      latenciaMs: 0,
      sondas: 0,
      acceso: false,
    };
    actual.ok = actual.ok && Boolean(muestra.ok);
    actual.latenciaMs = Math.max(actual.latenciaMs, Number(muestra.latency_ms) || 0);
    actual.sondas += 1;
    actual.acceso = actual.acceso || muestra.origen === "cliente";
    if (muestra.ts > actual.ts) actual.ts = muestra.ts;
    grupos.set(clave, actual);
  }
  return [...grupos.values()].sort((a, b) => a.ts.localeCompare(b.ts) || a.flow.localeCompare(b.flow));
}

export function resumirDisponibilidad(muestras, { flujosEsperados = ["venta", "siniestros"] } = {}) {
  const porFlujo = {};
  for (const ciclo of ciclos(muestras)) {
    const flujo = (porFlujo[ciclo.flow] ??= { total: 0, exitos: 0, fallos: 0, fallosDeAcceso: 0, latenciaMaxMs: 0 });
    flujo.total += 1;
    flujo.latenciaMaxMs = Math.max(flujo.latenciaMaxMs, ciclo.latenciaMs);
    if (ciclo.ok) flujo.exitos += 1;
    else flujo.fallos += 1;
    if (!ciclo.ok && ciclo.acceso) flujo.fallosDeAcceso += 1;
  }
  let total = 0;
  let exitos = 0;
  let fallosDeAcceso = 0;
  for (const flujo of Object.values(porFlujo)) {
    total += flujo.total;
    exitos += flujo.exitos;
    fallosDeAcceso += flujo.fallosDeAcceso;
    flujo.disponibilidadObservada = flujo.total === 0 ? null : flujo.exitos / flujo.total;
  }
  const noObservadas = muestras.filter((muestra) => muestra.alcance === "no-observado" || muestra.origen === "monitor").length;
  return {
    porFlujo,
    total,
    exitos,
    fallos: total - exitos,
    fallosDeAcceso,
    muestrasNoObservadas: noObservadas,
    sinMuestras: flujosEsperados.filter((flujo) => !porFlujo[flujo]),
    disponibilidadObservada: total === 0 ? null : exitos / total,
    sloMensualObjetivo: SLO_MENSUAL,
    sloMensualDemostrado: false,
    motivo:
      "La disponibilidad observada es la de los ciclos medidos. Un error de red o de tiempo de espera cuenta como fallo. Una ventana en la que el monitor no escribió muestras queda como no observada, no como disponible. Esta prueba no demuestra el 99,97 % mensual.",
  };
}

/** Huecos del propio monitor. No se suman como tiempo disponible. */
export function huecosNoObservados(muestras, intervaloMs, hasta = Date.now()) {
  const ticks = [
    ...new Set(
      muestras
        .filter((muestra) => observada(muestra) && muestra.tick && muestra.tick !== "sin-credenciales")
        .map((muestra) => Date.parse(muestra.tick))
        .filter((valor) => !Number.isNaN(valor)),
    ),
  ].sort((a, b) => a - b);
  const limite = intervaloMs * 2.5;
  const huecos = [];
  for (let i = 1; i < ticks.length; i += 1) {
    const delta = ticks[i] - ticks[i - 1];
    if (delta > limite) {
      huecos.push({
        desde: new Date(ticks[i - 1]).toISOString(),
        hasta: new Date(ticks[i]).toISOString(),
        ms: delta,
      });
    }
  }
  if (ticks.length) {
    const final = hasta - ticks.at(-1);
    if (final > limite) {
      huecos.push({
        desde: new Date(ticks.at(-1)).toISOString(),
        hasta: new Date(hasta).toISOString(),
        ms: final,
        abierto: true,
      });
    }
  }
  return huecos;
}

export function resumirVentanas(ventanas) {
  return ventanas.map((ventana) => ({
    fase: ventana.fase,
    archivo: ventana.archivo ?? null,
    ...resumirDisponibilidad(ventana.muestras),
  }));
}

export function leerMuestras(ruta) {
  const muestras = [];
  for (const linea of readFileSync(ruta, "utf8").split(/\r?\n/)) {
    if (!linea.trim()) continue;
    try {
      muestras.push(JSON.parse(linea));
    } catch {
      // La última línea puede estar a medio escribir.
    }
  }
  return muestras;
}
