// Lectura y normalización de los datos de la planilla (solo Node).
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseRegla, parseFecha, parseHora } from './fechas.mjs';

/* ---------- CSV ---------- */

export function parseCSV(texto) {
  const filas = [];
  let fila = [];
  let campo = '';
  let comillas = false;
  const t = texto.replace(/^﻿/, '');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (comillas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; } else comillas = false;
      } else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      fila.push(campo); campo = ''; filas.push(fila); fila = [];
    } else campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
  return filas;
}

export function csvAObjetos(texto) {
  const filas = parseCSV(texto).filter((f) => f.some((c) => c.trim() !== ''));
  if (!filas.length) return [];
  const cab = filas[0].map((h) => h.trim().toLowerCase());
  return filas.slice(1).map((f) => Object.fromEntries(cab.map((h, i) => [h, (f[i] ?? '').trim()])));
}

function minusculasClaves(obj) {
  return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.trim().toLowerCase(), String(v ?? '').trim()]));
}

/* ---------- Carga con respaldo ---------- */

const COLUMNAS_OBLIGATORIAS = {
  iglesias: ['cod_iglesia', 'nombre_iglesia'],
  horarios: ['cod_iglesia', 'dia_misa', 'horario_misa'],
  grupos: ['cod_iglesia', 'grupo'],
  avisos: ['desc_aviso'],
  secretaria: ['direccion_secretaria'],
  config: ['clave', 'valor'],
};

