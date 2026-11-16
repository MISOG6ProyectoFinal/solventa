export const CLUSTER = "solventa-ha-local";
export const NAMESPACE = "solventa";
export const ZONA_A = "ha-zone-a";
export const ZONA_B = "ha-zone-b";
export const ZONA_CONTROL = "ha-control";
export const ZONAS = [ZONA_A, ZONA_B];
export const PUERTO_API = 18080;
export const PUERTO_KSM = 18081;
export const PUERTO_GRAFANA = 13000;
export const PUERTO_PROMETHEUS = 19090;
export const PUERTO_PUSH = 19091;
export const COMPOSE_PROYECTO = "solventa-ha-obs";
export const TAG = "ha-local";
export const INTERVALO_S = 5;
export const RTO_MAX_MS = 10 * 60 * 1000;
export const SLO_MENSUAL = 0.9997;
export const CNPG_VERSION = "1.30.1";
export const CNPG_MANIFIESTO =
  "https://github.com/cloudnative-pg/cloudnative-pg/releases/download/v1.30.1/cnpg-1.30.1.yaml";
export const IMAGEN_POSTGRES = "ghcr.io/cloudnative-pg/postgis:17-3-system-trixie";
export const CLUSTER_PG = "solventa-pg";
export const SERVICIO_RW = "solventa-pg-rw";

/** Imágenes que el overlay llega a ejecutar. */
export const SERVICIOS_IMAGEN = [
  "canales",
  "identidad",
  "cotizacion",
  "polizas",
  "siniestros",
  "pagos",
  "simuladores",
];

/** Réplicas que tienen que quedar una en cada zona. */
export const SERVICIOS_CRITICOS = ["canales", "cotizacion", "polizas", "identidad", "siniestros", "pagos"];

/**
 * No arrancan. El manifiesto base se conserva y la réplica queda en cero
 * para no mantener otro conjunto de YAML.
 */
export const SERVICIOS_OMITIDOS = {
  auditoria: "Solo consume la cola de auditoría. No atiende la venta ni la consulta de siniestros.",
  "health-monitor": "Agrega la salud interna. No es un flujo de usuario.",
  "siniestros-worker": "Procesa la cola paramétrica. El listado de avisos y los prestadores no pasan por él.",
};

export const OPERADOR_CORREO = "admin@solventa.local";
export const OPERADOR_CONTRASENA = "Solventa-local-2026";
export const MOVIL_CORREO = "ha-prueba@solventa.test";
