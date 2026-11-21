import { CLUSTER, CLUSTER_PG, NAMESPACE, RTO_MAX_MS, ZONA_A, ZONA_CONTROL } from "./lib/constantes.mjs";
import { distribucionValida } from "./lib/distribucion.mjs";
import { nodosDesde, podsDesde, postgresDesde } from "./lib/estado.mjs";
import { medirRecuperacion } from "./lib/rto.mjs";
import { esWorkerZonaA } from "./lib/proteccion.mjs";
import { ejecutar } from "./lib/proceso.mjs";
import { disponibilidadDe, escribirJson } from "./exportar-evidencias.mjs";

export async function ejecutarArq13(ctx) {
  const inicio = new Date().toISOString();
  ctx.estado.fase = "arq13-base";
  ctx.estado.zona = null;
  ctx.estado.falla = false;
  const precondiciones = await esperarMuestras(ctx);
  const foto = await ctx.foto();
  const chequeos = evaluar(foto, ctx);
  precondiciones.push(...chequeos);
  let primarioAntes = foto.postgres.primario;
  if (primarioAntes && primarioAntes.zona !== ZONA_A && chequeos.every((item) => item.ok || !item.critico)) {
    const movido = await moverPrimarioAZonaA(ctx, foto);
    precondiciones.push(movido);
    if (movido.ok) {
      const otra = await ctx.foto();
      primarioAntes = otra.postgres.primario;
      precondiciones.push({
        id: "primario-en-zona-a",
        ok: primarioAntes?.zona === ZONA_A,
        critico: true,
        detalle: primarioAntes ? `${primarioAntes.instancia} en ${primarioAntes.zona}` : "sin primario",
      });
    }
  } else {
    precondiciones.push({
      id: "primario-en-zona-a",
      ok: primarioAntes?.zona === ZONA_A,
      critico: true,
      detalle: primarioAntes ? `${primarioAntes.instancia} en ${primarioAntes.zona}` : "sin primario",
    });
  }

  if (ctx.consultar) {
    const consultas = [
      ["prometheus-sondas", "ha_probe_up", 2],
      ["prometheus-nodos", 'kube_node_status_condition{condition="Ready",status="true"}', 3],
      ["prometheus-replicas", "ha_replicas_listas", 1],
      ["prometheus-postgres", "ha_pg_primario", 1],
    ];
    for (const [id, expr, minimo] of consultas) {
      const series = await ctx.consultar(expr);
      precondiciones.push({ id, ok: series >= minimo, critico: true, detalle: `${series} series (${expr})` });
    }
  }

  const bloqueos = precondiciones.filter((item) => item.critico && !item.ok);
  if (bloqueos.length) {
    const resultado = {
      experimento: "ARQ-13",
      ejecutado: false,
      inicio,
      fin: new Date().toISOString(),
      motivo: "No se cumplió una precondición crítica. No se detuvo ningún nodo.",
      precondiciones,
      primarioAntes,
      recuperacion: { conclusion: "no-ejecutado", rtoMs: null, rtoMaximoMs: RTO_MAX_MS },
      limitacion: "Zonas lógicas del mismo equipo. No es una caída de una AZ de AWS.",
    };
    escribirJson(ctx.salida, "arq13.json", resultado);
    return resultado;
  }

  const baseMs = ctx.segundos("HA_BASE_S", 30) * 1000;
  const transcurrido = Date.now() - Date.parse(inicio);
  if (transcurrido < baseMs) await ctx.dormir(baseMs - transcurrido);
  const antes = await ctx.capturar("grafana-antes.png");

  const contenedor = workerA(await ctx.contenedores(), (await ctx.foto()).nodos);
  if (!contenedor) {
    const resultado = {
      experimento: "ARQ-13",
      ejecutado: false,
      inicio,
      fin: new Date().toISOString(),
      motivo: "No se identificó un único worker de la zona A perteneciente a solventa-ha-local.",
      precondiciones,
      primarioAntes,
      recuperacion: { conclusion: "no-ejecutado", rtoMs: null },
    };
    escribirJson(ctx.salida, "arq13.json", resultado);
    return resultado;
  }

  const inicioFalla = new Date().toISOString();
  ctx.estado.fase = "arq13-falla";
  ctx.estado.zona = ZONA_A;
  ctx.estado.falla = true;
  ctx.bitacora.anotar("falla-zona-a", { nodo: contenedor.nombre, id: contenedor.id, inicioFalla });
  const muerte = ejecutar("docker", ["kill", contenedor.id]);
  ctx.bitacora.anotar("docker-kill", { ok: muerte.ok, detalle: muerte.ok ? "detenido" : muerte.stderr.trim() });
  if (!muerte.ok) {
    ctx.estado.falla = false;
    throw new Error(`docker kill no detuvo ${contenedor.nombre}: ${muerte.stderr.trim()}`);
  }

  let durante = null;
  const minimoMs = ctx.segundos("HA_FALLA_MIN_S", 180) * 1000;
  const limite = Date.now() + RTO_MAX_MS;
  let recuperacion = null;
  while (Date.now() < limite) {
    await ctx.dormir(5000);
    const muestrasFalla = ctx.leer().filter((muestra) => muestra.fase === "arq13-falla");
    recuperacion = medirRecuperacion(muestrasFalla, { inicioFalla, estables: 6 });
    const transcurridoFalla = Date.now() - Date.parse(inicioFalla);
    if (!durante && transcurridoFalla >= 45_000) durante = await ctx.capturar("grafana-durante.png");
    const estableAhora = ultimosBuenos(muestrasFalla, 6);
    if (transcurridoFalla >= minimoMs && recuperacion.conclusion === "continuidad") break;
    if (transcurridoFalla >= minimoMs && recuperacion.conclusion === "recuperado" && estableAhora) break;
  }
  if (!durante) durante = await ctx.capturar("grafana-durante.png");
  const despues = await ctx.capturar("grafana-despues.png");
  const muestrasFalla = ctx.leer().filter((muestra) => muestra.fase === "arq13-falla");
  recuperacion = medirRecuperacion(muestrasFalla, { inicioFalla, estables: 6 });
  const fotoCaida = await ctx.foto();

  ctx.estado.fase = "arq13-restauracion";
  ctx.estado.falla = false;
  const arranque = await restaurar(ctx, contenedor);
  const fotoFinal = arranque.ok ? await esperarNodo(ctx, contenedor.nombre) : null;
  const finalCaptura = await ctx.capturar("grafana-final.png");
  const disponibilidad = disponibilidadDe(muestrasFalla);
  const resultado = {
    experimento: "ARQ-13",
    ejecutado: true,
    inicio,
    fin: new Date().toISOString(),
    inicioFalla,
    nodo: { nombre: contenedor.nombre, id: contenedor.id, zona: ZONA_A, cluster: CLUSTER },
    precondiciones,
    primarioAntes,
    primarioDespues: fotoCaida.postgres.primario,
    primarioFinal: fotoFinal?.postgres.primario ?? null,
    postgresDurante: { fase: fotoCaida.postgres.fase, readyInstances: fotoCaida.postgres.readyInstances, instancias: fotoCaida.postgres.instancias },
    postgresFinal: fotoFinal?.postgres ?? null,
    recuperacion,
    disponibilidad,
    restauracion: arranque,
    capturas: [antes, durante, despues, finalCaptura].filter(Boolean),
    limitacion: "Se detuvo un worker de k3d. Las dos zonas comparten equipo, Docker Desktop y el nodo de control. No es una AZ física de AWS. El RPO se mide en ASR-09 (ARQ-14).",
  };
  escribirJson(ctx.salida, "arq13.json", resultado);
  return resultado;
}

