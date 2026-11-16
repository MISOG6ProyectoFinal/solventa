import { SERVICIOS_CRITICOS, ZONAS } from "./constantes.mjs";

/** Comprueba nodos listos y un pod listo de cada servicio crítico en cada zona simulada. */
export function distribucionValida({
  nodos = [],
  pods = [],
  servicios = SERVICIOS_CRITICOS,
  zonas = ZONAS,
} = {}) {
  const zonasConNodo = new Set(nodos.filter((nodo) => nodo.listo && zonas.includes(nodo.zona)).map((nodo) => nodo.zona));
  const porServicio = {};
  for (const nombre of servicios) {
    const propios = pods.filter((pod) => pod.servicio === nombre && pod.listo);
    porServicio[nombre] = [...new Set(propios.map((pod) => pod.zona))].filter((zona) => zonas.includes(zona));
  }
  const incompletos = Object.entries(porServicio)
    .filter(([, presentes]) => zonas.some((zona) => !presentes.includes(zona)))
    .map(([servicio]) => servicio);
  const lista = zonas.every((zona) => zonasConNodo.has(zona)) && incompletos.length === 0;
  return {
    lista,
    zonasConNodo: [...zonasConNodo],
    porServicio,
    incompletos,
    motivo: lista
      ? "Cada servicio crítico tiene un pod listo en las dos zonas simuladas."
      : "Falta un nodo listo o un pod listo en alguna zona simulada.",
  };
}
