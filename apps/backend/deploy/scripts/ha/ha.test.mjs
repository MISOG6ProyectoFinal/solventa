import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { CLUSTER, ZONA_A, ZONA_B } from "./lib/constantes.mjs";
import { huecosNoObservados, resumirDisponibilidad } from "./lib/disponibilidad.mjs";
import { distribucionValida } from "./lib/distribucion.mjs";
import { postgresDesde } from "./lib/estado.mjs";
import { graficaDisponibilidad, segmentosDe, eventosDisponibilidad, resumenArq13, rtoDe } from "./lib/grafica.mjs";
import { ajenosSiguen, esRecursoHa, esWorkerZonaA, evaluarRecursos, planEliminacion } from "./lib/proteccion.mjs";
import { medirRecuperacion } from "./lib/rto.mjs";
import { bloqueResultados, compararEvidencia, reemplazarBloque } from "./lib/resultados-asr09.mjs";
import { exposicionSondas } from "./lib/metricas.mjs";
import { kubeconfigLocal } from "./lib/kube.mjs";
import { backend, overlayHa, sqlBases } from "./lib/rutas.mjs";
import { evaluarPrestadores, evaluarProductos, evaluarSiniestros, evaluarTiposDocumento, sondasDe } from "./lib/sondas.mjs";
import { motivoTransporte } from "./monitor.mjs";

function muestra(tick, flow, ok, extra = {}) {
  return {
    tick,
    ts: tick,
    flow,
    ok,
    endpoint: "/x",
    latency_ms: 12,
    alcance: "funcional",
    origen: "aplicacion",
    ...extra,
  };
}

test("un 200 de catálogo vacío no cuenta como venta", () => {
  assert.equal(evaluarProductos(200, "[]").ok, false);
  assert.equal(evaluarTiposDocumento(200, '["CE"]').ok, false);
  assert.equal(evaluarTiposDocumento(200, '["CC","CE"]').ok, true);
  assert.equal(evaluarSiniestros(200, "[]").ok, true);
  assert.equal(evaluarPrestadores(200, '{"type":"FeatureCollection","features":[]}').ok, true);
  assert.equal(evaluarPrestadores(200, '{"status":"ok"}').ok, false);
});

test("sin credenciales no se finge el flujo de siniestros", () => {
  const sondas = sondasDe({});
  assert.deepEqual(sondas.map((sonda) => sonda.flow), ["venta"]);
  assert.equal(sondas[0].alcance, "catalogo-tipos-documento");
});

test("un error de acceso cuenta como indisponibilidad", () => {
  const resumen = resumirDisponibilidad([
    muestra("2026-01-01T00:00:00.000Z", "venta", false, { origen: "cliente", motivo: "red" }),
    muestra("2026-01-01T00:00:05.000Z", "venta", true),
  ]);
  assert.equal(resumen.total, 2);
  assert.equal(resumen.fallos, 1);
  assert.equal(resumen.fallosDeAcceso, 1);
  assert.equal(resumen.disponibilidadObservada, 0.5);
  assert.equal(resumen.sloMensualDemostrado, false);
});

test("una muestra del propio monitor no se cuenta como disponible", () => {
  const resumen = resumirDisponibilidad([
    muestra("2026-01-01T00:00:00.000Z", "monitor", false, { origen: "monitor", alcance: "no-observado" }),
    muestra("2026-01-01T00:00:05.000Z", "venta", true),
  ]);
  assert.equal(resumen.total, 1);
  assert.equal(resumen.muestrasNoObservadas, 1);
  assert.equal(resumen.disponibilidadObservada, 1);
});

test("un hueco del monitor queda fuera de la disponibilidad", () => {
  const huecos = huecosNoObservados(
    [muestra("2026-01-01T00:00:00.000Z", "venta", true), muestra("2026-01-01T00:01:00.000Z", "venta", true)],
    5000,
    Date.parse("2026-01-01T00:01:00.000Z"),
  );
  assert.equal(huecos.length, 1);
  assert.ok(huecos[0].ms >= 60_000);
});

