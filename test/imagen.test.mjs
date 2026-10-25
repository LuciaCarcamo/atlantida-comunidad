import test from 'node:test';
import assert from 'node:assert/strict';
import { medidasImagen } from '../lib/imagen.mjs';

test('medidasImagen lee PNG', () => {
  const b = Buffer.alloc(32);
  b.writeUInt32BE(0x89504e47, 0);
  b.writeUInt32BE(640, 16);
  b.writeUInt32BE(480, 20);
  assert.deepEqual(medidasImagen(b), { w: 640, h: 480 });
});

test('medidasImagen lee WebP (VP8X)', () => {
  const b = Buffer.alloc(32);
  b.write('RIFF', 0, 'ascii'); b.write('WEBP', 8, 'ascii'); b.write('VP8X', 12, 'ascii');
  b.writeUIntLE(1599, 24, 3);
  b.writeUIntLE(899, 27, 3);
  assert.deepEqual(medidasImagen(b), { w: 1600, h: 900 });
});

test('medidasImagen devuelve null si no es una imagen conocida', () => {
  assert.equal(medidasImagen(Buffer.from('hola mundo, esto no es una imagen de verdad')), null);
});
