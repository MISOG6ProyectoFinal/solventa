import { check } from 'k6';
import http from 'k6/http';
import { Counter, Rate } from 'k6/metrics';

import { generarReportes, PETICIONES } from './lib/reporte.mjs';

const BASE_URL = (__ENV.BASE_URL || 'https://dzwq94g5om86y.cloudfront.net').replace(/\/$/, '');
const PERFIL = __ENV.PERFIL || 'carga';
const UMBRALES = {
  umbralP95: Number(__ENV.UMBRAL_P95_MS || 1000),
  umbralCotizacion: Number(__ENV.UMBRAL_COTIZACION_MS || 400),
  umbralErrores: Number(__ENV.UMBRAL_ERRORES || 1),
};
const PRODUCTO = 'viaje-internacional';
const RAMO = 'ramo-viaje';
const EVIDENCIA = open('./fixtures/evidencia.png', 'b');
const JSON_HEADERS = { 'Content-Type': 'application/json' };

const errores = new Rate('errores');
const cotizaciones = new Counter('cotizaciones');

function escenarios() {
  const duracion = __ENV.DURACION || '2m';
  if (PERFIL === 'humo') {
    return {
      movil: { executor: 'shared-iterations', exec: 'movil', vus: 1, iterations: 1 },
      web: { executor: 'shared-iterations', exec: 'web', vus: 1, iterations: 1 },
      socios: { executor: 'shared-iterations', exec: 'socios', vus: 1, iterations: 1 },
    };
  }
  if (PERFIL === 'asr04') {
    return {
      socios: {
        executor: 'ramping-arrival-rate',
        exec: 'socios',
        timeUnit: '1m',
        startRate: Number(__ENV.TASA_INICIAL || 500),
        preAllocatedVUs: Number(__ENV.VUS_INICIALES || 50),
        maxVUs: Number(__ENV.VUS_MAXIMOS || 1000),
        stages: [
          { target: Number(__ENV.TASA_OBJETIVO || 50000), duration: __ENV.RAMPA || '60s' },
          { target: Number(__ENV.TASA_OBJETIVO || 50000), duration: __ENV.SOSTENIDO || '5m' },
        ],
      },
    };
  }
  return {
    movil: { executor: 'constant-vus', exec: 'movil', vus: Number(__ENV.USUARIOS_MOVIL || 5), duration: duracion },
    web: { executor: 'constant-vus', exec: 'web', vus: Number(__ENV.USUARIOS_WEB || 2), duration: duracion },
    socios: {
      executor: 'constant-arrival-rate',
      exec: 'socios',
      rate: Number(__ENV.TASA_SOCIOS || 600),
      timeUnit: '1m',
      duration: duracion,
      preAllocatedVUs: Number(__ENV.VUS_SOCIOS || 20),
      maxVUs: Number(__ENV.VUS_MAXIMOS || 200),
    },
  };
}

function umbrales() {
  const definidos = { errores: [`rate<=${UMBRALES.umbralErrores / 100}`] };
  if (PERFIL !== 'humo') definidos.dropped_iterations = ['count==0'];
  definidos['http_req_duration{fase:prueba}'] = ['max>=0'];
  for (const { nombre, cotizacion } of PETICIONES) {
    const objetivo = cotizacion ? UMBRALES.umbralCotizacion : UMBRALES.umbralP95;
    definidos[`http_req_duration{name:${nombre}}`] = [`p(95)<=${objetivo}`];
    definidos[`errores{name:${nombre}}`] = [`rate<=${UMBRALES.umbralErrores / 100}`];
    definidos[`http_reqs{name:${nombre}}`] = ['count>=0'];
  }
  return definidos;
}

export const options = {
  scenarios: escenarios(),
  thresholds: umbrales(),
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  setupTimeout: '60s',
};

function aleatorio(bytes) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}

function fecha(desplazamientoDias) {
  const valor = new Date(Date.now() + desplazamientoDias * 24 * 60 * 60 * 1000);
  return valor.toISOString().slice(0, 10);
}

function solicitudViaje() {
  return { producto_id: PRODUCTO, destino: 'España', fecha_salida: fecha(30), fecha_regreso: fecha(40), viajeros: 2 };
}

function pedir(nombre, metodo, url, cuerpo, { estado = 200, headers = {}, validar } = {}) {
  const parametros = { headers: { ...(cuerpo === null ? {} : JSON_HEADERS), ...headers }, tags: { name: nombre, fase: 'prueba' } };
  const datos = cuerpo === null || cuerpo instanceof ArrayBuffer ? cuerpo : JSON.stringify(cuerpo);
  const respuesta = http.request(metodo, url, datos, parametros);
  let json = null;
  const ok = check(
    respuesta,
    {
      [`${nombre}: estado ${estado}`]: (r) => r.status === estado,
      [`${nombre}: respuesta válida`]: (r) => {
        if (!validar) return true;
        try {
          json = r.json();
          return validar(json);
        } catch {
          return false;
        }
      },
    },
    { name: nombre },
  );
  errores.add(!ok, { name: nombre });
  return ok ? (json ?? (respuesta.body ? safeJson(respuesta) : null)) : null;
}

function safeJson(respuesta) {
  try {
    return respuesta.json();
  } catch {
    return null;
  }
}

function cotizar(nombre, url, cuerpo, headers) {
  const oferta = pedir(nombre, 'POST', url, cuerpo, {
    headers,
    validar: (o) => Number(o.prima) > 0 && Array.isArray(o.coberturas) && o.coberturas.length > 0,
  });
  if (oferta) cotizaciones.add(1, { name: nombre });
}