test("la ventana corta no demuestra el mes", () => {
  const resumen = resumirDisponibilidad([
    muestra("t1", "venta", true),
    muestra("t2", "venta", false),
    muestra("t2", "siniestros", true),
  ]);
  assert.equal(resumen.porFlujo.venta.disponibilidadObservada, 0.5);
  assert.equal(resumen.porFlujo.siniestros.disponibilidadObservada, 1);
  assert.equal(resumen.disponibilidadObservada, 2 / 3);
});

test("un ciclo con dos sondas cuenta un solo resultado", () => {
  const resumen = resumirDisponibilidad([
    muestra("t1", "siniestros", true),
    muestra("t1", "siniestros", false),
  ]);
  assert.equal(resumen.porFlujo.siniestros.total, 1);
  assert.equal(resumen.porFlujo.siniestros.fallos, 1);
});

test("sin fallos no se inventa un RTO", () => {
  const medicion = medirRecuperacion(
    [muestra("2026-01-01T00:00:10.000Z", "venta", true), muestra("2026-01-01T00:00:15.000Z", "venta", true)],
    { inicioFalla: "2026-01-01T00:00:00.000Z", estables: 2 },
  );
  assert.equal(medicion.conclusion, "continuidad");
  assert.equal(medicion.rtoMs, null);
});

test("un corte de red entra en el RTO", () => {
  const medicion = medirRecuperacion(
    [
      muestra("2026-01-01T00:00:05.000Z", "venta", false, { origen: "cliente", motivo: "tiempo-agotado" }),
      muestra("2026-01-01T00:00:10.000Z", "venta", true),
      muestra("2026-01-01T00:00:15.000Z", "venta", true),
    ],
    { inicioFalla: "2026-01-01T00:00:00.000Z", estables: 2 },
  );
  assert.equal(medicion.conclusion, "recuperado");
  assert.equal(medicion.rtoMs, 10_000);
  assert.equal(medicion.cumpleRto, true);
});

test("la gráfica separa flujos, huecos y el RTO medido", () => {
  const muestras = [
    muestra("2026-01-01T00:00:00.000Z", "venta", true, { latency_ms: 20 }),
    muestra("2026-01-01T00:00:05.000Z", "venta", false, { origen: "monitor", alcance: "no-observado" }),
    muestra("2026-01-01T00:00:40.000Z", "venta", false, { latency_ms: 10 }),
    muestra("2026-01-01T00:00:00.000Z", "siniestros", true, { latency_ms: 30 }),
    muestra("2026-01-01T00:00:05.000Z", "siniestros", false),
  ];
  const resultado = {
    disponibilidad: { total: 3, exitos: 2, fallos: 1, disponibilidadObservada: 2 / 3 },
    recuperacion: {
      conclusion: "recuperado",
      rtoMs: 82851,
      rtoMaximoMs: 600000,
      inicioFalla: "2026-01-01T00:00:00.000Z",
      primerFallo: "2026-01-01T00:00:05.000Z",
      recuperacionEstable: "2026-01-01T00:01:22.851Z",
    },
    nodo: { zona: "ha-zone-a" },
    fin: "2026-01-01T00:02:00.000Z",
    inicioFalla: "2026-01-01T00:00:00.000Z",
  };
  const dibujo = graficaDisponibilidad({
    titulo: "Disponibilidad HTTP durante el experimento ARQ-13",
    muestras,
    eventos: eventosDisponibilidad("arq13", [{ tipo: "falla-zona-a", ts: "2026-01-01T00:00:00.000Z" }], resultado),
    resumen: resumenArq13(resultado),
    rto: rtoDe(resultado),
  });
  assert.equal(segmentosDe(muestras, "venta", Date.parse("2026-01-01T00:00:00.000Z")).length, 2);
  assert.equal(dibujo.marcas.length, 4);
  assert.match(dibujo.svg, /Disponibilidad de venta/);
  assert.match(dibujo.svg, /Disponibilidad de siniestros/);
  assert.match(dibujo.svg, /Tiempo transcurrido \(s\)/);
  assert.match(dibujo.svg, /Resultado de la solicitud/);
  assert.match(dibujo.svg, /sin observación/);
  assert.match(dibujo.svg, /Interrupción de ha-zone-a/);
  assert.match(dibujo.svg, /RTO observado: 82,851 s/);
  assert.match(dibujo.svg, /RTO máximo permitido: 600,000 s/);
  assert.doesNotMatch(dibujo.svg, /99,97 % mensual se cumple/);
  const latencias = segmentosDe(muestras, "venta", Date.parse("2026-01-01T00:00:00.000Z")).flat().filter((punto) => punto.ok && punto.latencia != null);
  assert.equal(latencias.length, 1);
  assert.equal(latencias[0].latencia, 20);
});

