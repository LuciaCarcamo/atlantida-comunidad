import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseRegla, coincideDia, parseFecha, parseHora, formatoHora, describirOrdinales,
  proximaOcurrencia, partesEnZona, fechaMasDias, ocurrenciasDelDia, fechaLarga, vigente,
} from '../lib/fechas.mjs';

const f = (y, m, d) => new Date(y, m - 1, d, 12);

test('parseRegla entiende días simples y con ordinal', () => {
  assert.deepEqual(parseRegla('Martes'), { dow: 2, nth: null });
  assert.deepEqual(parseRegla('Sábado'), { dow: 6, nth: null });
  assert.deepEqual(parseRegla('sabados'), { dow: 6, nth: null });
  assert.deepEqual(parseRegla('Todos los domingos'), { dow: 0, nth: null });
  assert.deepEqual(parseRegla('2do Miércoles'), { dow: 3, nth: 2 });
  assert.deepEqual(parseRegla('4to Miercoles'), { dow: 3, nth: 4 });
  assert.deepEqual(parseRegla('1er Miércoles'), { dow: 3, nth: 1 });
  assert.deepEqual(parseRegla('3er miércoles'), { dow: 3, nth: 3 });
  assert.deepEqual(parseRegla('Último viernes'), { dow: 5, nth: -1 });
  assert.equal(parseRegla('Feriados'), null);
  assert.equal(parseRegla(''), null);
  assert.equal(parseRegla('7mo Lunes'), null);
});

test('coincideDia: n-ésimo día de la semana del mes', () => {
  const segundoMie = { dow: 3, nth: 2 };
  assert.equal(coincideDia(segundoMie, f(2026, 10, 14)), true);
  assert.equal(coincideDia(segundoMie, f(2026, 10, 7)), false);
  assert.equal(coincideDia(segundoMie, f(2026, 10, 21)), false);
  const cuartoMie = { dow: 3, nth: 4 };
  assert.equal(coincideDia(cuartoMie, f(2026, 10, 28)), true);
  const ultimoMie = { dow: 3, nth: -1 };
  assert.equal(coincideDia(ultimoMie, f(2026, 11, 25)), true);
  assert.equal(coincideDia(ultimoMie, f(2026, 11, 18)), false);
  assert.equal(coincideDia({ dow: 0, nth: null }, f(2026, 10, 25)), true); // domingo
});

test('parseFecha acepta los formatos de la planilla', () => {
  assert.equal(parseFecha('1-11-26'), '2026-11-01');
  assert.equal(parseFecha('7-11-26'), '2026-11-07');
  assert.equal(parseFecha('01-01-2050'), '2050-01-01');
  assert.equal(parseFecha('25/10/2026'), '2026-10-25');
  assert.equal(parseFecha('2026-10-25'), '2026-10-25');
  assert.equal(parseFecha('31-02-2026'), null);
  assert.equal(parseFecha('mañana'), null);
  assert.equal(parseFecha(''), null);
});

test('parseHora y formatoHora', () => {
  assert.equal(parseHora('8:30'), 510);
  assert.equal(parseHora('08.30'), 510);
  assert.equal(parseHora('16:00'), 960);
  assert.equal(parseHora('10hs'), 600);
  assert.equal(parseHora('25:00'), null);
  assert.equal(parseHora('abc'), null);
  assert.equal(formatoHora(510), '8:30');
  assert.equal(formatoHora(960), '16:00');
  assert.equal(formatoHora(1035), '17:15');
});

test('describirOrdinales', () => {
  assert.equal(describirOrdinales([2, 4], 3), '2.º y 4.º miércoles del mes');
  assert.equal(describirOrdinales([3, 1], 3), '1.er y 3.er miércoles del mes');
  assert.equal(describirOrdinales([-1], 5), 'último viernes del mes');
});

test('partesEnZona usa la hora de Montevideo', () => {
  const p = partesEnZona('America/Montevideo', new Date('2026-10-25T18:08:00Z'));
  assert.deepEqual(p, { y: 2026, m: 10, d: 25, hh: 15, mm: 8 });
});

