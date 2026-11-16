import { CLUSTER, COMPOSE_PROYECTO, ZONA_A } from "./constantes.mjs";

export function esRecursoHa(contenedor) {
  const nombre = contenedor.nombre || "";
  const etiquetas = contenedor.etiquetas || {};
  if (etiquetas["k3d.cluster"] === CLUSTER) return true;
  if (etiquetas["com.docker.compose.project"] === COMPOSE_PROYECTO) return true;
  if (nombre.startsWith(`k3d-${CLUSTER}-`)) return true;
  if (nombre.startsWith(`${COMPOSE_PROYECTO}-`)) return true;
  return false;
}

export function planEliminacion(contenedores) {
  const tocar = [];
  const ajenos = [];
  for (const contenedor of contenedores) {
    if (esRecursoHa(contenedor)) tocar.push(contenedor);
    else ajenos.push(contenedor);
  }
  return { tocar, ajenos };
}

/** Solo el agente de la zona A de este clúster. Un nombre genérico no alcanza. */
export function esWorkerZonaA(contenedor) {
  const etiquetas = contenedor.etiquetas || {};
  if (!esRecursoHa(contenedor)) return false;
  if (etiquetas["k3d.role"] !== "agent") return false;
  if (etiquetas["k3d.cluster"] !== CLUSTER) return false;
  if (contenedor.zona !== ZONA_A) return false;
  if (!contenedor.nombre?.startsWith(`k3d-${CLUSTER}-agent-`)) return false;
  if (contenedor.nodo && contenedor.nombre !== contenedor.nodo) return false;
  return true;
}

export function ajenosSiguen(antes, despues) {
  const posteriores = new Set(despues.map((contenedor) => contenedor.id));
  return antes.filter((contenedor) => !esRecursoHa(contenedor) && !posteriores.has(contenedor.id));
}

const GIB = 1024 ** 3;

export function evaluarRecursos({ dockerMemBytes = 0, hostFreeBytes = 0, diskFreeBytes = 0, puertosOcupados = [], clusterExistente = false } = {}) {
  const bloqueos = [];
  const avisos = [];
  if (dockerMemBytes < 6 * GIB) bloqueos.push(`Docker tiene ${Math.round(dockerMemBytes / GIB)} GiB. Hacen falta al menos 6 GiB.`);
  if (hostFreeBytes < 1.2 * GIB) {
    const mensaje = `Quedan ${Math.round(hostFreeBytes / GIB)} GiB libres en el equipo. Hace falta al menos 1,2 GiB para que la VM de Docker no se quede sin memoria.`;
    if (clusterExistente) avisos.push(mensaje);
    else bloqueos.push(mensaje);
  } else if (hostFreeBytes < 3 * GIB) avisos.push(`Quedan ${Math.round(hostFreeBytes / GIB)} GiB libres en el equipo. El clúster cabe justo.`);
  if (diskFreeBytes < 8 * GIB) bloqueos.push(`Quedan ${Math.round(diskFreeBytes / GIB)} GiB de disco. Hacen falta al menos 8 GiB para imágenes y volúmenes.`);
  if (puertosOcupados.length) bloqueos.push(`Puertos ocupados: ${puertosOcupados.join(", ")}.`);
  return {
    ok: bloqueos.length === 0,
    bloqueos,
    avisos,
    minimo: "Docker con al menos 6 GiB. Un servidor y dos workers de k3d, PostgreSQL con dos instancias y seis servicios críticos con dos réplicas.",
  };
}
