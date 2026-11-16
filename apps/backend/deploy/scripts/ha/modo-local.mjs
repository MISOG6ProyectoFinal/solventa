/**
 * HA-TEST local.
 *   node deploy/scripts/ha/modo-local.mjs activar
 *   node deploy/scripts/ha/modo-local.mjs probar
 *   node deploy/scripts/ha/modo-local.mjs desactivar
 *
 * Las zonas son etiquetas de k3d en este computador. No crea recursos de AWS.
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, statfsSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { freemem, tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as dormir } from "node:timers/promises";
import { ejecutarArq12 } from "./experimento-arq12.mjs";
import { ejecutarArq13 } from "./experimento-arq13.mjs";
import { capturarGrafana, disponibilidadDe, escribirGraficas, escribirResumen } from "./exportar-evidencias.mjs";
import { iniciarColector } from "./lib/colector.mjs";
import {
  CLUSTER,
  CLUSTER_PG,
  CNPG_MANIFIESTO,
  COMPOSE_PROYECTO,
  IMAGEN_POSTGRES,
  INTERVALO_S,
  MOVIL_CORREO,
  NAMESPACE,
  OPERADOR_CONTRASENA,
  OPERADOR_CORREO,
  PUERTO_API,
  PUERTO_GRAFANA,
  PUERTO_KSM,
  PUERTO_PROMETHEUS,
  PUERTO_PUSH,
  SERVICIOS_CRITICOS,
  SERVICIOS_IMAGEN,
  SERVICIOS_OMITIDOS,
  TAG,
  ZONA_A,
  ZONA_B,
  ZONA_CONTROL,
} from "./lib/constantes.mjs";
import { leerMuestras } from "./lib/disponibilidad.mjs";
import { crearBitacora } from "./lib/eventos.mjs";
import { kubeconfigLocal, kubectl, kubectlAsync, kubectlJson } from "./lib/kube.mjs";
import { nodosDesde, podsDesde, postgresDesde } from "./lib/estado.mjs";
import { vigilar } from "./monitor.mjs";
import { ejecutar } from "./lib/proceso.mjs";
import { ajenosSiguen, esRecursoHa, evaluarRecursos } from "./lib/proteccion.mjs";
import { backend, credencialesPath, evidenciasRaiz, kubeconfigPath, observabilidad, overlayHa } from "./lib/rutas.mjs";

const PROGRAMA_ADMIN = `
import json, sys
from pydantic import ValidationError
from solventa_common.db import build_engine
from identidad.config import settings
from identidad.operadores.adapters.repository import PostgresOperatorRepository
from identidad.operadores.domain.models import EmailTaken, NewOperator
from identidad.operadores.domain.use_cases import CreateOperator
datos = json.load(sys.stdin)
if not settings.database_url:
    sys.exit("Identidad no tiene base de datos configurada")
operadores = PostgresOperatorRepository(build_engine(settings.database_url))
operadores.create_schema()
try:
    creado = CreateOperator(operadores).execute(NewOperator(roles=["administrador"], **datos))
except EmailTaken:
    print(f"{datos['correo']} ya existe; se deja como está")
except ValidationError as error:
    sys.exit("; ".join(detalle["msg"] for detalle in error.errors()))
else:
    print(f"Administrador {creado.correo} creado")
`;

const PUERTOS = [PUERTO_API, PUERTO_KSM, PUERTO_GRAFANA, PUERTO_PROMETHEUS, PUERTO_PUSH];
const comando = process.argv[2];

function k3d() {
  const local = join(process.env.LOCALAPPDATA || "", "k3d", "k3d.exe");
  return existsSync(local) ? local : "k3d";
}

function segundos(nombre, defecto) {
  const valor = Number(process.env[nombre]);
  return Number.isFinite(valor) && valor > 0 ? valor : defecto;
}

function puertoLibre(puerto) {
  return new Promise((resolver) => {
    const servidor = createServer();
    servidor.once("error", () => resolver(false));
    servidor.listen(puerto, "127.0.0.1", () => servidor.close(() => resolver(true)));
  });
}

function nodosDelCluster() {
  return listarContenedores()
    .filter((contenedor) => contenedor.etiquetas["k3d.cluster"] === CLUSTER && ["server", "agent"].includes(contenedor.etiquetas["k3d.role"]))
    .map((contenedor) => contenedor.nombre);
}

function importarImagen(imagen) {
  console.log(imagen);
  const directo = ejecutar(k3d(), ["image", "import", imagen, "-c", CLUSTER, "--mode", "direct"]);
  if (directo.ok) return;
  console.log(`Importación directa incompleta. Copiando ${imagen} nodo por nodo.`);
  const tar = join(tmpdir(), `solventa-ha-${randomBytes(4).toString("hex")}.tar`);
  const guardado = ejecutar("docker", ["save", "-o", tar, imagen]);
  if (!guardado.ok) throw new Error(guardado.stderr.trim() || `No se empaquetó ${imagen}`);
  try {
    for (const nodo of nodosDelCluster()) {
      const copia = ejecutar("docker", ["cp", tar, `${nodo}:/tmp/ha-image.tar`]);
      if (!copia.ok) throw new Error(copia.stderr.trim() || `No se copió ${imagen} a ${nodo}`);
      const carga = ejecutar("docker", ["exec", nodo, "ctr", "-n", "k8s.io", "images", "import", "/tmp/ha-image.tar"]);
      ejecutar("docker", ["exec", nodo, "rm", "-f", "/tmp/ha-image.tar"]);
      if (!carga.ok) throw new Error(carga.stderr.trim() || `No se importó ${imagen} en ${nodo}`);
    }
  } finally {
    rmSync(tar, { force: true });
  }
}

function listarContenedores() {
  const ids = ejecutar("docker", ["ps", "-aq"]);
  if (!ids.ok) throw new Error(ids.stderr.trim() || "docker ps falló");
  const lista = ids.stdout.trim().split(/\s+/).filter(Boolean);
  if (!lista.length) return [];
  const detalle = ejecutar("docker", ["inspect", ...lista]);
  if (!detalle.ok) throw new Error(detalle.stderr.trim());
  return JSON.parse(detalle.stdout).map((info) => ({
    id: info.Id,
    nombre: String(info.Name || "").replace(/^\//, ""),
    etiquetas: info.Config?.Labels || {},
    estado: info.State?.Status || "",
  }));
}

function clusterExiste() {
  const resultado = ejecutar(k3d(), ["cluster", "list", "-o", "json"]);
  if (!resultado.ok || !resultado.stdout.trim()) return false;
  const lista = JSON.parse(resultado.stdout);
  const items = Array.isArray(lista) ? lista : [];
  return items.some((item) => item.name === CLUSTER);
}

async function preflight(exigirPuertos) {
  for (const [comandoBin, args] of [["docker", ["info"]], ["kubectl", ["version", "--client"]], [k3d(), ["version"]]]) {
    const resultado = ejecutar(comandoBin, args);
    if (!resultado.ok) throw new Error(`No está disponible ${comandoBin}: ${resultado.stderr.trim()}`);
  }
  const memoriaDocker = Number(ejecutar("docker", ["info", "--format", "{{.MemTotal}}"]).stdout.trim());
  const disco = statfsSync(backend.slice(0, 3));
  const ocupados = [];
  if (exigirPuertos) {
    for (const puerto of PUERTOS) {
      if (!(await puertoLibre(puerto))) ocupados.push(puerto);
    }
  }
  const evaluacion = evaluarRecursos({
    dockerMemBytes: memoriaDocker,
    hostFreeBytes: freemem(),
    diskFreeBytes: Number(disco.bavail) * Number(disco.bsize),
    puertosOcupados: ocupados,
    clusterExistente: !exigirPuertos,
  });
  evaluacion.avisos.forEach((aviso) => console.log(aviso));
  if (!evaluacion.ok) throw new Error(evaluacion.bloqueos.join(" "));
  return evaluacion;
}

async function asegurarImagenes() {
  const necesarias = [
    ...SERVICIOS_IMAGEN.map((servicio) => `solventa/${servicio}:${TAG}`),
    IMAGEN_POSTGRES,
    "registry.k8s.io/kube-state-metrics/kube-state-metrics:v2.15.0",
  ];
  for (const imagen of necesarias) {
    if (ejecutar("docker", ["image", "inspect", imagen]).ok) continue;
    if (imagen.startsWith("solventa/")) {
      const servicio = imagen.split("/")[1].split(":")[0];
      console.log(`Construyendo ${imagen}`);
      const build = ejecutar("docker", ["build", "--build-arg", `SERVICE=${servicio}`, "-t", imagen, "."], { cwd: backend });
      if (!build.ok) throw new Error(build.stderr.trim() || `No se construyó ${imagen}`);
    } else {
      console.log(`Descargando ${imagen}`);
      const pull = ejecutar("docker", ["pull", imagen]);
      if (!pull.ok) throw new Error(pull.stderr.trim() || `No se descargó ${imagen}`);
    }
  }
  return necesarias;
}

function escribirKubeconfig() {
  const resultado = ejecutar(k3d(), ["kubeconfig", "get", CLUSTER]);
  if (!resultado.ok) throw new Error(resultado.stderr.trim() || "No se obtuvo el kubeconfig");
  mkdirSync(join(kubeconfigPath, ".."), { recursive: true });
  writeFileSync(kubeconfigPath, kubeconfigLocal(resultado.stdout));
}

function etiquetarNodos() {
  const nodos = kubectlJson(["get", "nodes"]).items;
  const agentes = nodos.filter((nodo) => nodo.metadata.name.includes("-agent-")).sort((a, b) => a.metadata.name.localeCompare(b.metadata.name));
  const servidores = nodos.filter((nodo) => nodo.metadata.name.includes("-server-"));
  if (agentes.length !== 2 || servidores.length < 1) {
    throw new Error(`Se esperaban 2 agents y 1 server. Hay ${agentes.length} agents y ${servidores.length} servers.`);
  }
  const pares = [[agentes[0].metadata.name, ZONA_A], [agentes[1].metadata.name, ZONA_B], ...servidores.map((nodo) => [nodo.metadata.name, ZONA_CONTROL])];
  for (const [nombre, zona] of pares) {
    const resultado = kubectl(["label", "node", nombre, `topology.kubernetes.io/zone=${zona}`, "--overwrite"]);
    if (!resultado.ok) throw new Error(resultado.stderr.trim());
  }
}

function anclarSistema() {
  for (const [ns, nombre] of [["kube-system", "traefik"], ["kube-system", "coredns"], ["kube-system", "local-path-provisioner"], ["kube-system", "metrics-server"]]) {
    const existe = kubectl(["-n", ns, "get", "deploy", nombre]);
    if (!existe.ok) continue;
    const parche = JSON.stringify({
      spec: {
        template: {
          spec: {
            nodeSelector: { "node-role.kubernetes.io/control-plane": "true" },
            tolerations: [{ key: "node-role.kubernetes.io/control-plane", operator: "Exists", effect: "NoSchedule" }],
          },
        },
      },
    });
    const aplicado = kubectl(["-n", ns, "patch", "deploy", nombre, "--type", "merge", "-p", parche]);
    if (!aplicado.ok) throw new Error(aplicado.stderr.trim());
    const reinicio = kubectl(["-n", ns, "rollout", "restart", `deploy/${nombre}`]);
    if (!reinicio.ok) throw new Error(reinicio.stderr.trim());
    const listo = kubectl(["-n", ns, "rollout", "status", `deploy/${nombre}`, "--timeout=180s"]);
    if (!listo.ok) throw new Error(listo.stderr.trim());
  }
}

function instalarOperador() {
  const aplicado = kubectl(["apply", "--server-side", "--force-conflicts", "-f", CNPG_MANIFIESTO]);
  if (!aplicado.ok) throw new Error(aplicado.stderr.trim() || aplicado.stdout.trim());
  const parche = JSON.stringify({
    spec: {
      template: {
        spec: {
          nodeSelector: { "node-role.kubernetes.io/control-plane": "true" },
          tolerations: [{ key: "node-role.kubernetes.io/control-plane", operator: "Exists", effect: "NoSchedule" }],
        },
      },
    },
  });
  const deployment = kubectl(["-n", "cnpg-system", "patch", "deploy", "cnpg-controller-manager", "--type", "merge", "-p", parche]);
  if (!deployment.ok) throw new Error(deployment.stderr.trim());
  const listo = kubectl(["-n", "cnpg-system", "rollout", "status", "deploy/cnpg-controller-manager", "--timeout=240s"]);
  if (!listo.ok) throw new Error(listo.stderr.trim());
}

function asegurarSecretoSesion() {
  kubectl(["create", "namespace", NAMESPACE, "--dry-run=client", "-o", "yaml"]);
  const manifiesto = kubectl(["create", "namespace", NAMESPACE, "--dry-run=client", "-o", "yaml"]);
  if (manifiesto.ok) kubectl(["apply", "-f", "-"], { input: manifiesto.stdout });
  if (kubectl(["-n", NAMESPACE, "get", "secret", "sesion"]).ok) return;
  const creado = kubectl(["-n", NAMESPACE, "create", "secret", "generic", "sesion", `--from-literal=SESION_SECRETO=${randomBytes(32).toString("hex")}`]);
  if (!creado.ok) throw new Error(creado.stderr.trim());
}

async function aplicarOverlay() {
  let ultimo = null;
  for (let intento = 1; intento <= 6; intento += 1) {
    ultimo = kubectl(["apply", "-k", overlayHa]);
    if (ultimo.ok) return;
    await dormir(5000);
  }
  throw new Error(ultimo?.stderr.trim() || ultimo?.stdout.trim() || "kustomize apply falló");
}

function foto() {
  const nodos = nodosDesde(kubectlJson(["get", "nodes"]));
  const pods = podsDesde(kubectlJson(["-n", NAMESPACE, "get", "pods"]), nodos);
  const pgPods = podsDesde(kubectlJson(["-n", NAMESPACE, "get", "pods", "-l", `cnpg.io/cluster=${CLUSTER_PG}`]), nodos);
  let cluster = {};
  try {
    cluster = kubectlJson(["-n", NAMESPACE, "get", "cluster", CLUSTER_PG]);
  } catch {
    cluster = {};
  }
  let podsSistema = [];
  try {
    podsSistema = podsDesde(kubectlJson(["-n", "cnpg-system", "get", "pods"]), nodos);
  } catch {
    podsSistema = [];
  }
  return { nodos, pods, postgres: postgresDesde(pgPods, cluster), podsSistema };
}

async function consultarPrometheus(expr) {
  const consulta = await httpJson(`http://127.0.0.1:${PUERTO_PROMETHEUS}/api/v1/query?query=${encodeURIComponent(expr)}`);
  const series = consulta.cuerpo?.data?.result;
  return Array.isArray(series) ? series.length : 0;
}

async function httpJson(url, opciones) {
  try {
    const respuesta = await fetch(url, opciones);
    const texto = await respuesta.text();
    let cuerpo = null;
    try {
      cuerpo = JSON.parse(texto);
    } catch {
      cuerpo = texto.slice(0, 180);
    }
    return { ok: respuesta.ok, status: respuesta.status, cuerpo };
  } catch (error) {
    return { ok: false, status: null, error: error.message };
  }
}

async function asegurarUsuarios(baseUrl) {
  const admin = kubectl(["-n", NAMESPACE, "exec", "-i", "deploy/identidad", "-c", "identidad", "--", "python", "-c", PROGRAMA_ADMIN], {
    input: JSON.stringify({ correo: OPERADOR_CORREO, nombre: "Administrador", contrasena: OPERADOR_CONTRASENA }),
  });
  if (!admin.ok) throw new Error(admin.stderr.trim() || admin.stdout.trim() || "No se creó el operador");
  console.log(admin.stdout.trim());
  let guardado = existsSync(credencialesPath) ? JSON.parse(readFileSync(credencialesPath, "utf8")) : null;
  let correo = guardado?.correo || MOVIL_CORREO;
  let contrasena = guardado?.contrasena || randomBytes(18).toString("base64url");
  const registro = await httpJson(`${baseUrl}/movil/registros`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      correo,
      contrasena,
      nombre: "Prueba",
      apellido: "Local",
      tipo_documento: "CC",
      numero_documento: "900000001",
      telefono: "3000000001",
      fecha_nacimiento: "1990-01-01",
    }),
  });
  if (!registro.ok) {
    const sesion = await httpJson(`${baseUrl}/movil/sesiones`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ correo, contrasena }),
    });
    if (!sesion.ok) {
      correo = `ha-prueba-${Date.now()}@solventa.test`;
      contrasena = randomBytes(18).toString("base64url");
      const otro = await httpJson(`${baseUrl}/movil/registros`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          correo,
          contrasena,
          nombre: "Prueba",
          apellido: "Local",
          tipo_documento: "CC",
          numero_documento: String(Date.now()).slice(-10),
          telefono: "3000000002",
          fecha_nacimiento: "1990-01-01",
        }),
      });
      if (!otro.ok) throw new Error(`No se pudo registrar el cliente de prueba (HTTP ${otro.status ?? "sin respuesta"}).`);
    }
  }
  mkdirSync(join(credencialesPath, ".."), { recursive: true });
  writeFileSync(credencialesPath, JSON.stringify({ correo, contrasena }));
  return { correo, contrasena };
}

function entornoDePrueba() {
  const guardado = existsSync(credencialesPath) ? JSON.parse(readFileSync(credencialesPath, "utf8")) : {};
  return {
    ...process.env,
    OPERADOR_CORREO,
    OPERADOR_CONTRASENA,
    MOVIL_CORREO: guardado.correo || "",
    MOVIL_CONTRASENA: guardado.contrasena || "",
  };
}

async function fumar(baseUrl, env) {
  const tipos = await httpJson(`${baseUrl}/movil/tipos-documento`);
  if (!tipos.ok || !Array.isArray(tipos.cuerpo) || !tipos.cuerpo.includes("CC")) {
    throw new Error(`tipos-documento no respondió el catálogo (HTTP ${tipos.status ?? "sin respuesta"}).`);
  }
  const sesion = await httpJson(`${baseUrl}/web/sesiones`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ correo: OPERADOR_CORREO, contrasena: OPERADOR_CONTRASENA }),
  });
  if (!sesion.ok || !sesion.cuerpo?.token) throw new Error(`La sesión del operador respondió HTTP ${sesion.status ?? "sin respuesta"}.`);
  const ramos = await httpJson(`${baseUrl}/web/ramos`, { headers: { authorization: `Bearer ${sesion.cuerpo.token}` } });
  if (!ramos.ok) throw new Error(`El catálogo de ramos respondió HTTP ${ramos.status}.`);
  const movil = await httpJson(`${baseUrl}/movil/sesiones`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ correo: env.MOVIL_CORREO, contrasena: env.MOVIL_CONTRASENA }),
  });
  if (!movil.ok || !movil.cuerpo?.token) throw new Error(`La sesión móvil respondió HTTP ${movil.status ?? "sin respuesta"}.`);
  const avisos = await httpJson(`${baseUrl}/movil/siniestros`, { headers: { authorization: `Bearer ${movil.cuerpo.token}` } });
  if (!avisos.ok) throw new Error(`El listado de siniestros respondió HTTP ${avisos.status}.`);
}

function levantarObservabilidad() {
  const resultado = ejecutar("docker", ["compose", "-p", COMPOSE_PROYECTO, "-f", join(observabilidad, "compose.yaml"), "up", "-d"]);
  if (!resultado.ok) throw new Error(resultado.stderr.trim() || "No se levantó la observabilidad");
}

function bajarObservabilidad() {
  return ejecutar("docker", ["compose", "-p", COMPOSE_PROYECTO, "-f", join(observabilidad, "compose.yaml"), "down", "-v", "--remove-orphans"]);
}

async function activar() {
  const existe = clusterExiste();
  await preflight(!existe);
  await asegurarImagenes();
  if (!existe) {
    console.log(`Creando ${CLUSTER}`);
    const creado = ejecutar(k3d(), ["cluster", "create", "--config", join(overlayHa, "k3d.yaml")]);
    if (!creado.ok) throw new Error(creado.stderr.trim() || creado.stdout.trim());
  } else {
    console.log(`${CLUSTER} ya existe. No se crea otro.`);
  }
  escribirKubeconfig();
  const nodos = kubectl(["wait", "--for=condition=Ready", "nodes", "--all", "--timeout=180s"]);
  if (!nodos.ok) throw new Error(nodos.stderr.trim());
  etiquetarNodos();
  anclarSistema();
  const servidor = kubectlJson(["get", "nodes"]).items.find((nodo) => nodo.metadata.name.includes("-server-"));
  kubectl(["taint", "nodes", servidor.metadata.name, "node-role.kubernetes.io/control-plane=:NoSchedule", "--overwrite"]);
  instalarOperador();
  asegurarSecretoSesion();
  const imagenes = await asegurarImagenes();
  console.log("Importando imágenes al clúster");
  for (const imagen of imagenes) importarImagen(imagen);
  await aplicarOverlay();
  const pg = kubectl(["-n", NAMESPACE, "wait", "--for=condition=Ready", `cluster/${CLUSTER_PG}`, "--timeout=360s"]);
  if (!pg.ok) throw new Error(pg.stderr.trim() || "PostgreSQL no llegó a Ready");
  kubectl(["-n", NAMESPACE, "delete", "job", "cotizacion-bootstrap", "siniestros-prestadores-sync", "--ignore-not-found"]);
  await aplicarOverlay();
  const bootstrap = kubectl(["-n", NAMESPACE, "wait", "--for=condition=complete", "job/cotizacion-bootstrap", "--timeout=300s"]);
  if (!bootstrap.ok) throw new Error(bootstrap.stderr.trim() || "El bootstrap de cotización no terminó");
  for (const nombre of [...SERVICIOS_CRITICOS, "simuladores", "redis", "localstack", "kube-state-metrics"]) {
    const listo = kubectl(["-n", NAMESPACE, "rollout", "status", `deployment/${nombre}`, "--timeout=360s"]);
    if (!listo.ok) throw new Error(`${nombre}: ${listo.stderr.trim()}`);
  }
  const baseUrl = `http://127.0.0.1:${PUERTO_API}`;
  const credenciales = await asegurarUsuarios(baseUrl);
  await fumar(baseUrl, { MOVIL_CORREO: credenciales.correo, MOVIL_CONTRASENA: credenciales.contrasena });
  levantarObservabilidad();
  const limite = Date.now() + 90_000;
  let grafana = false;
  while (Date.now() < limite) {
    const salud = await httpJson(`http://127.0.0.1:${PUERTO_GRAFANA}/api/health`);
    if (salud.ok) {
      grafana = true;
      break;
    }
    await dormir(3000);
  }
  if (!grafana) throw new Error("Grafana no respondió en /api/health.");
  const estado = foto();
  console.log(JSON.stringify({
    cluster: CLUSTER,
    api: baseUrl,
    grafana: `http://127.0.0.1:${PUERTO_GRAFANA}/d/solventa-ha/arq-12-y-arq-13`,
    primario: estado.postgres.primario,
    omitidos: SERVICIOS_OMITIDOS,
  }, null, 2));
}

async function probar() {
  if (!clusterExiste()) throw new Error("No existe solventa-ha-local. Ejecuta activar antes de probar.");
  escribirKubeconfig();
  await asegurarWorkers();
  const baseUrl = `http://127.0.0.1:${PUERTO_API}`;
  if (!existsSync(credencialesPath)) await asegurarUsuarios(baseUrl);
  const env = entornoDePrueba();
  const runId = `ha-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const salida = join(evidenciasRaiz, runId);
  mkdirSync(salida, { recursive: true });
  const bitacora = crearBitacora(salida);
  const estado = { fase: "arranque", zona: null, falla: false, detener: false };
  const monitor = vigilar({
    baseUrl,
    salida,
    runId,
    duracion: 30 * 60 * 1000,
    intervaloMs: INTERVALO_S * 1000,
    zonaAfectada: () => estado.zona,
    fase: () => estado.fase,
    pushgateway: `http://127.0.0.1:${PUERTO_PUSH}`,
    detener: () => estado.detener,
    env,
  });
  const pararColector = iniciarColector({ pushgateway: `http://127.0.0.1:${PUERTO_PUSH}`, falla: () => estado.falla, bitacora, salida });
  const inicio = new Date().toISOString();
  const ctx = {
    salida,
    runId,
    env,
    bitacora,
    estado,
    dormir,
    segundos,
    kubectl,
    kubectlAsync,
    grafanaOk: false,
    leer: () => (existsSync(join(salida, "monitor.jsonl")) ? leerMuestras(join(salida, "monitor.jsonl")) : []),
    foto,
    contenedores: listarContenedores,
    capturar: async (nombre) => {
      await dormir(8000);
      const resultado = capturarGrafana(
        `http://127.0.0.1:${PUERTO_GRAFANA}/d/solventa-ha/arq-12-y-arq-13?orgId=1&kiosk&theme=light&from=now-15m&to=now`,
        join(salida, nombre),
      );
      bitacora.anotar("captura", { archivo: nombre, ok: resultado.ok, motivo: resultado.motivo });
      return { archivo: nombre, ...resultado };
    },
    promover: (instancia) => kubectl([
      "-n", NAMESPACE, "patch", "cluster", CLUSTER_PG, "--subresource=status", "--type", "merge", "-p",
      JSON.stringify({
        status: {
          targetPrimary: instancia,
          targetPrimaryTimestamp: new Date().toISOString(),
          phase: "Switchover in progress",
          phaseReason: `Switching over to ${instancia}`,
        },
      }),
    ]),
    consultar: consultarPrometheus,
  };
  let arq12 = null;
  let arq13 = null;
  try {
    const salud = await httpJson(`http://127.0.0.1:${PUERTO_GRAFANA}/api/health`);
    ctx.grafanaOk = salud.ok;
    arq12 = await ejecutarArq12(ctx);
    arq13 = await ejecutarArq13(ctx);
  } finally {
    estado.detener = true;
    pararColector();
    await monitor.catch((error) => bitacora.anotar("monitor-detenido", { mensaje: error.message }));
    await asegurarWorkers();
  }
  const muestras = ctx.leer();
  const eventos = existsSync(join(salida, "eventos.json")) ? JSON.parse(readFileSync(join(salida, "eventos.json"), "utf8")) : [];
  const infra = existsSync(join(salida, "infra.jsonl")) ? leerMuestras(join(salida, "infra.jsonl")) : [];
  escribirGraficas(salida, { muestras, eventos, arq12, arq13, infra });
  const resumen = {
    runId,
    inicio,
    duracionMs: Date.now() - Date.parse(inicio),
    servicios: SERVICIOS_CRITICOS,
    arq12,
    arq13,
    huecos: disponibilidadDe(muestras).huecos,
    capturas: [...(arq12?.capturas || []), ...(arq13?.capturas || [])],
  };
  escribirResumen(salida, resumen);
  console.log(JSON.stringify({
    salida,
    arq12: arq12 ? { ejecutado: arq12.ejecutado, disponibilidad: arq12.disponibilidad?.disponibilidadObservada ?? null } : null,
    arq13: arq13 ? { ejecutado: arq13.ejecutado, conclusion: arq13.recuperacion?.conclusion, rtoMs: arq13.recuperacion?.rtoMs ?? null } : null,
  }, null, 2));
  if (!arq12?.ejecutado || !arq13?.ejecutado) process.exitCode = 1;
}

async function asegurarWorkers() {
  for (const contenedor of listarContenedores()) {
    const nuestro = contenedor.etiquetas["k3d.cluster"] === CLUSTER && (contenedor.etiquetas["k3d.role"] === "agent" || contenedor.nombre.startsWith(`k3d-${CLUSTER}-agent-`));
    if (nuestro && contenedor.estado !== "running") ejecutar("docker", ["start", contenedor.id]);
  }
}

async function desactivar() {
  const antes = listarContenedores();
  const composeAntes = ejecutar("docker", ["compose", "-f", join(backend, "docker-compose.yml"), "ps", "-a"]).stdout;
  bajarObservabilidad();
  if (clusterExiste()) {
    const borrado = ejecutar(k3d(), ["cluster", "delete", CLUSTER]);
    if (!borrado.ok && !/not found|No clusters found/i.test(`${borrado.stderr} ${borrado.stdout}`)) {
      throw new Error(borrado.stderr.trim() || borrado.stdout.trim());
    }
  }
  for (const ruta of [kubeconfigPath, credencialesPath]) {
    if (existsSync(ruta)) rmSync(ruta, { force: true });
  }
  const despues = listarContenedores();
  const perdidos = ajenosSiguen(antes, despues);
  if (perdidos.length) throw new Error(`Desactivar tocó contenedores ajenos: ${perdidos.map((item) => item.nombre).join(", ")}`);
  const restos = despues.filter((contenedor) => esRecursoHa(contenedor));
  if (restos.length) throw new Error(`Siguen recursos de HA-TEST: ${restos.map((item) => item.nombre).join(", ")}`);
  const composeDespues = ejecutar("docker", ["compose", "-f", join(backend, "docker-compose.yml"), "ps", "-a"]).stdout;
  if (composeAntes !== composeDespues) throw new Error("El docker compose habitual cambió durante la desactivación.");
  console.log(JSON.stringify({ cluster: CLUSTER, activo: clusterExiste(), restos: restos.length }, null, 2));
}

const acciones = { activar, probar, desactivar };
if (!acciones[comando]) {
  console.log("Uso: node deploy/scripts/ha/modo-local.mjs <activar|probar|desactivar>");
  process.exit(comando ? 1 : 0);
}
acciones[comando]().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
