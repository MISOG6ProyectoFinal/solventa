import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { NAMESPACE } from "./lib/constantes.mjs";
import { disponibilidadDe, escribirJson } from "./exportar-evidencias.mjs";

export async function ejecutarArq12(ctx) {
  const inicio = new Date().toISOString();
  ctx.estado.fase = "arq12-normal";
  ctx.bitacora.anotar("arq12-normal-inicio");
  await ctx.dormir(ctx.segundos("HA_NORMAL_S", 40) * 1000);
  ctx.bitacora.anotar("arq12-normal-fin");
  const normalCaptura = await ctx.capturar("grafana-normal.png");

  ctx.estado.fase = "arq12-rolling";
  ctx.bitacora.anotar("rolling-inicio", { deployment: "canales" });
  const reinicio = ctx.kubectl(["-n", NAMESPACE, "rollout", "restart", "deployment/canales"]);
  if (!reinicio.ok) throw new Error(`No se pudo reiniciar canales: ${reinicio.stderr.trim()}`);
  const seguimiento = await ctx.kubectlAsync(["-n", NAMESPACE, "rollout", "status", "deployment/canales", "--timeout=240s"]);
  await ctx.dormir(20_000);
  ctx.bitacora.anotar("rolling-fin", { ok: seguimiento.ok, detalle: seguimiento.ok ? "completado" : seguimiento.stderr.trim() });

  const muestras = ctx.leer().filter((muestra) => muestra.fase === "arq12-normal" || muestra.fase === "arq12-rolling");
  const disponibilidad = disponibilidadDe(muestras);
  const resultado = {
    experimento: "ARQ-12",
    ejecutado: true,
    inicio,
    fin: new Date().toISOString(),
    zonasSimuladas: ["ha-zone-a", "ha-zone-b"],
    rolling: { deployment: "canales", completado: seguimiento.ok },
    disponibilidad,
    sloMensualObjetivo: disponibilidad.sloMensualObjetivo,
    sloMensualDemostrado: false,
    capturas: [normalCaptura],
    limitacion: "La disponibilidad observada es solo la de esta ventana. No demuestra el 99,97 % mensual.",
  };
  escribirJson(ctx.salida, "arq12.json", resultado);
  writeFileSync(join(ctx.salida, "arq12-muestras.json"), `${JSON.stringify(muestras)}\n`);
  return resultado;
}
