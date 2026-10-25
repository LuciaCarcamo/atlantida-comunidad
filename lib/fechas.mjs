// Lógica de fechas y reglas de días.
// Este mismo archivo se usa al armar el sitio (Node) y en el navegador (assets/js/app.js).
// No usa nada específico de Node.

export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const tiene = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);
const dos = (n) => String(n).padStart(2, '0');

export function sinTildes(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const NOMBRES_DIA = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
const ORDINALES = {
  '1er': 1, '1ro': 1, '1ero': 1, '1': 1, primer: 1, primero: 1, primera: 1,
  '2do': 2, '2': 2, segundo: 2, segunda: 2,
  '3er': 3, '3ro': 3, '3': 3, tercer: 3, tercero: 3, tercera: 3,
  '4to': 4, '4': 4, cuarto: 4, cuarta: 4,
  '5to': 5, '5': 5, quinto: 5, quinta: 5,
  ultimo: -1, ultima: -1,
};

/**
 * Convierte "Martes", "2do Miércoles", "último sábado", "Todos los domingos"
 * en { dow: 0..6 (0 = domingo), nth: null | 1..5 | -1 }. Devuelve null si no se entiende.
 */
export function parseRegla(texto) {
  const t = sinTildes(texto)
    .replace(/[º°ª.]/g, '')
    .replace(/^(todos los|todas las|cada)\s+/, '');
  const partes = t.split(/\s+/).filter(Boolean);
  if (partes.length === 0 || partes.length > 2) return null;
  let dia = partes[partes.length - 1];
  if (!tiene(NOMBRES_DIA, dia) && dia.endsWith('s')) dia = dia.slice(0, -1);
  if (!tiene(NOMBRES_DIA, dia)) return null;
  let nth = null;
  if (partes.length === 2) {
    if (!tiene(ORDINALES, partes[0])) return null;
    nth = ORDINALES[partes[0]];
  }
  return { dow: NOMBRES_DIA[dia], nth };
}

export function diasDelMes(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate();
}

/** ¿La fecha cumple la regla? (por ejemplo, ¿es el 2.º miércoles del mes?) */
export function coincideDia(regla, fecha) {
  if (!regla || fecha.getDay() !== regla.dow) return false;
  if (regla.nth == null) return true;
  if (regla.nth === -1) return fecha.getDate() + 7 > diasDelMes(fecha);
  return Math.ceil(fecha.getDate() / 7) === regla.nth;
}

const ORD_TEXTO = { 1: '1.er', 2: '2.º', 3: '3.er', 4: '4.º', 5: '5.º', '-1': 'último' };

/** Texto legible de las repeticiones: [2,4] + miércoles => "2.º y 4.º miércoles del mes" */
export function describirOrdinales(nths, dow) {
  const dia = DIAS[dow];
  const orden = [...nths].sort((a, b) => (a === -1 ? 9 : b === -1 ? -9 : a - b));
  const etiquetas = orden.map((n) => ORD_TEXTO[String(n)]);
  const unidas = etiquetas.length > 1
    ? `${etiquetas.slice(0, -1).join(', ')} y ${etiquetas[etiquetas.length - 1]}`
    : etiquetas[0];
  return `${unidas} ${dia} del mes`;
}

/** "25-10-26", "25/10/2026", "2026-10-25" => "2026-10-25". Devuelve null si no es una fecha válida. */
export function parseFecha(texto) {
  const t = String(texto ?? '').trim();
  if (!t) return null;
  let y, m, d;
  let r = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (r) { y = +r[1]; m = +r[2]; d = +r[3]; }
  else {
    r = t.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
    if (!r) return null;
    d = +r[1]; m = +r[2]; y = +r[3];
    if (y < 100) y += 2000;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const control = new Date(y, m - 1, d, 12);
  if (control.getFullYear() !== y || control.getMonth() !== m - 1 || control.getDate() !== d) return null;
  return `${y}-${dos(m)}-${dos(d)}`;
}

/** "8:30", "08.30", "10hs", "16" => minutos desde las 0:00. Devuelve null si no se entiende. */
export function parseHora(texto) {
  const r = String(texto ?? '').trim().match(/^(\d{1,2})(?:[:.h](\d{2}))?\s*(?:hs?|hrs?)?$/i);
  if (!r) return null;
  const h = +r[1];
  const mi = r[2] ? +r[2] : 0;
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** 510 => "8:30", 960 => "16:00" */
export function formatoHora(min) {
  return `${Math.floor(min / 60)}:${dos(min % 60)}`;
}

export function isoDeFecha(fecha) {
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

/** Fecha y hora actuales en una zona horaria: { y, m, d, hh, mm } */
export function partesEnZona(zona, ahora = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const o = Object.fromEntries(f.formatToParts(ahora).map((p) => [p.type, p.value]));
  return { y: +o.year, m: +o.month, d: +o.day, hh: +o.hour, mm: +o.minute };
}

/** Fecha local al mediodía (evita saltos por cambio de hora) para y/m/d + desplazamiento en días */
export function fechaMasDias(ahora, dias = 0) {
  return new Date(ahora.y, ahora.m - 1, ahora.d + dias, 12);
}

/** ¿El ítem está vigente en esa fecha (ISO)? Sin límites = siempre vigente. */
export function vigente(item, iso) {
  if (item.desde && iso < item.desde) return false;
  if (item.hasta && iso > item.hasta) return false;
  return true;
}

/** Filas de horarios que ocurren en una fecha, ordenadas por hora. */
export function ocurrenciasDelDia(filas, fecha) {
  const iso = isoDeFecha(fecha);
  return filas
    .filter((f) => vigente(f, iso) && coincideDia({ dow: f.dow, nth: f.nth }, fecha))
    .sort((a, b) => a.min - b.min);
}

/**
 * Próxima ocurrencia a partir de "ahora" (incluye la de hoy si todavía no pasó).
 * Devuelve { fecha, offset, fila } o null si no hay ninguna en los próximos "dias" días.
 */
export function proximaOcurrencia(filas, ahora, { dias = 60 } = {}) {
  const minAhora = ahora.hh * 60 + ahora.mm;
  for (let offset = 0; offset <= dias; offset++) {
    const fecha = fechaMasDias(ahora, offset);
    let delDia = ocurrenciasDelDia(filas, fecha);
    if (offset === 0) delDia = delDia.filter((f) => f.min >= minAhora);
    if (delDia.length) return { fecha, offset, fila: delDia[0] };
  }
  return null;
}

/** "domingo 25 de octubre" */
export function fechaLarga(fecha) {
  return `${DIAS[fecha.getDay()]} ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`;
}

/** "7/11" */
export function fechaCorta(fecha) {
  return `${fecha.getDate()}/${fecha.getMonth() + 1}`;
}

/** "2026-11-07" => Date local al mediodía */
export function fechaDeIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
