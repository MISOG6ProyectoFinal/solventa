import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { analizar, csv, histograma, html, lineaDeTiempo, main, markdown, muestras, percentile } from './report.mjs';

const BASE = Date.parse('2026-10-15T22:00:00Z');

function ejecucion(nombre, { codigo = 200, ms = 100, segundo = 0, fallo = false, sinRespuesta = false } = {}) {
  return {
    item: { name: nombre },
    assertions: [{ assertion: 'ok', ...(fallo ? { error: { message: 'falló' } } : {}) }],
    ...(sinRespuesta
      ? { requestError: { message: 'ECONNRESET' } }
      : {
          response: {
            code: codigo,
            responseTime: ms,
            responseSize: 10,
            header: [{ key: 'Date', value: new Date(BASE + segundo * 1000).toUTCString() }],
          },
        }),
  };
}

function corrida(ejecuciones, duracionMs = 4000) {
  return { run: { timings: { started: BASE, completed: BASE + duracionMs }, executions: ejecuciones } };
}

test('percentile usa el rango más cercano', () => {
  const datos = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  assert.equal(percentile(datos, 50), 50);
  assert.equal(percentile(datos, 95), 100);
  assert.equal(percentile(datos, 0), 10);
  assert.equal(percentile([], 95), 0);
});

test('muestras marca como error los códigos fuera de 2xx, las aserciones fallidas y las peticiones sin respuesta', () => {
  const lista = muestras(
    corrida([
      ejecucion('a'),
      ejecucion('b', { codigo: 503 }),
      ejecucion('c', { fallo: true }),
      ejecucion('d', { sinRespuesta: true }),
    ]),
    1,
  );
  assert.deepEqual(
    lista.map((m) => [m.peticion, m.error]),
    [
      ['a', false],
      ['b', true],
      ['c', true],
      ['d', true],
    ],
  );
  assert.equal(lista[3].segundo, Math.floor(BASE / 1000));
});

test('lineaDeTiempo agrupa por segundo e incluye los segundos sin peticiones', () => {
  const lista = muestras(corrida([ejecucion('a', { segundo: 0 }), ejecucion('a', { segundo: 2, codigo: 500 })]), 1);
  const linea = lineaDeTiempo(lista);
  assert.deepEqual(
    linea.map((s) => [s.segundo, s.peticiones, s.errores]),
    [
      [0, 1, 0],
      [1, 0, 0],
      [2, 1, 1],
    ],
  );
  assert.deepEqual(lineaDeTiempo([]), []);
});

test('histograma reparte las latencias y acumula las colas en la última cubeta', () => {
  const lista = [10, 20, 30, 1000].map((ms) => ({ ms }));
  const cubetas = histograma(lista, 4);
  assert.equal(cubetas.reduce((a, c) => a + c.cantidad, 0), 4);
  assert.match(cubetas.at(-1).etiqueta, /^>=/);
  assert.deepEqual(histograma([]), []);
});

test('analizar calcula rendimiento y veredicto con los umbrales', () => {
  const corridas = [
    { usuario: 1, corrida: corrida([ejecucion('a', { ms: 100 }), ejecucion('b', { ms: 300 })]) },
    { usuario: 2, corrida: corrida([ejecucion('a', { ms: 200 }), ejecucion('b', { ms: 400, codigo: 500 })]) },
  ];
  const cumple = analizar(corridas, { umbralP95: 500, umbralErrores: 50 });
  assert.equal(cumple.usuarios, 2);
  assert.equal(cumple.rendimiento, 1);
  assert.equal(cumple.filas.at(-1).peticiones, 4);
  assert.equal(cumple.filas.at(-1).pctErrores, 25);
  assert.equal(cumple.cumple, true);
  assert.equal(analizar(corridas, { umbralP95: 300, umbralErrores: 50 }).cumple, false);
  assert.equal(analizar(corridas, { umbralP95: 500, umbralErrores: 10 }).cumple, false);
});

test('los formatos de salida incluyen cada petición y el total', () => {
  const analisis = analizar([{ usuario: 1, corrida: corrida([ejecucion('Cotizar <x>')]) }], {
    umbralP95: 1000,
    umbralErrores: 1,
  });
  assert.match(csv(analisis), /^peticion,peticiones/);
  assert.match(csv(analisis), /"Total",1,0/);
  assert.match(markdown(analisis), /\*\*Total\*\*/);
  const pagina = html(analisis);
  assert.match(pagina, /Cotizar &lt;x&gt;/);
  assert.doesNotMatch(pagina, /Cotizar <x>/);
  assert.match(pagina, /integrity="sha384-/);
});

test('main escribe los archivos y devuelve el código según el veredicto', () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'carga-'));
  writeFileSync(join(carpeta, 'usuario-1.json'), JSON.stringify(corrida([ejecucion('a', { ms: 50 })])));
  assert.equal(main([carpeta, '--umbral-p95', '100']), 0);
  assert.equal(JSON.parse(readFileSync(join(carpeta, 'resumen.json'), 'utf8')).cumple, true);
  assert.equal(main([carpeta, '--umbral-p95', '10']), 1);
  assert.equal(main([]), 2);
  assert.equal(main([mkdtempSync(join(tmpdir(), 'vacia-'))]), 2);
});
