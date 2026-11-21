import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { huecosNoObservados, resumirDisponibilidad } from "./lib/disponibilidad.mjs";
import { graficaDisponibilidad, graficaInfra, graficaLatencia, eventosDisponibilidad, eventosInfra, resumenArq12, resumenArq13, rtoDe } from "./lib/grafica.mjs";
import { INTERVALO_S, SERVICIOS_OMITIDOS, ZONA_A, ZONA_B } from "./lib/constantes.mjs";

const LIMITACIONES = [
  "Las zonas ha-zone-a y ha-zone-b son etiquetas de un clúster k3d en el mismo computador y el mismo Docker Desktop. No son zonas de disponibilidad físicas ni una prueba Multi-AZ de AWS.",
  "ARQ-13 mide la recuperación, no el RPO. La pérdida de datos se mide en el experimento de ASR-09 (ARQ-14).",
  "Una ventana de minutos no demuestra la disponibilidad mensual del 99,97 %.",
  "Detener el contenedor del worker reproduce una pérdida abrupta de cómputo en la zona simulada. El nodo de control, el operador de PostgreSQL y la observabilidad siguen en el mismo equipo.",
];

export function escribirJson(directorio, nombre, datos) {
  writeFileSync(join(directorio, nombre), `${JSON.stringify(datos, null, 2)}\n`);
}

function escribirSvg(directorio, nombre, dibujo) {
  const svg = join(directorio, nombre.replace(/\.png$/, ".svg"));
  const png = join(directorio, nombre.endsWith(".png") ? nombre : `${nombre}.png`);
  writeFileSync(svg, dibujo.svg);
  const captura = capturarGrafana(`file:///${svg.replaceAll("\\", "/")}`, png);
  return { ...dibujo, png: captura.ok, captura };
}

export function escribirGraficas(directorio, { muestras = [], eventos = [], arq12 = null, arq13 = null, infra = [] } = {}) {
  const generadas = [];
  const deArq12 = muestras.filter((muestra) => String(muestra.fase || "").startsWith("arq12"));
  const deArq13 = muestras.filter((muestra) => String(muestra.fase || "").startsWith("arq13"));
  if (deArq12.length) {
    const marcas = eventosDisponibilidad("arq12", eventos, arq12);
    generadas.push(["disponibilidad.png", escribirSvg(directorio, "disponibilidad.png", graficaDisponibilidad({
      titulo: "Disponibilidad HTTP durante el experimento ARQ-12",
      experimento: "Rolling update de canales. Zonas simuladas en el mismo equipo.",
      muestras: deArq12,
      eventos: marcas,
      resumen: resumenArq12(arq12),
    }))]);
    generadas.push(["latencia-arq12.png", escribirSvg(directorio, "latencia-arq12.png", graficaLatencia({
      titulo: "Latencia HTTP durante el experimento ARQ-12",
      experimento: "Rolling update de canales.",
      muestras: deArq12,
      eventos: marcas,
    }))]);
  }
  if (deArq13.length) {
    const marcas = eventosDisponibilidad("arq13", eventos, arq13);
    const rto = rtoDe(arq13);
    const resumen = resumenArq13(arq13);
    if (rto) resumen.push("La franja rosa va del inicio de la falla a la recuperación estable. No es el intervalo desde el primer fallo.");
    generadas.push(["recuperacion.png", escribirSvg(directorio, "recuperacion.png", graficaDisponibilidad({
      titulo: "Disponibilidad HTTP durante el experimento ARQ-13",
      experimento: "Pérdida de la zona simulada ha-zone-a.",
      muestras: deArq13,
      eventos: marcas,
      resumen,
      rto,
    }))]);
    generadas.push(["latencia-arq13.png", escribirSvg(directorio, "latencia-arq13.png", graficaLatencia({
      titulo: "Latencia HTTP durante el experimento ARQ-13",
      experimento: "Pérdida de la zona simulada ha-zone-a.",
      muestras: deArq13,
      eventos: marcas,
    }))]);
    if (infra.length) {
      generadas.push(["infraestructura-arq13.png", escribirSvg(directorio, "infraestructura-arq13.png", graficaInfra({
        titulo: "Infraestructura durante ARQ-13",
        muestras: infra,
        eventos: eventosInfra(infra, eventos, arq13),
      }))]);
    }
  }
  return generadas;
}