test('vigente respeta desde y hasta (inclusive)', () => {
  const it = { desde: '2026-11-01', hasta: '2026-11-07' };
  assert.equal(vigente(it, '2026-10-31'), false);
  assert.equal(vigente(it, '2026-11-01'), true);
  assert.equal(vigente(it, '2026-11-07'), true);
  assert.equal(vigente(it, '2026-11-08'), false);
  assert.equal(vigente({}, '2026-11-08'), true);
});

// Datos reales de la planilla (resumidos)
const base = { desde: '2026-01-01', hasta: '2050-01-01' };
const filas = [
  { cod: 'atlantida', dow: 2, nth: null, min: 960, act: 'Misa', ...base },
  { cod: 'atlantida', dow: 5, nth: null, min: 1020, act: 'Misa', ...base },
  { cod: 'atlantida', dow: 0, nth: null, min: 630, act: 'Misa', ...base },
  { cod: 'est-atlantida', dow: 0, nth: null, min: 540, act: 'Misa', ...base },
  { cod: 'est-atlantida', dow: 3, nth: 2, min: 960, act: 'Misa', ...base },
  { cod: 'est-atlantida', dow: 3, nth: 4, min: 960, act: 'Misa', ...base },
];

test('proximaOcurrencia: hoy si todavía no pasó, si no la siguiente', () => {
  const ati = filas.filter((x) => x.cod === 'atlantida');
  // domingo 25/10/2026 a las 9:00 -> hoy 10:30
  let r = proximaOcurrencia(ati, { y: 2026, m: 10, d: 25, hh: 9, mm: 0 });
  assert.equal(r.offset, 0);
  assert.equal(r.fila.min, 630);
  // domingo 25/10 a las 15:00 -> martes 27/10 16:00
  r = proximaOcurrencia(ati, { y: 2026, m: 10, d: 25, hh: 15, mm: 0 });
  assert.equal(r.offset, 2);
  assert.equal(fechaLarga(r.fecha), 'martes 27 de octubre');
  assert.equal(r.fila.min, 960);
});

test('proximaOcurrencia con misas del 2.º y 4.º miércoles', () => {
  const est = filas.filter((x) => x.cod === 'est-atlantida');
  // domingo 25/10 15:00 -> miércoles 28/10 (4.º del mes)
  let r = proximaOcurrencia(est, { y: 2026, m: 10, d: 25, hh: 15, mm: 0 });
  assert.equal(fechaLarga(r.fecha), 'miércoles 28 de octubre');
  // miércoles 28/10 17:00 -> domingo 1/11 9:00
  r = proximaOcurrencia(est, { y: 2026, m: 10, d: 28, hh: 17, mm: 0 });
  assert.equal(fechaLarga(r.fecha), 'domingo 1 de noviembre');
  // miércoles 11/11 es el 2.º miércoles de noviembre
  const dia = ocurrenciasDelDia(est, f(2026, 11, 11));
  assert.equal(dia.length, 1);
  assert.equal(dia[0].min, 960);
  // miércoles 4/11 es el 1.º: no hay misa
  assert.equal(ocurrenciasDelDia(est, f(2026, 11, 4)).length, 0);
});

test('proximaOcurrencia respeta la vigencia', () => {
  const verano = [{ cod: 'x', dow: 0, nth: null, min: 1200, act: 'Misa', desde: '2026-12-15', hasta: '2027-03-01' }];
  const r = proximaOcurrencia(verano, { y: 2026, m: 12, d: 1, hh: 10, mm: 0 }, { dias: 60 });
  assert.equal(fechaLarga(r.fecha), 'domingo 20 de diciembre');
  assert.equal(proximaOcurrencia(verano, { y: 2026, m: 12, d: 1, hh: 10, mm: 0 }, { dias: 5 }), null);
});

test('fechaMasDias cruza fin de mes', () => {
  assert.equal(fechaLarga(fechaMasDias({ y: 2026, m: 10, d: 30 }, 3)), 'lunes 2 de noviembre');
});
