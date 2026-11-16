import { spawnSync } from "node:child_process";
import { appendFileSync, chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { INTERVALO_S, PUERTO_PUSH } from "./lib/constantes.mjs";
import { empujar, exposicionSondas } from "./lib/metricas.mjs";
import { sondasDe } from "./lib/sondas.mjs";

const args = process.argv.slice(2);

function opcion(nombre, defecto) {
  const indice = args.indexOf(nombre);
  if (indice === -1) return defecto;
  return args[indice + 1];
}

function duracionMs(texto) {
  const valor = String(texto ?? "30s");
  const match = /^(\d+)(ms|s|m)?$/.exec(valor);
  if (!match) throw new Error(`Duración no válida: ${valor}`);
  const n = Number(match[1]);
  if (match[2] === "m") return n * 60_000;
  if (match[2] === "ms") return n;
  return n * 1000;
}

const VIDA_MS = { operador: 7 * 60 * 60 * 1000, movil: 6 * 24 * 60 * 60 * 1000 };

export function motivoTransporte(codigo) {
  return { 6: "dns", 7: "red", 28: "tiempo-agotado", 60: "tls" }[codigo] ?? "red";
}

function curl(configuracion) {
  const dir = mkdtempSync(join(tmpdir(), "solventa-sonda-"));
  const config = join(dir, "curl.cfg");
  const cuerpo = join(dir, "cuerpo.txt");
  writeFileSync(config, configuracion.replaceAll("{{cuerpo}}", cuerpo.replaceAll("\\", "/")));
  try {
    chmodSync(config, 0o600);
  } catch {
    // En Windows el modo Unix no restringe el archivo; se borra al terminar.
  }
  const inicio = performance.now();
  const binario = process.platform === "win32" ? "curl.exe" : "curl";
  const resultado = spawnSync(binario, ["-sS", "--config", config], { encoding: "utf8" });
  const latency_ms = Math.round(performance.now() - inicio);
  try {
    if (resultado.status !== 0) {
      return { status: null, body: "", latency_ms, error: motivoTransporte(resultado.status), origen: "cliente" };
    }
    const codigo = Number((resultado.stdout ?? "").trim().split(/\s+/)[0]);
    return { status: codigo, body: readFileSync(cuerpo, "utf8"), latency_ms, origen: "aplicacion" };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function pedir(url, headers) {
  const lineas = [
    `url = "${url}"`,
    "max-time = 8",
    'output = "{{cuerpo}}"',
    'write-out = "%{http_code} %{time_total}"',
    ...Object.entries(headers).map(([clave, valor]) => `header = "${clave}: ${String(valor).replaceAll('"', "")}"`),
  ];
  return curl(lineas.join("\n"));
}

export async function sesion(baseUrl, ruta, cuerpo) {
  const dir = mkdtempSync(join(tmpdir(), "solventa-sesion-"));
  const datos = join(dir, "datos.json");
  try {
    writeFileSync(datos, JSON.stringify(cuerpo));
    const respuesta = curl(
      [
        "request = POST",
        `url = "${baseUrl}${ruta}"`,
        "max-time = 10",
        'header = "content-type: application/json"',
        `data-binary = "@${datos.replaceAll("\\", "/")}"`,
        'output = "{{cuerpo}}"',
        'write-out = "%{http_code}"',
      ].join("\n"),
    );
    if (respuesta.origen === "cliente") throw new Error(`No se pudo abrir la sesión (${respuesta.error}).`);
    if (respuesta.status !== 200) throw new Error(`La sesión respondió ${respuesta.status}.`);
    const json = JSON.parse(respuesta.body);
    if (!json.token) throw new Error("La sesión no devolvió token.");
    return json.token;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function vigilar({
  baseUrl,
  salida,
  runId,
  duracion,
  intervaloMs,
  zonaAfectada = null,
  fase = "medicion",
  pushgateway = null,
  detener = () => false,
  env = process.env,
  ahora = () => new Date(),
  dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms)),
} = {}) {
  const sondas = sondasDe(env);
  mkdirSync(salida, { recursive: true });
  const jsonl = join(salida, "monitor.jsonl");
  const tokens = {};
  const emitido = {};
  const acumulado = {};
  const limite = ahora().getTime() + duracion;
  let muestrasEscritas = 0;
  let pushAvisado = false;

  async function tokenDe(tipo) {
    if (tokens[tipo] && Date.now() - emitido[tipo] < VIDA_MS[tipo]) return tokens[tipo];
    const credencial = tipo === "operador"
      ? { ruta: "/web/sesiones", cuerpo: { correo: env.OPERADOR_CORREO, contrasena: env.OPERADOR_CONTRASENA } }
      : { ruta: "/movil/sesiones", cuerpo: { correo: env.MOVIL_CORREO, contrasena: env.MOVIL_CONTRASENA } };
    tokens[tipo] = await sesion(baseUrl, credencial.ruta, credencial.cuerpo);
    emitido[tipo] = Date.now();
    return tokens[tipo];
  }

  while (ahora().getTime() < limite && !detener()) {
    const tick = new Date().toISOString();
    const zona = typeof zonaAfectada === "function" ? zonaAfectada() : zonaAfectada;
    const faseActual = typeof fase === "function" ? fase() : fase;
    const porFlujo = new Map();
    for (const sonda of sondas) {
      const headers = { ...(sonda.headers ?? {}) };
      let authError = null;
      if (sonda.auth) {
        try {
          headers.authorization = `Bearer ${await tokenDe(sonda.auth)}`;
        } catch {
          authError = true;
        }
      }
      let respuesta = authError
        ? { status: null, body: "", latency_ms: 0, origen: "aplicacion", error: "sesion" }
        : pedir(`${baseUrl}${sonda.endpoint}`, headers);
      let renovado = false;
      if (respuesta.status === 401 && sonda.auth) {
        delete tokens[sonda.auth];
        try {
          headers.authorization = `Bearer ${await tokenDe(sonda.auth)}`;
          respuesta = pedir(`${baseUrl}${sonda.endpoint}`, headers);
          renovado = true;
        } catch {
          respuesta = { status: null, body: "", latency_ms: respuesta.latency_ms, origen: "aplicacion", error: "sesion" };
        }
      }
      const evaluacion = respuesta.origen === "cliente"
        ? { ok: false, motivo: respuesta.error }
        : sonda.evaluar(respuesta.status, respuesta.body);
      const registro = {
        ts: new Date().toISOString(),
        tick,
        flow: sonda.flow,
        endpoint: sonda.endpoint.split("?")[0],
        ok: evaluacion.ok,
        status: respuesta.status,
        latency_ms: respuesta.latency_ms,
        run_id: runId,
        affected_zone: zona,
        alcance: sonda.alcance,
        motivo: evaluacion.motivo,
        origen: respuesta.origen,
        fase: faseActual,
        token_renovado: renovado,
      };
      appendFileSync(jsonl, `${JSON.stringify(registro)}\n`);
      muestrasEscritas += 1;
      const grupo = porFlujo.get(sonda.flow) ?? { ok: true, latencia: null };
      grupo.ok = grupo.ok && evaluacion.ok;
      if (evaluacion.ok && Number.isFinite(respuesta.latency_ms)) {
        grupo.latencia = Math.max(grupo.latencia ?? 0, respuesta.latency_ms);
      }
      porFlujo.set(sonda.flow, grupo);
    }
    if (pushgateway) {
      const publicado = await empujar(`${pushgateway}/metrics/job/ha_monitor`, exposicionSondas(
        [...porFlujo].map(([flow, grupo]) => {
          const total = (acumulado[flow] ??= { exitos: 0, fallos: 0 });
          if (grupo.ok) total.exitos += 1;
          else total.fallos += 1;
          return { flow, up: grupo.ok, latenciaMs: grupo.ok ? grupo.latencia : null, exitos: total.exitos, fallos: total.fallos };
        }),
      ));
      if (!publicado && !pushAvisado) {
        pushAvisado = true;
        appendFileSync(
          jsonl,
          `${JSON.stringify({
            ts: new Date().toISOString(),
            tick,
            flow: "monitor",
            endpoint: pushgateway,
            ok: false,
            status: null,
            latency_ms: null,
            run_id: runId,
            alcance: "no-observado",
            origen: "monitor",
            fase: faseActual,
            motivo: "pushgateway-no-disponible",
          })}\n`,
        );
      }
    }
    if (ahora().getTime() + intervaloMs >= limite) break;
    await dormir(intervaloMs);
  }

  if (!sondas.some((sonda) => sonda.flow === "siniestros")) {
    appendFileSync(
      jsonl,
      `${JSON.stringify({
        ts: new Date().toISOString(),
        tick: "sin-credenciales",
        flow: "siniestros",
        endpoint: "/movil/siniestros",
        ok: false,
        status: null,
        latency_ms: null,
        run_id: runId,
        affected_zone: null,
        alcance: "no-evaluado",
        origen: "no-evaluado",
        fase: typeof fase === "function" ? fase() : fase,
        motivo: "Faltan MOVIL_CORREO y MOVIL_CONTRASENA. No se cuenta como caída ni como disponibilidad.",
      })}\n`,
    );
  }
  return {
    jsonl,
    muestrasEscritas,
    sondas: sondas.map(({ flow, endpoint, alcance }) => ({ flow, endpoint: endpoint.split("?")[0], alcance })),
  };
}

async function main() {
  const baseUrl = (opcion("--base-url", process.env.BASE_URL) ?? "").replace(/\/$/, "");
  if (!baseUrl) {
    console.error("Falta --base-url o BASE_URL.");
    process.exit(1);
  }
  const runId = opcion("--run-id", `monitor-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  const salida = opcion("--salida", join(process.cwd(), runId));
  const resultado = await vigilar({
    baseUrl,
    salida,
    runId,
    duracion: duracionMs(opcion("--duracion", "30s")),
    intervaloMs: Number(opcion("--intervalo", String(INTERVALO_S))) * 1000,
    zonaAfectada: opcion("--zona-afectada", null),
    fase: opcion("--fase", "medicion"),
    pushgateway: args.includes("--pushgateway") ? opcion("--pushgateway", `http://127.0.0.1:${PUERTO_PUSH}`) : null,
  });
  console.log(JSON.stringify({ runId, ...resultado }, null, 2));
}

if (process.argv[1] && process.argv[1].endsWith("monitor.mjs")) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