function evaluar(foto, ctx) {
  const distribucion = distribucionValida({ nodos: foto.nodos, pods: foto.pods });
  const operador = foto.podsSistema.find((pod) => pod.listo && pod.zona === ZONA_CONTROL);
  const zonaB = ["canales", "cotizacion", "identidad", "siniestros"].every((servicio) =>
    foto.pods.some((pod) => pod.servicio === servicio && pod.zona === "ha-zone-b" && pod.listo),
  );
  return [
    { id: "cluster", ok: foto.nodos.some((nodo) => nodo.listo), critico: true, detalle: `${foto.nodos.length} nodos` },
    { id: "zonas", ok: foto.nodos.some((nodo) => nodo.listo && nodo.zona === ZONA_A) && foto.nodos.some((nodo) => nodo.listo && nodo.zona === "ha-zone-b"), critico: true, detalle: distribucion.zonasConNodo.join(",") },
    { id: "distribucion", ok: distribucion.lista, critico: true, detalle: distribucion.motivo },
    { id: "postgres-replicas", ok: foto.postgres.replicasListas >= 1 && (foto.postgres.readyInstances ?? 0) >= 2, critico: true, detalle: `ready=${foto.postgres.readyInstances} replicas=${foto.postgres.replicasListas} fase=${foto.postgres.fase}` },
    { id: "primario-conocido", ok: Boolean(foto.postgres.primario?.instancia), critico: true, detalle: foto.postgres.primario?.instancia || "sin primario" },
    { id: "operador-fuera-de-zona-a", ok: Boolean(operador), critico: true, detalle: operador ? operador.nodo : "el operador no está en el nodo de control" },
    { id: "zona-b-atiende", ok: zonaB, critico: true, detalle: zonaB ? "canales, cotización, identidad y siniestros listos en ha-zone-b" : "falta un servicio listo en ha-zone-b" },
    { id: "grafana", ok: ctx.grafanaOk === true, critico: true, detalle: ctx.grafanaOk ? "responde" : "no responde" },
  ];
}

