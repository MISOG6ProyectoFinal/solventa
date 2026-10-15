#!/usr/bin/env node
// Crea el socio de la prueba de carga con el ramo de viaje habilitado e imprime: id client_id secreto
//   node load-tests/socio.mjs <baseUrl>
import { pathToFileURL } from 'node:url';

export const RAMO = 'ramo-viaje';

async function pedir(fetcher, url, opciones) {
  const respuesta = await fetcher(url, {
    ...opciones,
    headers: { 'Content-Type': 'application/json', ...(opciones?.headers ?? {}) },
  });
  if (!respuesta.ok) {
    throw new Error(`${opciones?.method ?? 'GET'} ${url} respondió ${respuesta.status}: ${await respuesta.text()}`);
  }
  return respuesta.json();
}

export function identificador(ahora = new Date()) {
  return `CARGA-${ahora.toISOString().replace(/\D/g, '').slice(0, 14)}`;
}

export async function crearSocio(baseUrl, fetcher = fetch, ahora = new Date()) {
  const socio = await pedir(fetcher, `${baseUrl}/web/socios`, {
    method: 'POST',
    body: JSON.stringify({
      nombre: 'Socio prueba de carga',
      identificador: identificador(ahora),
      tipo: 'Retailer',
      correo_contacto: 'carga@solventa.test',
      alcances: ['cotizacion'],
      autorizado_por: 'Prueba de carga',
    }),
  });
  const configuracion = await pedir(fetcher, `${baseUrl}/web/socios/${socio.id}/configuracion`);
  const viaje = configuracion.ramos.find((ramo) => ramo.id === RAMO);
  if (!viaje) throw new Error(`El canal de socios no ofrece ${RAMO}`);
  await pedir(fetcher, `${baseUrl}/web/socios/${socio.id}/configuracion`, {
    method: 'PUT',
    body: JSON.stringify({
      ramos: [{ ramo_id: RAMO, coberturas: viaje.coberturas.map((c) => c.id) }],
      actualizado_por: 'Prueba de carga',
    }),
  });
  return { id: socio.id, clientId: socio.client_id, secreto: socio.secreto };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const baseUrl = process.argv[2];
  if (!baseUrl) {
    console.error('Uso: node load-tests/socio.mjs <baseUrl>');
    process.exit(2);
  }
  crearSocio(baseUrl.replace(/\/$/, ''))
    .then(({ id, clientId, secreto }) => console.log(`${id} ${clientId} ${secreto}`))
    .catch((error) => {
      console.error(error.message);
      process.exit(1);
    });
}
