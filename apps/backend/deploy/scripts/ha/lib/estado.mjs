export function listo(condicion) {
  return Array.isArray(condicion) && condicion.some((item) => item.type === "Ready" && item.status === "True");
}

export function nodosDesde(documento) {
  return (documento.items ?? []).map((nodo) => ({
    nombre: nodo.metadata.name,
    zona: nodo.metadata.labels?.["topology.kubernetes.io/zone"] ?? null,
    listo: listo(nodo.status?.conditions),
    control: nodo.metadata.labels?.["node-role.kubernetes.io/control-plane"] !== undefined
      || nodo.metadata.labels?.["node-role.kubernetes.io/master"] !== undefined,
  }));
}

export function podsDesde(documento, nodos) {
  const zonaDe = new Map(nodos.map((nodo) => [nodo.nombre, nodo.zona]));
  return (documento.items ?? []).map((pod) => ({
    nombre: pod.metadata.name,
    servicio: pod.metadata.labels?.["app.kubernetes.io/name"] ?? null,
    nodo: pod.spec?.nodeName ?? null,
    zona: zonaDe.get(pod.spec?.nodeName) ?? null,
    fase: pod.status?.phase ?? null,
    listo: pod.status?.phase === "Running" && listo(pod.status?.conditions),
    rol: pod.metadata.labels?.["cnpg.io/instanceRole"] || pod.metadata.labels?.role || null,
  }));
}

export function postgresDesde(pods, cluster) {
  const declarado = cluster?.status?.currentPrimary ?? null;
  const instancias = pods.map((pod) => {
    const esPrimario = declarado ? pod.nombre === declarado : pod.rol === "primary";
    return {
      instancia: pod.nombre,
      nodo: pod.nodo,
      zona: pod.zona,
      rol: esPrimario ? "primary" : "replica",
      listo: pod.listo,
    };
  });
  const primario = instancias.find((instancia) => instancia.rol === "primary") ?? null;
  return {
    fase: cluster?.status?.phase ?? null,
    readyInstances: cluster?.status?.readyInstances ?? instancias.filter((instancia) => instancia.listo).length,
    currentPrimary: primario?.instancia ?? null,
    instancias,
    primario,
    replicasListas: instancias.filter((instancia) => instancia.listo && instancia.rol === "replica").length,
  };
}