export function setup() {
  if (__ENV.SOCIO_ID && __ENV.SOCIO_CLIENT_ID && __ENV.SOCIO_SECRETO) {
    return { socioId: __ENV.SOCIO_ID, clientId: __ENV.SOCIO_CLIENT_ID, secreto: __ENV.SOCIO_SECRETO };
  }
  const identificador = `CARGA-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;
  const alta = http.post(
    `${BASE_URL}/web/socios`,
    JSON.stringify({
      nombre: 'Socio prueba de carga',
      identificador,
      tipo: 'Retailer',
      correo_contacto: 'carga@solventa.test',
      alcances: ['cotizacion'],
      autorizado_por: 'Prueba de carga',
    }),
    { headers: JSON_HEADERS, tags: { name: 'Preparación' } },
  );
  if (alta.status !== 201) throw new Error(`Alta del socio de prueba: ${alta.status} ${alta.body}`);
  const socio = alta.json();
  const configuracion = http.get(`${BASE_URL}/web/socios/${socio.id}/configuracion`, { tags: { name: 'Preparación' } });
  const viaje = configuracion.json().ramos.find((r) => r.id === RAMO);
  const habilitar = http.put(
    `${BASE_URL}/web/socios/${socio.id}/configuracion`,
    JSON.stringify({
      ramos: [{ ramo_id: RAMO, coberturas: viaje.coberturas.map((c) => c.id) }],
      actualizado_por: 'Prueba de carga',
    }),
    { headers: JSON_HEADERS, tags: { name: 'Preparación' } },
  );
  if (habilitar.status !== 200) throw new Error(`Configuración del socio de prueba: ${habilitar.status} ${habilitar.body}`);
  console.log(`Socio de la prueba: ${socio.id} (${identificador})`);
  return { socioId: socio.id, clientId: socio.client_id, secreto: socio.secreto };
}

export function movil() {
  pedir('BFF móvil disponible', 'GET', `${BASE_URL}/movil/`, null);
  pedir('Catálogo de productos', 'GET', `${BASE_URL}/movil/productos`, null, {
    validar: (productos) => productos.some((p) => p.id === PRODUCTO),
  });
  cotizar('Cotizar desde el móvil', `${BASE_URL}/movil/cotizaciones`, {
    ...solicitudViaje(),
    nombre: 'Prueba Carga',
    cedula: String(1e9 + (Number.parseInt(aleatorio(4), 16) % 9e9)),
  });

  const correo = `carga-${Date.now()}-${__VU}-${__ITER}@solventa.test`;
  const contrasena = `Clave-${aleatorio(12)}`;
  const cuenta = pedir(
    'Registrar cliente',
    'POST',
    `${BASE_URL}/movil/registros`,
    { correo, contrasena, nombre: 'Prueba', apellido: 'Carga' },
    { estado: 201, validar: (c) => Boolean(c.token) },
  );
  const sesion = cuenta && pedir('Iniciar sesión', 'POST', `${BASE_URL}/movil/sesiones`, { correo, contrasena }, {
    validar: (s) => Boolean(s.token),
  });
  if (sesion) {
    pedir('Consultar sesión', 'GET', `${BASE_URL}/movil/sesion`, null, {
      headers: { Authorization: `Bearer ${sesion.token}` },
      validar: (s) => s.correo === correo,
    });
  }

  const aviso = pedir(
    'Reportar siniestro',
    'POST',
    `${BASE_URL}/movil/siniestros`,
    {
      poliza_id: 'SLV-2026-03105',
      tipo: 'Accidente con vehículo de alquiler',
      ocurrido_en: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 19),
      descripcion: 'Aviso generado por la prueba de carga',
      ubicacion: 'Calle 85 #12-34, Chapinero, Bogotá',
    },
    { estado: 201, validar: (a) => a.estado === 'borrador' },
  );
  if (!aviso) return;
  const carga = pedir(
    'Solicitar carga de evidencia',
    'POST',
    `${BASE_URL}/movil/siniestros/${aviso.id}/evidencias/cargas`,
    { content_type: 'image/png', bytes: EVIDENCIA.byteLength },
    { estado: 201, validar: (c) => Boolean(c.upload_url) },
  );
  if (!carga) return;
  pedir('Subir evidencia', 'PUT', carga.upload_url, EVIDENCIA, { headers: { 'Content-Type': 'image/png' } });
  pedir('Confirmar evidencia', 'POST', `${BASE_URL}/movil/siniestros/${aviso.id}/evidencias/${carga.evidencia_id}/confirmar`, null, {
    validar: (e) => e.estado === 'disponible',
  });
  pedir('Listar evidencias', 'GET', `${BASE_URL}/movil/siniestros/${aviso.id}/evidencias`, null, {
    validar: (lista) => lista.length > 0,
  });
}

export function web(datos) {
  cotizar('Cotizar desde el portal', `${BASE_URL}/web/cotizaciones`, solicitudViaje());
  pedir('Listar socios', 'GET', `${BASE_URL}/web/socios`, null, { validar: (socios) => socios.length > 0 });
  pedir('Detalle del socio', 'GET', `${BASE_URL}/web/socios/${datos.socioId}`, null, {
    validar: (socio) => socio.id === datos.socioId,
  });
  pedir('Configuración del socio', 'GET', `${BASE_URL}/web/socios/${datos.socioId}/configuracion`, null, {
    validar: (c) => c.ramos.find((r) => r.id === RAMO).habilitado,
  });
}

export function socios(datos) {
  cotizar('Cotizar como socio', `${BASE_URL}/socios/v1/cotizaciones`, solicitudViaje(), {
    'X-Client-Id': datos.clientId,
    'X-Api-Key': datos.secreto,
  });
}

export function handleSummary(data) {
  return generarReportes(data, { ...UMBRALES, perfil: PERFIL, carpeta: __ENV.SALIDA || 'resultados' });
}
