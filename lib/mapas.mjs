// Mapas de Google: saca las coordenadas de un link corto (maps.app.goo.gl) para poder
// mostrar el mapa dentro de la página. Si no se puede, la página muestra solo "Cómo llegar".
import { readFile, writeFile } from 'node:fs/promises';

/** Busca latitud y longitud dentro de un link o texto de Google Maps */
export function coordenadasDe(texto) {
  const t = decodeURIComponent(String(texto ?? ''));
  // Punto exacto del lugar (!3d = latitud, !4d = longitud)
  let m = t.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  // Centro del mapa (@lat,lng,zoom)
  m ||= t.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  // Parámetros ?q=lat,lng o ll=lat,lng
  m ||= t.match(/[?&](?:q|ll|center)=(-?\d{1,3}\.\d+)[, ](-?\d{1,3}\.\d+)/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** Dirección para incrustar el mapa (no necesita clave de Google) */
export const incrustarCoordenadas = ({ lat, lng }) => `https://www.google.com/maps?q=${lat},${lng}&z=17&output=embed`;
export const incrustarDireccion = (direccion) => `https://www.google.com/maps?q=${encodeURIComponent(direccion)}&z=17&output=embed`;
export const enlaceDireccion = (direccion) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}`;

async function seguirLink(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, {
      signal: ctl.signal,
      redirect: 'follow',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; atlantida-comunidad-build)', 'accept-language': 'es-UY,es;q=0.9' },
    });
    const enUrl = coordenadasDe(r.url);
    if (enUrl) return enUrl;
    if (/consent\.google/.test(r.url)) throw new Error('Google pidió aceptar cookies');
    const cuerpo = (await r.text()).slice(0, 400000);
    return coordenadasDe(cuerpo);
  } finally {
    clearTimeout(t);
  }
}

/**
 * Devuelve { [cod]: {lat, lng} } para las iglesias cuyo link se pudo leer.
 * Usa una copia guardada (datos/respaldo/mapas.json) cuando el link no cambió, o cuando Google no responde.
 */
export async function resolverMapas(iglesias, { archivoCache, avisos, seguir = seguirLink }) {
  let cache = {};
  try { cache = JSON.parse(await readFile(archivoCache, 'utf8')); } catch { /* sin copia */ }
  const salida = {};
  const nuevo = {};
  for (const ig of iglesias) {
    if (!ig.maps) continue;
    const guardado = cache[ig.cod];
    const directo = coordenadasDe(ig.maps);
    let coords = directo;
    if (!coords && guardado && guardado.url === ig.maps) coords = { lat: guardado.lat, lng: guardado.lng };
    if (!coords) {
      try {
        coords = await seguir(ig.maps);
        if (!coords) throw new Error('no se encontraron coordenadas en el link');
      } catch (e) {
        if (guardado?.url === ig.maps) coords = { lat: guardado.lat, lng: guardado.lng };
        else avisos.push(`Mapa de ${ig.cod}: no se pudo leer la ubicación del link (${e.message}). Se muestra solo el botón "Cómo llegar".`);
      }
    }
    if (coords) { salida[ig.cod] = coords; nuevo[ig.cod] = { url: ig.maps, ...coords }; }
  }
  if (Object.keys(nuevo).length) {
    try { await writeFile(archivoCache, JSON.stringify(nuevo, null, 2) + '\n'); } catch { /* no es grave */ }
  }
  return salida;
}
