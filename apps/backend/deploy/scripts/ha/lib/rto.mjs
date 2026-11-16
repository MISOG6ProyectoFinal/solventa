import { RTO_MAX_MS } from "./constantes.mjs";

function cuenta(muestra) {
  return muestra.alcance !== "no-evaluado" && muestra.alcance !== "no-observado" && muestra.origen !== "monitor";
}

/**
 * Recuperación estable: `estables` ciclos seguidos en los que todos los flujos
 * evaluados de ese tick respondieron bien, después de al menos un fallo.
 * Un fallo de acceso del cliente cuenta. Si no hay fallos, el RTO queda vacío.
 */
export function medirRecuperacion(muestras, { inicioFalla, estables = 6 } = {}) {
  if (!inicioFalla) return { conclusion: "sin-marca-de-falla", rtoMs: null, rtoMaximoMs: RTO_MAX_MS };
  const inicio = Date.parse(inicioFalla);
  if (Number.isNaN(inicio)) return { conclusion: "marca-invalida", rtoMs: null, rtoMaximoMs: RTO_MAX_MS };

  const instantes = new Map();
  for (const muestra of muestras) {
    if (!cuenta(muestra)) continue;
    const ts = Date.parse(muestra.ts);
    if (Number.isNaN(ts) || ts < inicio) continue;
    const actual = instantes.get(muestra.tick) ?? { tick: muestra.tick, ts: muestra.ts, ok: true };
    actual.ok = actual.ok && Boolean(muestra.ok);
    if (muestra.ts > actual.ts) actual.ts = muestra.ts;
    instantes.set(muestra.tick, actual);
  }
  const serie = [...instantes.values()].sort((a, b) => a.ts.localeCompare(b.ts));
  const criterio = `${estables} ciclos seguidos con todos los flujos evaluados en éxito`;
  if (serie.length === 0) {
    return { conclusion: "sin-muestras-tras-la-falla", rtoMs: null, inicioFalla, rtoMaximoMs: RTO_MAX_MS, criterio };
  }

  const primerFallo = serie.find((punto) => !punto.ok) ?? null;
  if (!primerFallo) {
    return {
      conclusion: "continuidad",
      rtoMs: null,
      inicioFalla,
      primerFallo: null,
      recuperacionEstable: null,
      duracionObservadaMs: Date.parse(serie.at(-1).ts) - inicio,
      criterio,
      rtoMaximoMs: RTO_MAX_MS,
    };
  }

  let recuperacion = null;
  for (let i = 0; i <= serie.length - estables; i += 1) {
    const ventana = serie.slice(i, i + estables);
    if (!ventana.every((punto) => punto.ok)) continue;
    if (serie.slice(0, i).some((punto) => !punto.ok)) {
      recuperacion = ventana[0];
      break;
    }
  }
  const finObservado = Date.parse(serie.at(-1).ts);
  if (!recuperacion) {
    return {
      conclusion: "no-recuperado",
      rtoMs: null,
      inicioFalla,
      primerFallo: primerFallo.ts,
      recuperacionEstable: null,
      duracionObservadaMs: finObservado - inicio,
      criterio,
      rtoMaximoMs: RTO_MAX_MS,
    };
  }
  const rtoMs = Date.parse(recuperacion.ts) - inicio;
  return {
    conclusion: "recuperado",
    rtoMs,
    inicioFalla,
    primerFallo: primerFallo.ts,
    recuperacionEstable: recuperacion.ts,
    duracionObservadaMs: finObservado - inicio,
    criterio,
    rtoMaximoMs: RTO_MAX_MS,
    cumpleRto: rtoMs <= RTO_MAX_MS,
  };
}