export function capturarGrafana(url, destino) {
  const navegador = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  ].find((ruta) => existsSync(ruta));
  if (!navegador) return { ok: false, motivo: "No hay Edge ni Chrome para capturar Grafana." };
  mkdirSync(join(destino, ".."), { recursive: true });
  const resultado = spawnSync(
    navegador,
    ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--window-size=1600,1200", `--screenshot=${destino}`, "--virtual-time-budget=20000", url],
    { encoding: "utf8", timeout: 60_000 },
  );
  if (!existsSync(destino) || statSync(destino).size < 5000) {
    return { ok: false, motivo: resultado.stderr?.trim() || "La captura no se generó o quedó vacía." };
  }
  return { ok: true, motivo: null };
}

export function escribirResumen(directorio, datos) {
  const arq12 = datos.arq12;
  const arq13 = datos.arq13;
  const lineas = [
    `# HA-TEST local ${datos.runId}`,
    "",
    `- Fecha: ${datos.inicio}`,
    `- Duración: ${datos.duracionMs} ms`,
    `- Zonas simuladas: ${ZONA_A}, ${ZONA_B}, en el mismo equipo`,
    `- Servicios evaluados: ${(datos.servicios || []).join(", ") || "sin registrar"}`,
    `- Servicios no desplegados: ${Object.entries(SERVICIOS_OMITIDOS).map(([nombre, motivo]) => `${nombre} (${motivo})`).join(" ")}`,
    "",
    "## ARQ-12",
    "",
    arq12?.ejecutado
      ? `Disponibilidad observada ${pct(arq12.disponibilidad?.disponibilidadObservada)} sobre ${arq12.disponibilidad?.total ?? 0} ciclos (${arq12.disponibilidad?.exitos ?? 0} éxitos, ${arq12.disponibilidad?.fallos ?? 0} fallos). El objetivo mensual es 99,97 % y esta ventana no lo demuestra.`
      : "No se ejecutó.",
    "",
    "## ARQ-13",
    "",
  ];
  if (!arq13?.ejecutado) {
    lineas.push(`No se provocó la falla. ${arq13?.motivo || "Faltó una precondición."}`);
  } else {
    lineas.push(`Nodo interrumpido: ${arq13.nodo?.nombre || "sin dato"} (${arq13.nodo?.id || "sin id"}), zona ${ZONA_A}.`);
    lineas.push(`Primario antes: ${fmtPg(arq13.primarioAntes)}. Primario después de la falla: ${fmtPg(arq13.primarioDespues)}.`);
    lineas.push(`Conclusión: ${arq13.recuperacion?.conclusion}. RTO: ${arq13.recuperacion?.rtoMs == null ? "sin valor" : `${arq13.recuperacion.rtoMs} ms`}.`);
    lineas.push(`Disponibilidad durante la falla: ${pct(arq13.disponibilidad?.disponibilidadObservada)}.`);
    if (arq13.recuperacion?.conclusion === "continuidad") {
      lineas.push("No hubo ciclos fallidos tras la marca de la falla. El RTO queda vacío; no se informa cero.");
    }
  }
  const huecos = datos.huecos ?? [];
  lineas.push("", "## Ventanas no observadas", "");
  if (!huecos.length) lineas.push("El monitor no dejó huecos mayores que el intervalo de muestreo.");
  else huecos.forEach((hueco) => lineas.push(`- ${hueco.desde} → ${hueco.hasta} (${hueco.ms} ms). No se cuenta como disponible.`));
  lineas.push("", "## Limitaciones", "");
  LIMITACIONES.forEach((texto) => lineas.push(`- ${texto}`));
  if (datos.capturas?.length) {
    lineas.push("", "## Capturas", "");
    datos.capturas.forEach((captura) => lineas.push(`- ${captura.archivo}: ${captura.ok ? "generada" : captura.motivo}`));
  }
  writeFileSync(join(directorio, "resumen.md"), `${lineas.join("\n")}\n`);
}

export function disponibilidadDe(muestras) {
  return {
    ...resumirDisponibilidad(muestras),
    huecos: huecosNoObservados(muestras, INTERVALO_S * 1000),
  };
}

function pct(valor) {
  return valor == null ? "sin muestras" : `${(valor * 100).toFixed(2)} %`;
}

function fmtPg(estado) {
  if (!estado?.instancia) return "no identificado";
  return `${estado.instancia} en ${estado.zona || "zona desconocida"}`;
}