test("el transporte curl se clasifica", () => {
  assert.equal(motivoTransporte(6), "dns");
  assert.equal(motivoTransporte(28), "tiempo-agotado");
  assert.equal(motivoTransporte(1), "red");
});

test("la desactivación no selecciona contenedores ajenos", () => {
  const contenedores = [
    { id: "1", nombre: "solventa-k3s", etiquetas: {} },
    { id: "2", nombre: "postgres", etiquetas: {} },
    { id: "3", nombre: "solventa-postgres-1", etiquetas: { "com.docker.compose.project": "solventa" } },
    { id: "4", nombre: "k3d-solventa-ha-local-agent-0", etiquetas: { "k3d.cluster": CLUSTER, "k3d.role": "agent" } },
    { id: "5", nombre: "solventa-ha-obs-grafana-1", etiquetas: { "com.docker.compose.project": "solventa-ha-obs" } },
    { id: "6", nombre: "k3d-otro-agent-0", etiquetas: { "k3d.cluster": "otro", "k3d.role": "agent" } },
  ];
  const plan = planEliminacion(contenedores);
  assert.deepEqual(plan.tocar.map((item) => item.id), ["4", "5"]);
  assert.deepEqual(plan.ajenos.map((item) => item.id), ["1", "2", "3", "6"]);
  assert.equal(esRecursoHa(contenedores[0]), false);
  assert.equal(esWorkerZonaA({ ...contenedores[1], zona: ZONA_A, nodo: "postgres" }), false);
  assert.equal(
    esWorkerZonaA({ ...contenedores[3], zona: ZONA_A, nodo: "k3d-solventa-ha-local-agent-0" }),
    true,
  );
  assert.equal(
    esWorkerZonaA({ ...contenedores[3], zona: ZONA_B, nodo: "k3d-solventa-ha-local-agent-0" }),
    false,
  );
  const despues = contenedores.filter((item) => item.id !== "4" && item.id !== "5");
  assert.deepEqual(ajenosSiguen(contenedores, despues), []);
  assert.equal(ajenosSiguen(contenedores, despues.filter((item) => item.id !== "1")).length, 1);
});

test("los recursos insuficientes bloquean la activación", () => {
  const malo = evaluarRecursos({ dockerMemBytes: 2 * 1024 ** 3, hostFreeBytes: 500 * 1024 ** 2, diskFreeBytes: 1024 ** 3, puertosOcupados: [18080] });
  assert.equal(malo.ok, false);
  assert.ok(malo.bloqueos.length >= 3);
  const bueno = evaluarRecursos({ dockerMemBytes: 8 * 1024 ** 3, hostFreeBytes: 4 * 1024 ** 3, diskFreeBytes: 20 * 1024 ** 3, puertosOcupados: [] });
  assert.equal(bueno.ok, true);
  const existente = evaluarRecursos({ dockerMemBytes: 8 * 1024 ** 3, hostFreeBytes: 1024 ** 3, diskFreeBytes: 20 * 1024 ** 3, clusterExistente: true });
  assert.equal(existente.ok, true);
  assert.equal(existente.avisos.length, 1);
});

test("el primario se lee del estado de CloudNativePG", () => {
  const estado = postgresDesde(
    [
      { nombre: "solventa-pg-1", nodo: "a", zona: ZONA_A, rol: "replica", listo: true },
      { nombre: "solventa-pg-2", nodo: "b", zona: ZONA_B, rol: "primary", listo: true },
    ],
    { status: { currentPrimary: "solventa-pg-1", readyInstances: 2, phase: "Cluster in healthy state" } },
  );
  assert.equal(estado.currentPrimary, "solventa-pg-1");
  assert.equal(estado.primario.zona, ZONA_A);
  assert.equal(estado.replicasListas, 1);
});

