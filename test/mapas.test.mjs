import test from 'node:test';
import assert from 'node:assert/strict';
import { coordenadasDe, resolverMapas, incrustarCoordenadas } from '../lib/mapas.mjs';

test('coordenadasDe: punto exacto del lugar', () => {
  const u = 'https://www.google.com/maps/place/Iglesia/@-34.7766,-55.7618,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d-34.7770!4d-55.7620';
  assert.deepEqual(coordenadasDe(u), { lat: -34.777, lng: -55.762 });
});
test('coordenadasDe: centro del mapa y parámetro q', () => {
  assert.deepEqual(coordenadasDe('https://www.google.com/maps/@-34.5,-55.5,15z'), { lat: -34.5, lng: -55.5 });
  assert.deepEqual(coordenadasDe('https://maps.google.com/?q=-34.5,-55.5'), { lat: -34.5, lng: -55.5 });
});
test('coordenadasDe: sin coordenadas o fuera de rango', () => {
  assert.equal(coordenadasDe('https://maps.app.goo.gl/abc'), null);
  assert.equal(coordenadasDe('@-934.5,-55.5'), null);
});
test('incrustarCoordenadas arma la dirección del mapa', () => {
  assert.match(incrustarCoordenadas({ lat: -34.5, lng: -55.5 }), /output=embed/);
});
test('resolverMapas: usa el resultado de seguir el link y avisa si falla', async () => {
  const avisos = [];
  const iglesias = [{ cod: 'a', maps: 'https://maps.app.goo.gl/x' }, { cod: 'b', maps: 'https://maps.app.goo.gl/y' }, { cod: 'c', maps: '' }];
  const seguir = async (u) => (u.endsWith('x') ? { lat: -34, lng: -55 } : null);
  const r = await resolverMapas(iglesias, { archivoCache: '/no-existe/mapas.json', avisos, seguir });
  assert.deepEqual(r, { a: { lat: -34, lng: -55 } });
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /Mapa de b/);
});
