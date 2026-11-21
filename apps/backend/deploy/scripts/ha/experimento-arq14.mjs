// ASR-09 (ARQ-14): stops the zone of the PostgreSQL primary while payments are in flight and checks
// that no confirmed payment is lost and none is charged twice. Needs `modo-local.mjs activar` first.
//   node deploy/scripts/ha/experimento-arq14.mjs [--corridas 10] [--control] [--carga-s 240] [--falla-s 60]
import { mkdirSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import { CLUSTER_PG, NAMESPACE } from "./lib/constantes.mjs";
import { nodosDesde, podsDesde, postgresDesde } from "./lib/estado.mjs";
import { kubectl, kubectlJson } from "./lib/kube.mjs";
import { ejecutar } from "./lib/proceso.mjs";
import { compararEvidencia, registrar } from "./lib/resultados-asr09.mjs";
import { backend, evidenciasRaiz } from "./lib/rutas.mjs";

const docs = resolve(backend, "../../docs");
const DESTINO = {
  resultados: join(docs, "asr09/resultados.json"),
  grafica: join(docs, "asr09/perdida-duplicados.svg"),
  informe: join(docs, "ASR-09.md"),
};
const K6_IMAGEN = "grafana/k6:2.3.0";
const K6_SCRIPT = resolve(backend, "deploy/scripts/ha/k6/cobros-asr09.js");
const SINCRONA = { method: "any", number: 1, dataDurability: "preferred" };

const { values: opciones } = parseArgs({
  options: {
    corridas: { type: "string", default: "10" },
    control: { type: "boolean", default: false },
    "carga-s": { type: "string", default: "240" },
    "falla-s": { type: "string", default: "60" },
  },
});

const dormir = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

function foto() {
  const nodos = nodosDesde(kubectlJson(["get", "nodes"]));
  const pgPods = podsDesde(kubectlJson(["-n", NAMESPACE, "get", "pods", "-l", `cnpg.io/cluster=${CLUSTER_PG}`]), nodos);
  const cluster = kubectlJson(["-n", NAMESPACE, "get", "cluster", CLUSTER_PG]);
  return { nodos, postgres: postgresDesde(pgPods, cluster) };
}

function exigir(resultado, contexto) {
  if (!resultado.ok) throw new Error(`${contexto}: ${resultado.stderr.trim() || resultado.stdout.trim()}`);
  return resultado.stdout;
}

async function esperarPostgres(minimoListas, limiteMs = 300_000) {
  const limite = Date.now() + limiteMs;
  while (Date.now() < limite) {
    const actual = foto();
    const listos = actual.postgres.instancias.filter((instancia) => instancia.listo).length;
    if (actual.postgres.primario?.listo && listos >= minimoListas) return actual;
    await dormir(5000);
  }
  throw new Error(`PostgreSQL no quedó con ${minimoListas} instancias listas.`);
}

function replicacion(sincrona) {
  const parche = sincrona
    ? [{ op: "add", path: "/spec/postgresql/synchronous", value: SINCRONA }]
    : [{ op: "remove", path: "/spec/postgresql/synchronous" }];
  const resultado = kubectl(["-n", NAMESPACE, "patch", "cluster", CLUSTER_PG, "--type", "json", "-p", JSON.stringify(parche)]);
  if (!resultado.ok && !/nonexistent|not found/i.test(resultado.stderr)) exigir(resultado, "cambiar la replicación");
}

function lanzarCarga(corrida) {
  kubectl(["-n", NAMESPACE, "delete", "job", "asr09-carga", "--ignore-not-found", "--wait=true"]);
  kubectl(["-n", NAMESPACE, "delete", "configmap", "asr09-k6", "--ignore-not-found"]);
  exigir(kubectl(["-n", NAMESPACE, "create", "configmap", "asr09-k6", `--from-file=cobros.js=${K6_SCRIPT}`]), "configmap k6");
  const job = {
    apiVersion: "batch/v1",
    kind: "Job",
    metadata: { name: "asr09-carga", namespace: NAMESPACE },
    spec: {
      backoffLimit: 0,
      template: {
        spec: {
          restartPolicy: "Never",
          // On the control node, so the load survives the zone it stops.
          nodeSelector: { "node-role.kubernetes.io/control-plane": "true" },
          tolerations: [{ key: "node-role.kubernetes.io/control-plane", operator: "Exists", effect: "NoSchedule" }],
          containers: [{
            name: "k6",
            image: K6_IMAGEN,
            args: ["run", "--quiet", "--log-format", "raw", "/scripts/cobros.js"],
            env: [
              { name: "CORRIDA", value: corrida },
              { name: "DURACION_S", value: opciones["carga-s"] },
            ],
            volumeMounts: [{ name: "scripts", mountPath: "/scripts" }],
          }],
          volumes: [{ name: "scripts", configMap: { name: "asr09-k6" } }],
        },
      },
    },
  };
  exigir(kubectl(["apply", "-f", "-"], { input: JSON.stringify(job) }), "job de carga");
}

async function esperarCarga() {
  const limite = Date.now() + (Number(opciones["carga-s"]) + 600) * 1000;
  while (Date.now() < limite) {
    const estado = kubectlJson(["-n", NAMESPACE, "get", "job", "asr09-carga"]).status ?? {};
    if (estado.succeeded || estado.failed) return Boolean(estado.succeeded);
    await dormir(10_000);
  }
  throw new Error("La carga de k6 no terminó a tiempo.");
}

function leerCliente() {
  const salida = exigir(kubectl(["-n", NAMESPACE, "logs", "job/asr09-carga"]), "logs de k6");
  return salida.split(/\r?\n/).filter((linea) => linea.startsWith("{")).map((linea) => JSON.parse(linea));
}

function leerFilas(primario, corrida) {
  const consulta = `copy (select idempotency_key, estado from cobros where idempotency_key like 'asr09:asr09-${corrida}-%') to stdout with csv`;
  const salida = exigir(
    kubectl(["-n", NAMESPACE, "exec", primario, "-c", "postgres", "--", "psql", "-U", "postgres", "-d", "pagos", "-At", "-c", consulta]),
    "consulta de cobros",
  );
  return salida.split(/\r?\n/).filter(Boolean).map((linea) => {
    const [idempotency_key, estado] = linea.split(",");
    return { idempotency_key, estado };
  });
}

function leerCargos() {
  return JSON.parse(exigir(
    kubectl(["get", "--raw", `/api/v1/namespaces/${NAMESPACE}/services/simuladores:80/proxy/pasarela-pagos/charges`]),
    "cargos de la pasarela",
  ));
}

async function corrida(numero) {
  const id = `${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const crudos = join(evidenciasRaiz, "asr09", id);
  mkdirSync(crudos, { recursive: true });
  const antes = await esperarPostgres(2);
  const primarioAntes = antes.postgres.primario;
  const nodo = primarioAntes.nodo;
  console.log(`Corrida ${numero}: primario ${primarioAntes.instancia} en ${primarioAntes.zona} (${nodo})`);

  lanzarCarga(id);
  await dormir(Number(opciones["falla-s"]) * 1000);
  const inicioFalla = new Date().toISOString();
  exigir(ejecutar("docker", ["kill", nodo]), `docker kill ${nodo}`);
  let primarioDespues = null;
  let cargaOk = false;
  try {
    cargaOk = await esperarCarga();
    primarioDespues = foto().postgres.primario;
  } finally {
    exigir(ejecutar("docker", ["start", nodo]), `docker start ${nodo}`);
  }
  const final = await esperarPostgres(2, 600_000);

  const reconciliacion = kubectl(["-n", NAMESPACE, "exec", "deploy/pagos", "--", "python", "-m", "pagos.cobros.reconciliar", "--antiguedad-s", "0"]);
  const cliente = leerCliente();
  const filas = leerFilas(final.postgres.primario.instancia, id);
  const cargos = leerCargos();
  writeFileSync(join(crudos, "cliente.jsonl"), cliente.map((linea) => JSON.stringify(linea)).join("\n"));
  writeFileSync(join(crudos, "cobros.json"), JSON.stringify(filas, null, 2));
  writeFileSync(join(crudos, "cargos.json"), JSON.stringify(cargos, null, 2));
  writeFileSync(join(crudos, "reconciliacion.txt"), `${reconciliacion.stdout}${reconciliacion.stderr}`);

  const evidencia = compararEvidencia({ cliente, filas, cargos });
  const resultado = {
    fecha: new Date().toISOString(),
    control: opciones.control,
    zona: primarioAntes.zona,
    nodo,
    inicioFalla,
    primarioAntes: primarioAntes.instancia,
    primarioDespues: primarioDespues?.instancia ?? null,
    cargaCompleta: cargaOk,
    reconciliacionOk: reconciliacion.ok,
    confirmadas: evidencia.confirmadas,
    perdidas: evidencia.perdidas.length,
    duplicados: evidencia.duplicados.length,
    atascados: evidencia.atascados.length,
    cumple: evidencia.cumple && cargaOk && reconciliacion.ok,
    detalle: { perdidas: evidencia.perdidas, duplicados: evidencia.duplicados, atascados: evidencia.atascados },
    evidencias: relative(resolve(backend, "../.."), crudos).replaceAll("\\", "/"),
  };
  registrar(DESTINO, resultado);
  console.log(JSON.stringify({ corrida: numero, ...resultado, detalle: undefined }));
  return resultado;
}

async function principal() {
  const total = opciones.control ? 1 : Number(opciones.corridas);
  if (opciones.control) replicacion(false);
  try {
    for (let numero = 1; numero <= total; numero += 1) await corrida(numero);
  } finally {
    if (opciones.control) replicacion(true);
  }
}

principal().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