async function descargar(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const texto = await r.text();
    if (/^\s*</.test(texto)) throw new Error('la respuesta es una página web, no un CSV (¿la hoja está publicada en formato CSV?)');
    return texto;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Devuelve { filas, origen: 'google' | 'respaldo' | 'vacío' }.
 * Si el link falla o la hoja no tiene las columnas esperadas, usa la copia de datos/respaldo.
 */
export async function cargarHoja(nombre, url, { dirRespaldo, avisos, actualizarRespaldo = false }) {
  const faltan = (filas) => COLUMNAS_OBLIGATORIAS[nombre].filter((c) => filas.length && !(c in filas[0]));

  if (url) {
    try {
      const filas = csvAObjetos(await descargar(url));
      const f = faltan(filas);
      if (!filas.length) throw new Error('la hoja está vacía');
      if (f.length) throw new Error(`faltan columnas: ${f.join(', ')}`);
      if (actualizarRespaldo) {
        await writeFile(path.join(dirRespaldo, `${nombre}.json`), JSON.stringify(filas, null, 2) + '\n');
      }
      return { filas, origen: 'google' };
    } catch (e) {
      avisos.push(`Hoja "${nombre}": no se pudo leer de Google (${e.message}). Se usa la copia de respaldo.`);
    }
  }

  try {
    const crudo = JSON.parse(await readFile(path.join(dirRespaldo, `${nombre}.json`), 'utf8'));
    return { filas: crudo.map(minusculasClaves), origen: 'respaldo' };
  } catch {
    if (nombre !== 'config' && nombre !== 'secretaria') avisos.push(`Hoja "${nombre}": no hay datos (ni de Google ni de respaldo).`);
    return { filas: [], origen: 'vacío' };
  }
}

/* ---------- Normalización ---------- */

const limpiar = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
/** Primer valor no vacío entre varios nombres posibles de columna */
const elegir = (fila, ...nombres) => {
  for (const n of nombres) if (fila[n] !== undefined && limpiar(fila[n]) !== '') return limpiar(fila[n]);
  return '';
};

const DESDE_SIEMPRE = '';
const HASTA_SIEMPRE = '';

function fechaOpcional(texto, etiqueta, avisos) {
  const t = limpiar(texto);
  if (!t) return '';
  const iso = parseFecha(t);
  if (!iso) avisos.push(`${etiqueta}: la fecha "${t}" no se entiende (usá día-mes-año, por ejemplo 07-11-2026). Se ignora ese límite.`);
  return iso ?? '';
}

export function normalizarIglesias(filas, avisos) {
  const vistos = new Set();
  const out = [];
  filas.forEach((r, i) => {
    const cod = elegir(r, 'cod_iglesia').toLowerCase();
    const nombre = elegir(r, 'nombre_iglesia');
    if (!cod || !nombre) { avisos.push(`Iglesias, fila ${i + 2}: falta cod_iglesia o nombre_iglesia. Se omite.`); return; }
    if (!/^[a-z0-9-]+$/.test(cod)) { avisos.push(`Iglesias, fila ${i + 2}: cod_iglesia "${cod}" solo puede tener minúsculas, números y guiones. Se omite.`); return; }
    if (vistos.has(cod)) { avisos.push(`Iglesias, fila ${i + 2}: cod_iglesia "${cod}" está repetido. Se omite.`); return; }
    vistos.add(cod);
    out.push({
      cod,
      nombre,
      localidad: elegir(r, 'localidad_iglesia', 'localidad'),
      maps: elegir(r, 'ubicacion_maps', 'maps_iglesia', 'maps'),
      direccion: elegir(r, 'direccion_iglesia', 'direccion', 'dirección'),
      telefono: elegir(r, 'telefono_iglesia', 'telefono', 'teléfono', 'tel_iglesia'),
      horarioParroquial: elegir(r, 'horario_parroquial_iglesia', 'horario_parroquial', 'horario_iglesia'),
      foto: elegir(r, 'foto_iglesia', 'foto'),
      whatsapp: elegir(r, 'whatsapp_iglesia', 'whatsapp_comunidad', 'wa_iglesia'),
      descripcion: elegir(r, 'desc_iglesia', 'descripcion_iglesia'),
      // Color de la página: "burdeos" o "salvia". Si la columna no existe o está vacía, se alternan solos.
      tema: temaDe(elegir(r, 'color_iglesia', 'tema_iglesia')),
    });
  });
  // Alternar burdeos / salvia según el orden en la hoja, salvo que se haya indicado uno
  out.forEach((ig, i) => { if (!ig.tema) ig.tema = i % 2 === 0 ? 'burdeos' : 'salvia'; });
  return out;
}

function temaDe(t) {
  const x = t.toLowerCase();
  if (x.startsWith('burd') || x === 'vino') return 'burdeos';
  if (x.startsWith('salv') || x === 'verde') return 'salvia';
  return '';
}

/** Hoja Secretaria: una o más filas, cada una con vigencia opcional */
export function normalizarSecretaria(filas, avisos) {
  const out = [];
  filas.forEach((r, i) => {
    const donde = `Secretaria, fila ${i + 2}`;
    const direccion = elegir(r, 'direccion_secretaria', 'direccion');
    const telefono = elegir(r, 'telefono_secretaria', 'telefono');
    const horario = elegir(r, 'horario_secretaria', 'horario');
    if (!direccion && !telefono && !horario) return;
    out.push({
      direccion, telefono, horario,
      desde: fechaOpcional(elegir(r, 'desde_vigencia_secretaria'), donde, avisos),
      hasta: fechaOpcional(elegir(r, 'hasta_vigencia_secretaria'), donde, avisos),
    });
  });
  return out;
}

export function normalizarHorarios(filas, iglesias, avisos) {
  const codigos = new Set(iglesias.map((i) => i.cod));
  const out = [];
  filas.forEach((r, i) => {
    const donde = `Horarios_misas, fila ${i + 2}`;
    const cod = elegir(r, 'cod_iglesia').toLowerCase();
    if (!cod) return;
    if (!codigos.has(cod)) { avisos.push(`${donde}: la iglesia "${cod}" no existe en la hoja Iglesias. Se omite.`); return; }
    const regla = parseRegla(elegir(r, 'dia_misa'));
    if (!regla) { avisos.push(`${donde}: el día "${elegir(r, 'dia_misa')}" no se entiende. Se omite.`); return; }
    const min = parseHora(elegir(r, 'horario_misa'));
    if (min === null) { avisos.push(`${donde}: la hora "${elegir(r, 'horario_misa')}" no se entiende (ejemplo: 16:30). Se omite.`); return; }
    out.push({
      cod, dow: regla.dow, nth: regla.nth, min,
      act: elegir(r, 'actividad_misa') || 'Misa',
      desde: fechaOpcional(elegir(r, 'desde_vigencia_misa'), donde, avisos) || DESDE_SIEMPRE,
      hasta: fechaOpcional(elegir(r, 'hasta_vigencia_misa'), donde, avisos) || HASTA_SIEMPRE,
    });
  });
  return out;
}

export function normalizarGrupos(filas, iglesias, avisos) {
  const codigos = new Set(iglesias.map((i) => i.cod));
  const out = [];
  filas.forEach((r, i) => {
    const donde = `Grupos, fila ${i + 2}`;
    const cod = elegir(r, 'cod_iglesia').toLowerCase();
    const nombre = elegir(r, 'grupo');
    if (!cod && !nombre) return;
    if (!codigos.has(cod)) { avisos.push(`${donde}: la iglesia "${cod}" no existe en la hoja Iglesias. Se omite.`); return; }
    if (!nombre) { avisos.push(`${donde}: falta el nombre del grupo. Se omite.`); return; }
    const diaTxt = elegir(r, 'dia_grupo');
    const regla = diaTxt ? parseRegla(diaTxt) : null;
    if (diaTxt && !regla) avisos.push(`${donde}: el día "${diaTxt}" no se entiende. Se muestra el grupo sin día.`);
    const hDesdeTxt = elegir(r, 'h_desde_grupo');
    const hHastaTxt = elegir(r, 'h_hasta_grupo');
    const hDesde = hDesdeTxt ? parseHora(hDesdeTxt) : null;
    const hHasta = hHastaTxt ? parseHora(hHastaTxt) : null;
    if (hDesdeTxt && hDesde === null) avisos.push(`${donde}: la hora "${hDesdeTxt}" no se entiende. Se ignora.`);
    if (hHastaTxt && hHasta === null) avisos.push(`${donde}: la hora "${hHastaTxt}" no se entiende. Se ignora.`);
    out.push({
      cod, nombre,
      dow: regla ? regla.dow : null,
      nth: regla ? regla.nth : null,
      desdeMin: hDesde, hastaMin: hHasta,
      descripcion: elegir(r, 'desc_grupo', 'descripcion_grupo'),
      desde: fechaOpcional(elegir(r, 'desde_vigencia_grupo'), donde, avisos),
      hasta: fechaOpcional(elegir(r, 'hasta_vigencia_grupo'), donde, avisos),
    });
  });
  return out;
}

export function normalizarAvisos(filas, iglesias, avisos) {
  const codigos = new Set(iglesias.map((i) => i.cod));
  const out = [];
  filas.forEach((r, i) => {
    const donde = `Avisos, fila ${i + 2}`;
    const texto = elegir(r, 'desc_aviso', 'texto_aviso');
    if (!texto) return;
    let cod = elegir(r, 'cod_iglesia').toLowerCase();
    if (cod === 'todas' || cod === 'todos' || cod === '*') cod = '';
    if (cod && !codigos.has(cod)) { avisos.push(`${donde}: la iglesia "${cod}" no existe. El aviso se muestra como general.`); cod = ''; }
    out.push({
      cod,
      titulo: elegir(r, 'titulo_aviso'),
      texto,
      desde: fechaOpcional(elegir(r, 'fec_desde_aviso', 'desde_aviso'), donde, avisos),
      hasta: fechaOpcional(elegir(r, 'fec_hasta_aviso', 'hasta_aviso'), donde, avisos),
    });
  });
  return out;
}

export function normalizarConfig(filas) {
  const out = {};
  for (const r of filas) {
    const clave = elegir(r, 'clave');
    if (clave) out[clave] = elegir(r, 'valor');
  }
  return out;
}
