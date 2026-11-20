import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const INICIO = "<!-- resultados:inicio -->";
export const FIN = "<!-- resultados:fin -->";

const APROBADO = new Set(["approved", "aprobado"]);

/**
 * Compares what the client saw confirmed with what the database and the gateway hold.
 * cliente: [{ clave, referencia, http, estado }], filas: [{ idempotency_key, estado }], cargos: [{ referencia, status }].
 * The gateway's `referencia` is the idempotency key; the client log maps it to the payment reference.
 */
export function compararEvidencia({ cliente, filas, cargos }) {
  const confirmados = new Map();
  const referenciaDe = new Map();
  for (const registro of cliente) {
    referenciaDe.set(registro.clave, registro.referencia);
    if (registro.http === 200 && registro.estado) confirmados.set(registro.clave, registro.estado);
  }
  const enBase = new Map(filas.map((fila) => [fila.idempotency_key, fila.estado]));
  const perdidas = [...confirmados].filter(([clave, estado]) => enBase.get(clave) !== estado).map(([clave]) => clave);

  const aprobadosPorReferencia = new Map();
  for (const cargo of cargos) {
    if (!APROBADO.has(String(cargo.status).toLowerCase())) continue;
    const referencia = referenciaDe.get(cargo.referencia);
    if (!referencia) continue;
    aprobadosPorReferencia.set(referencia, (aprobadosPorReferencia.get(referencia) ?? 0) + 1);
  }
  const duplicados = [...aprobadosPorReferencia].filter(([, total]) => total > 1).map(([referencia]) => referencia);
  const atascados = filas.filter((fila) => fila.estado === "procesando").map((fila) => fila.idempotency_key);

  return {
    confirmadas: confirmados.size,
    perdidas,
    duplicados,
    atascados,
    cumple: perdidas.length === 0 && duplicados.length === 0 && atascados.length === 0,
  };
}

export function agregarCorrida(ruta, corrida) {
  const corridas = existsSync(ruta) ? JSON.parse(readFileSync(ruta, "utf8")) : [];
  corridas.push(corrida);
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, `${JSON.stringify(corridas, null, 2)}\n`);
  return corridas;
}

export function bloqueResultados(corridas) {
  const filas = corridas.map((corrida, indice) => [
    indice + 1,
    corrida.fecha,
    corrida.control ? "Control (asíncrona)" : "Síncrona",
    corrida.zona,
    corrida.confirmadas,
    corrida.perdidas,
    corrida.duplicados,
    corrida.atascados,
    corrida.cumple ? "Sí" : "No",
  ]);
  const evaluadas = corridas.filter((corrida) => !corrida.control);
  const cumplen = evaluadas.filter((corrida) => corrida.cumple).length;
  const suma = (campo) => evaluadas.reduce((total, corrida) => total + corrida[campo], 0);
  return [
    "| # | Fecha | Replicación | Zona detenida | Confirmadas | Perdidas | Duplicadas | Atascadas | Cumple |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...filas.map((fila) => `| ${fila.join(" | ")} |`),
    "",
    `**${cumplen} de ${evaluadas.length} corridas cumplen** con replicación síncrona: ${suma("confirmadas")} cobros confirmados, ${suma("perdidas")} perdidos, ${suma("duplicados")} duplicados y ${suma("atascados")} atascados. Las corridas de control no cuentan para el resultado.`,
    "",
    "![Cobros confirmados, perdidos y duplicados por corrida](asr09/perdida-duplicados.svg)",
  ].join("\n");
}

export function reemplazarBloque(texto, bloque) {
  const inicio = texto.indexOf(INICIO);
  const fin = texto.indexOf(FIN);
  if (inicio < 0 || fin < inicio) throw new Error(`El informe no tiene los marcadores ${INICIO} y ${FIN}.`);
  return `${texto.slice(0, inicio + INICIO.length)}\n${bloque}\n${texto.slice(fin)}`;
}

export function graficaCorridas(corridas) {
  const ancho = 760;
  const alto = 320;
  const margen = { izq: 60, der: 20, arriba: 40, abajo: 60 };
  const maximo = Math.max(1, ...corridas.map((corrida) => corrida.confirmadas));
  const grupo = (ancho - margen.izq - margen.der) / Math.max(1, corridas.length);
  const barra = Math.max(4, Math.min(24, grupo / 4));
  const y = (valor) => alto - margen.abajo - (valor / maximo) * (alto - margen.arriba - margen.abajo);
  const series = [
    ["confirmadas", "#2b6cb0", "Confirmadas"],
    ["perdidas", "#c53030", "Perdidas"],
    ["duplicados", "#d69e2e", "Duplicadas"],
  ];
  const barras = corridas.flatMap((corrida, indice) => {
    const x0 = margen.izq + indice * grupo + (grupo - barra * series.length) / 2;
    const rects = series.map(([campo, color], s) => {
      const valor = corrida[campo];
      return `<rect x="${x0 + s * barra}" y="${y(valor)}" width="${barra - 1}" height="${alto - margen.abajo - y(valor)}" fill="${color}"><title>${campo}: ${valor}</title></rect>`;
    });
    const etiqueta = `${indice + 1}${corrida.control ? " (c)" : ""}`;
    return [...rects, `<text x="${x0 + (barra * series.length) / 2}" y="${alto - margen.abajo + 18}" text-anchor="middle" font-size="12">${etiqueta}</text>`];
  });
  const leyenda = series.map(([, color, nombre], s) =>
    `<rect x="${margen.izq + s * 130}" y="12" width="12" height="12" fill="${color}"/><text x="${margen.izq + s * 130 + 18}" y="22" font-size="12">${nombre}</text>`);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" font-family="sans-serif">`,
    `<rect width="${ancho}" height="${alto}" fill="#fff"/>`,
    ...leyenda,
    `<line x1="${margen.izq}" y1="${alto - margen.abajo}" x2="${ancho - margen.der}" y2="${alto - margen.abajo}" stroke="#444"/>`,
    `<text x="${margen.izq - 8}" y="${y(maximo) + 4}" text-anchor="end" font-size="12">${maximo}</text>`,
    `<text x="${margen.izq - 8}" y="${alto - margen.abajo + 4}" text-anchor="end" font-size="12">0</text>`,
    ...barras,
    `<text x="${ancho / 2}" y="${alto - 16}" text-anchor="middle" font-size="12">Corrida (c = control con replicación asíncrona)</text>`,
    "</svg>",
  ].join("\n");
}

/** Appends the run and refreshes the chart and the results block of docs/ASR-09.md. */
export function registrar({ resultados, grafica, informe }, corrida) {
  const corridas = agregarCorrida(resultados, corrida);
  writeFileSync(grafica, `${graficaCorridas(corridas)}\n`);
  writeFileSync(informe, reemplazarBloque(readFileSync(informe, "utf8"), bloqueResultados(corridas)));
  return corridas;
}
