import assert from 'node:assert/strict';
import { test } from 'node:test';

import { crearSocio, identificador, RAMO } from './socio.mjs';

function respuesta(status, cuerpo) {
  return { ok: status < 300, status, json: async () => cuerpo, text: async () => JSON.stringify(cuerpo) };
}

test('identificador usa la fecha y hora de la corrida', () => {
  assert.equal(identificador(new Date('2026-10-15T22:24:41.573Z')), 'CARGA-20261015222441');
});

test('crearSocio da de alta el socio y habilita todas las coberturas del ramo de viaje', async () => {
  const llamadas = [];
  const fetcher = async (url, opciones) => {
    llamadas.push({ url, metodo: opciones.method ?? 'GET', cuerpo: opciones.body && JSON.parse(opciones.body) });
    if (opciones.method === 'POST') return respuesta(201, { id: 's1', client_id: 'c1', secreto: 'k1' });
    if (opciones.method === 'PUT') return respuesta(200, {});
    return respuesta(200, { ramos: [{ id: RAMO, coberturas: [{ id: 'a' }, { id: 'b' }] }] });
  };
  const socio = await crearSocio('https://api.test', fetcher, new Date('2026-10-15T22:24:41Z'));
  assert.deepEqual(socio, { id: 's1', clientId: 'c1', secreto: 'k1' });
  assert.deepEqual(
    llamadas.map((l) => [l.metodo, l.url]),
    [
      ['POST', 'https://api.test/web/socios'],
      ['GET', 'https://api.test/web/socios/s1/configuracion'],
      ['PUT', 'https://api.test/web/socios/s1/configuracion'],
    ],
  );
  assert.equal(llamadas[0].cuerpo.identificador, 'CARGA-20261015222441');
  assert.deepEqual(llamadas[2].cuerpo.ramos, [{ ramo_id: RAMO, coberturas: ['a', 'b'] }]);
});

test('crearSocio falla con el detalle cuando el portal rechaza la solicitud', async () => {
  const fetcher = async () => respuesta(409, { codigo: 'identificador_duplicado' });
  await assert.rejects(crearSocio('https://api.test', fetcher), /respondió 409.*identificador_duplicado/);
});

test('crearSocio falla si el canal de socios no ofrece el ramo de viaje', async () => {
  const fetcher = async (_url, opciones) =>
    opciones.method === 'POST' ? respuesta(201, { id: 's1', client_id: 'c1', secreto: 'k1' }) : respuesta(200, { ramos: [] });
  await assert.rejects(crearSocio('https://api.test', fetcher), /no ofrece ramo-viaje/);
});
