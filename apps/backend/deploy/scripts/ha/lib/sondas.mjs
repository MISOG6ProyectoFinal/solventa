/** Evalúa el cuerpo de una respuesta. /health no cuenta como flujo disponible. */

export function evaluarTiposDocumento(status, body) {
  return lista(status, body, (tipos) => tipos.includes("CC"), "catalogo-tipos-documento");
}

export function evaluarProductos(status, body) {
  return lista(
    status,
    body,
    (productos) => productos.length > 0 && productos.every((p) => p && typeof p.id === "string"),
    "catalogo-socio",
  );
}

export function evaluarRamos(status, body) {
  return lista(
    status,
    body,
    (ramos) => ramos.some((r) => Array.isArray(r?.productos) && r.productos.length > 0),
    "catalogo-portal",
  );
}

export function evaluarSiniestros(status, body) {
  return lista(status, body, () => true, "listado-avisos");
}

export function evaluarPrestadores(status, body) {
  const json = parsear(body);
  const ok = status === 200 && json?.type === "FeatureCollection" && Array.isArray(json.features);
  return { ok, motivo: ok ? "prestadores" : "respuesta-no-funcional" };
}

function lista(status, body, pred, motivoOk) {
  const json = parsear(body);
  const ok = status === 200 && Array.isArray(json) && pred(json);
  return { ok, motivo: ok ? motivoOk : "respuesta-no-funcional" };
}

function parsear(body) {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

/** Sondas de un ciclo. Sin credenciales, siniestros queda fuera del cálculo. */
export function sondasDe(env) {
  const sondas = [];
  if (env.SOCIO_CLIENT_ID && env.SOCIO_API_KEY) {
    sondas.push({
      flow: "venta",
      endpoint: "/socios/v1/productos",
      alcance: "catalogo-socio",
      evaluar: evaluarProductos,
      headers: { "X-Client-Id": env.SOCIO_CLIENT_ID, "X-Api-Key": env.SOCIO_API_KEY },
    });
  } else if (env.OPERADOR_CORREO && env.OPERADOR_CONTRASENA) {
    sondas.push({
      flow: "venta",
      endpoint: "/web/ramos",
      alcance: "catalogo-portal",
      evaluar: evaluarRamos,
      auth: "operador",
    });
  } else {
    sondas.push({
      flow: "venta",
      endpoint: "/movil/tipos-documento",
      alcance: "catalogo-tipos-documento",
      evaluar: evaluarTiposDocumento,
    });
  }
  if (env.MOVIL_CORREO && env.MOVIL_CONTRASENA) {
    sondas.push({
      flow: "siniestros",
      endpoint: "/movil/siniestros",
      alcance: "listado-avisos",
      evaluar: evaluarSiniestros,
      auth: "movil",
    });
    sondas.push({
      flow: "siniestros",
      endpoint: "/movil/prestadores/cercanos?lat=4.711&lon=-74.0721&radio_km=10",
      alcance: "prestadores",
      evaluar: evaluarPrestadores,
      auth: "movil",
    });
  }
  return sondas;
}