test("la distribución exige un pod listo en cada zona simulada", () => {
  const nodos = [
    { zona: ZONA_A, listo: true },
    { zona: ZONA_B, listo: true },
  ];
  const servicios = ["canales", "cotizacion", "polizas", "identidad", "siniestros", "pagos"];
  const pods = servicios.flatMap((servicio) => [
    { servicio, zona: ZONA_A, listo: true },
    { servicio, zona: ZONA_B, listo: true },
  ]);
  assert.equal(distribucionValida({ nodos, pods, servicios }).lista, true);
  pods.pop();
  assert.equal(distribucionValida({ nodos, pods, servicios }).lista, false);
});

test("k3d declara dos zonas simuladas y no toca el kubeconfig por defecto", () => {
  const texto = readFileSync(`${overlayHa}/k3d.yaml`, "utf8");
  assert.match(texto, new RegExp(CLUSTER));
  assert.match(texto, new RegExp(ZONA_A));
  assert.match(texto, new RegExp(ZONA_B));
  assert.match(texto, /updateDefaultKubeconfig: false/);
  assert.match(texto, /rancher\/k3s:v1\.34\.13-k3s1/);
  assert.match(texto, /18080:80/);
});

test("dos flujos se publican con un solo TYPE por métrica", () => {
  const texto = exposicionSondas([
    { flow: "venta", up: true, latenciaMs: 12, exitos: 1, fallos: 0 },
    { flow: "siniestros", up: false, latenciaMs: null, exitos: 0, fallos: 1 },
  ]);
  assert.equal(texto.split("# TYPE ha_probe_up").length - 1, 1);
  assert.match(texto, /ha_probe_up\{flow="venta"\} 1/);
  assert.match(texto, /ha_probe_latency_ms\{flow="venta"\} 12/);
  assert.doesNotMatch(texto, /ha_probe_latency_ms\{flow="siniestros"\}/);
});

test("el kubeconfig local no usa la IP de la LAN ni la CA interceptada", () => {
  const texto = kubeconfigLocal("    server: https://host.docker.internal:52707\n    certificate-authority-data: QUITAR\n");
  assert.match(texto, /https:\/\/127\.0\.0\.1:52707/);
  assert.match(texto, /insecure-skip-tls-verify: true/);
  assert.doesNotMatch(texto, /host\.docker\.internal/);
  assert.doesNotMatch(texto, /certificate-authority-data/);
});

test("CloudNativePG usa PostGIS, dos instancias y las bases del proyecto", () => {
  const texto = readFileSync(`${overlayHa}/cnpg.yaml`, "utf8");
  const sql = readFileSync(sqlBases, "utf8");
  const bases = [...sql.matchAll(/CREATE DATABASE\s+([a-z0-9_]+)\s*;/g)].map((coincidencia) => coincidencia[1]);
  assert.ok(bases.length >= 6);
  for (const base of bases) assert.match(texto, new RegExp(`name: ${base}`));
  assert.match(texto, /ghcr.io\/cloudnative-pg\/postgis:17-3-system-trixie/);
  assert.match(texto, /instances: 2/);
  assert.match(texto, /name: postgis/);
  assert.doesNotMatch(texto, /minSyncReplicas/);
  assert.match(texto, /ALTER ROLE solventa WITH SUPERUSER/);
});

test("CloudNativePG confirma cada escritura en la réplica de la otra zona (ASR-09)", () => {
  const texto = readFileSync(`${overlayHa}/cnpg.yaml`, "utf8");
  assert.match(texto, /synchronous:\s*\n\s+method: any\s*\n\s+number: 1\s*\n\s+dataDurability: preferred/);
  assert.doesNotMatch(texto, /asíncrona/);
});

const confirmado = (clave, referencia, estado = "aprobado") => ({ clave, referencia, http: 200, estado });

test("ASR-09: un cobro confirmado que falta o cambia en la base es una pérdida", () => {
  const resultado = compararEvidencia({
    cliente: [confirmado("k1", "r1"), confirmado("k2", "r2"), confirmado("k3", "r3"), { clave: "k4", referencia: "r4", http: 503 }],
    filas: [
      { idempotency_key: "k1", estado: "aprobado" },
      { idempotency_key: "k3", estado: "rechazado" },
    ],
    cargos: [],
  });
  assert.equal(resultado.confirmadas, 3);
  assert.deepEqual(resultado.perdidas.sort(), ["k2", "k3"]);
});

