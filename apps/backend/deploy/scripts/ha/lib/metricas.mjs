export function lineasSonda({ flow, up, latenciaMs, exitos, fallos }) {
  return exposicionSondas([{ flow, up, latenciaMs, exitos, fallos }]);
}

export function exposicionSondas(flujos) {
  const series = [
    ["ha_probe_up", (item) => (item.up ? 1 : 0), () => true],
    ["ha_probe_latency_ms", (item) => item.latenciaMs, (item) => item.latenciaMs != null],
    ["ha_probe_exitos", (item) => item.exitos, () => true],
    ["ha_probe_fallos", (item) => item.fallos, () => true],
  ];
  const lineas = [];
  for (const [nombre, valor, incluir] of series) {
    const visibles = flujos.filter(incluir);
    if (!visibles.length) continue;
    lineas.push(`# TYPE ${nombre} gauge`);
    for (const item of visibles) lineas.push(`${nombre}{flow="${item.flow}"} ${valor(item)}`);
  }
  return lineas.join("\n");
}

export function empujar(url, cuerpo) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "text/plain; version=0.0.4" },
    body: `${cuerpo}\n`,
  }).then(
    (respuesta) => respuesta.ok,
    () => false,
  );
}