async function esperarMuestras(ctx) {
  const limite = Date.now() + 25_000;
  while (Date.now() < limite) {
    const recientes = ctx.leer().filter((muestra) => muestra.fase === "arq13-base" && muestra.alcance !== "no-observado" && muestra.origen !== "monitor");
    if (recientes.length) return [{ id: "monitor", ok: true, critico: true, detalle: `${recientes.length} muestras de la línea base` }];
    await ctx.dormir(1000);
  }
  return [{ id: "monitor", ok: false, critico: true, detalle: "El monitor no escribió muestras de la línea base." }];
}

async function moverPrimarioAZonaA(ctx, foto) {
  const destino = foto.postgres.instancias.find((instancia) => instancia.zona === ZONA_A && instancia.listo && instancia.rol !== "primary");
  if (!destino) return { id: "promover-primario", ok: false, critico: true, detalle: "No hay réplica lista en ha-zone-a para promoverla." };
  ctx.bitacora.anotar("promover-primario", { instancia: destino.instancia });
  const promovido = ctx.promover(destino.instancia);
  if (!promovido.ok) return { id: "promover-primario", ok: false, critico: true, detalle: promovido.stderr.trim() || "No se pudo solicitar el switchover." };
  const limite = Date.now() + 180_000;
  while (Date.now() < limite) {
    await ctx.dormir(5000);
    const actual = await ctx.foto();
    if (actual.postgres.primario?.instancia === destino.instancia && actual.postgres.primario.listo) {
      return { id: "promover-primario", ok: true, critico: true, detalle: destino.instancia };
    }
  }
  return { id: "promover-primario", ok: false, critico: true, detalle: "La promoción no se confirmó en 180 s." };
}

function workerA(contenedores, nodos) {
  const nodo = nodos.find((item) => item.zona === ZONA_A && !item.control);
  if (!nodo) return null;
  const candidatos = contenedores
    .map((contenedor) => ({ ...contenedor, zona: ZONA_A, nodo: nodo.nombre }))
    .filter((contenedor) => contenedor.nombre === nodo.nombre && esWorkerZonaA(contenedor));
  return candidatos.length === 1 ? candidatos[0] : null;
}

function ultimosBuenos(muestras, n) {
  const ticks = new Map();
  for (const muestra of muestras) {
    if (muestra.alcance === "no-observado" || muestra.origen === "monitor" || muestra.alcance === "no-evaluado") continue;
    const actual = ticks.get(muestra.tick) ?? true;
    ticks.set(muestra.tick, actual && Boolean(muestra.ok));
  }
  const serie = [...ticks.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  return serie.length >= n && serie.slice(-n).every(([, ok]) => ok);
}

async function restaurar(ctx, contenedor) {
  ctx.bitacora.anotar("restaurar-nodo", { nodo: contenedor.nombre });
  const arranque = ejecutar("docker", ["start", contenedor.id]);
  return { ok: arranque.ok, detalle: arranque.ok ? "arrancado" : arranque.stderr.trim() };
}

async function esperarNodo(ctx, nombre) {
  const limite = Date.now() + 180_000;
  while (Date.now() < limite) {
    const foto = await ctx.foto();
    const nodo = foto.nodos.find((item) => item.nombre === nombre);
    const unPrimario = foto.postgres.instancias.filter((item) => item.rol === "primary").length === 1;
    if (nodo?.listo && unPrimario && (foto.postgres.readyInstances ?? 0) >= 2) return foto;
    await ctx.dormir(5000);
  }
  return ctx.foto();
}