test("ASR-09: dos cargos aprobados de la misma referencia son un duplicado", () => {
  const resultado = compararEvidencia({
    cliente: [confirmado("k1", "r1"), { clave: "k2", referencia: "r1", http: 503 }, confirmado("k3", "r2")],
    filas: [
      { idempotency_key: "k1", estado: "aprobado" },
      { idempotency_key: "k3", estado: "aprobado" },
      { idempotency_key: "k9", estado: "procesando" },
    ],
    cargos: [
      { referencia: "k1", status: "approved" },
      { referencia: "k2", status: "approved" },
      { referencia: "k3", status: "approved" },
    ],
  });
  assert.deepEqual(resultado.duplicados, ["r1"]);
  assert.deepEqual(resultado.atascados, ["k9"]);
  assert.equal(resultado.cumple, false);
});

test("ASR-09: una corrida sin pérdidas, duplicados ni atascados cumple", () => {
  const resultado = compararEvidencia({
    cliente: [confirmado("k1", "r1")],
    filas: [{ idempotency_key: "k1", estado: "aprobado" }],
    cargos: [{ referencia: "k1", status: "approved" }],
  });
  assert.equal(resultado.cumple, true);
});

test("ASR-09: el bloque de resultados se reemplaza y el texto escrito a mano se conserva", () => {
  const informe = "# ASR-09\n\nIntro.\n\n<!-- resultados:inicio -->\nviejo\n<!-- resultados:fin -->\n\nConclusión.\n";
  const corridas = [
    { fecha: "2026-11-20T10:00:00Z", zona: "ha-zone-a", confirmadas: 900, perdidas: 0, duplicados: 0, atascados: 0, cumple: true, control: false },
    { fecha: "2026-11-20T11:00:00Z", zona: "ha-zone-b", confirmadas: 880, perdidas: 3, duplicados: 0, atascados: 0, cumple: false, control: true },
  ];
  const nuevo = reemplazarBloque(informe, bloqueResultados(corridas));
  assert.match(nuevo, /^# ASR-09\n\nIntro\.\n\n<!-- resultados:inicio -->\n/);
  assert.match(nuevo, /\n<!-- resultados:fin -->\n\nConclusión\.\n$/);
  assert.doesNotMatch(nuevo, /viejo/);
  assert.match(nuevo, /ha-zone-a/);
  assert.match(nuevo, /control/i);
  assert.match(nuevo, /1 de 1 corridas cumplen/);
  assert.throws(() => reemplazarBloque("# sin marcadores\n", "x"));
});

test("el render no conserva el StatefulSet local ni la afinidad de EKS", () => {
  const resultado = spawnSync("kubectl", ["kustomize", "deploy/k8s/overlays/local-ha"], { cwd: backend, encoding: "utf8" });
  assert.equal(resultado.status, 0, resultado.stderr);
  assert.doesNotMatch(resultado.stdout, /kind: StatefulSet/);
  assert.doesNotMatch(resultado.stdout, /eks.amazonaws.com/);
  assert.match(resultado.stdout, /solventa\/canales:ha-local/);
  assert.match(resultado.stdout, /whenUnsatisfiable: DoNotSchedule/);
  assert.match(resultado.stdout, /maxSurge: 0/);
  assert.match(resultado.stdout, /c29sdmVudGEtcGctcnc=/);
  assert.match(resultado.stdout, /PERSISTENT_STORES\n\s+value: "true"/);
  assert.match(resultado.stdout, /kubernetes.io\/metadata.name: cnpg-system/);
});

test("no queda el stack ni el overlay de HA-TEST AWS", () => {
  assert.equal(existsSync(`${backend}/deploy/k8s/overlays/aws-ha-test`), false);
  assert.equal(existsSync(`${backend}/deploy/terraform/stacks/ha_test`), false);
  assert.equal(existsSync(`${backend}/deploy/terraform/stacks/ha_test_plataforma`), false);
  assert.equal(existsSync(`${backend}/deploy/scripts/ha/modo.mjs`), false);
  assert.equal(existsSync(`${backend}/deploy/scripts/ha/lib/aws.mjs`), false);
  const eks = readFileSync(`${backend}/deploy/terraform/modules/eks/main.tf`, "utf8");
  assert.equal(eks.includes("cluster_zonal_shift"), false);
});
