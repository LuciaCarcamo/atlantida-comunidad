// Arma el sitio completo en la carpeta dist/.
//   node build.mjs                      usa los links de datos/fuentes.json (y el respaldo si fallan)
//   node build.mjs --actualizar-respaldo  además guarda lo leído de Google como nuevo respaldo
//   HOY=2026-11-03 node build.mjs       arma el sitio como si hoy fuera esa fecha (para probar)
import { mkdir, rm, cp, writeFile, readFile } from 'node:fs/promises';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import {
  cargarHoja, normalizarIglesias, normalizarHorarios, normalizarGrupos, normalizarAvisos, normalizarConfig,
} from './lib/datos.mjs';
import { partesEnZona, fechaMasDias, isoDeFecha } from './lib/fechas.mjs';
import { medidasImagen, formaFoto } from './lib/imagen.mjs';
import { paginaInicio, paginaIglesia, paginaUnirse } from './lib/plantillas.mjs';

const RAIZ = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(RAIZ, 'dist');
const actualizarRespaldo = process.argv.includes('--actualizar-respaldo');
const dos = (n) => String(n).padStart(2, '0');

const leerJson = async (ruta) => JSON.parse(await readFile(path.join(RAIZ, ruta), 'utf8'));

const advertencias = [];
const configLocal = await leerJson('datos/config.json');
const fuentes = await leerJson('datos/fuentes.json');
const dirRespaldo = path.join(RAIZ, 'datos', 'respaldo');
const opciones = { dirRespaldo, avisos: advertencias, actualizarRespaldo };

const [hIglesias, hHorarios, hGrupos, hAvisos, hConfig] = await Promise.all([
  cargarHoja('iglesias', fuentes.iglesias, opciones),
  cargarHoja('horarios', fuentes.horarios, opciones),
  cargarHoja('grupos', fuentes.grupos, opciones),
  cargarHoja('avisos', fuentes.avisos, opciones),
  cargarHoja('config', fuentes.config, opciones),
]);

const config = { ...configLocal };
for (const [k, v] of Object.entries(normalizarConfig(hConfig.filas))) if (v) config[k] = v;
config.zona_horaria ||= 'America/Montevideo';
config.nombre_sitio ||= 'Comunidades Católicas';

const iglesias = normalizarIglesias(hIglesias.filas, advertencias);
if (!iglesias.length) {
  console.error('ERROR: no hay iglesias para publicar. Revisá la hoja Iglesias o datos/respaldo/iglesias.json.');
  process.exit(1);
}
const horarios = normalizarHorarios(hHorarios.filas, iglesias, advertencias);
const grupos = normalizarGrupos(hGrupos.filas, iglesias, advertencias);
const avisosTodos = normalizarAvisos(hAvisos.filas, iglesias, advertencias);

// Fecha de hoy en Uruguay (o la de la variable HOY, para probar)
const ahora = partesEnZona(config.zona_horaria);
if (process.env.HOY && /^\d{4}-\d{2}-\d{2}$/.test(process.env.HOY)) {
  const [y, m, d] = process.env.HOY.split('-').map(Number);
  Object.assign(ahora, { y, m, d });
}
const fechaHoy = fechaMasDias(ahora, 0);
const hoyIso = isoDeFecha(fechaHoy);

// Lo vencido no se publica; lo que empieza más adelante se incluye oculto y aparece solo en su fecha.
const noVencido = (x) => !x.hasta || x.hasta >= hoyIso;
const avisos = avisosTodos.filter(noVencido);
const horariosNoVencidos = horarios.filter(noVencido);

// Fotos: assets/img/iglesias/<cod_iglesia>.webp|jpg|jpeg|png (o el nombre indicado en la columna foto).
// Se tolera mayúsculas y guion bajo en lugar de guion (las_toscas.png = las-toscas).
const DIR_FOTOS = path.join(RAIZ, 'assets/img/iglesias');
const normalizarNombre = (n) => n.toLowerCase().replace(/_/g, '-');
const archivosFotos = new Map(readdirSync(DIR_FOTOS).map((f) => [normalizarNombre(f), f]));
const EXT = ['webp', 'jpg', 'jpeg', 'png'];
const cacheFotos = new Map();
function fotoDe(ig) {
  if (cacheFotos.has(ig.cod)) return cacheFotos.get(ig.cod);
  let resultado = null;
  const candidatos = [ig.foto, ...EXT.map((e) => `${ig.cod}.${e}`)].filter(Boolean).map(normalizarNombre);
  for (const c of candidatos) {
    if (!archivosFotos.has(c)) continue;
    const real = archivosFotos.get(c);
    const datos = readFileSync(path.join(DIR_FOTOS, real));
    resultado = { src: `img/iglesias/${real}`, bytes: datos.length, ...(medidasImagen(datos) ?? {}) };
    break;
  }
  cacheFotos.set(ig.cod, resultado);
  return resultado;
}
for (const ig of iglesias) {
  const f = fotoDe(ig);
  if (!f) continue;
  if (f.bytes > 600 * 1024) advertencias.push(`Foto de ${ig.cod}: pesa ${Math.round(f.bytes / 1024)} KB. Conviene comprimirla (menos de 300 KB) para que cargue rápido en el celular.`);
  if (formaFoto(f) === 'c') advertencias.push(`Foto de ${ig.cod}: es chica (${f.w}x${f.h}). Se muestra en tamaño reducido; una de al menos 1200 px de ancho se vería mejor.`);
}

let qrSvg = '';
if (config.whatsapp_comunidad) {
  qrSvg = (await QRCode.toString(config.whatsapp_comunidad, {
    type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#14233A', light: '#FFFFFF' },
  })).replace('<svg ', '<svg class="qr" role="img" aria-label="Código QR para unirse a la comunidad de WhatsApp" ');
}

const ctx = {
  config, iglesias, horarios, horariosNoVencidos, grupos, avisos, fechaHoy, hoyIso, fotoDe, qrSvg,
  actualizado: `${dos(ahora.d)}/${dos(ahora.m)}/${ahora.y} ${dos(ahora.hh)}:${dos(ahora.mm)}`,
};

// Salida
await rm(DIST, { recursive: true, force: true });
await mkdir(path.join(DIST, 'js'), { recursive: true });
await cp(path.join(RAIZ, 'assets'), DIST, { recursive: true });
await cp(path.join(RAIZ, 'lib/fechas.mjs'), path.join(DIST, 'js/fechas.js'));
await rm(path.join(DIST, 'img/iglesias/.gitkeep'), { force: true });

const escribir = async (ruta, texto) => {
  const destino = path.join(DIST, ruta);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, texto);
};

await escribir('index.html', paginaInicio(ctx));
for (const ig of iglesias) await escribir(`iglesias/${ig.cod}/index.html`, paginaIglesia(ctx, ig));
if (config.whatsapp_comunidad) await escribir('unirse/index.html', paginaUnirse(ctx));
await escribir('.nojekyll', '');

const url = (config.url_sitio || '').replace(/\/+$/, '');
await escribir('robots.txt', `User-agent: *\nAllow: /\n${url ? `Sitemap: ${url}/sitemap.xml\n` : ''}`);
if (url) {
  const rutas = ['', ...iglesias.map((i) => `iglesias/${i.cod}/`), ...(config.whatsapp_comunidad ? ['unirse/'] : [])];
  await escribir('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rutas.map((r) => `  <url><loc>${url}/${r}</loc></url>`).join('\n')}\n</urlset>\n`);
}

// Resumen
const origen = (h) => h.origen;
console.log(`Sitio armado en dist/ para el ${ctx.actualizado} (hoy = ${hoyIso})`);
console.log(`  Iglesias: ${iglesias.length} (${origen(hIglesias)}), horarios: ${horarios.length} (${origen(hHorarios)}), grupos: ${grupos.length} (${origen(hGrupos)}), avisos: ${avisos.length} de ${avisosTodos.length} (${origen(hAvisos)})`);
console.log(`  Fotos: ${iglesias.filter((i) => fotoDe(i)).length} de ${iglesias.length}. WhatsApp de la comunidad: ${config.whatsapp_comunidad ? 'sí' : 'no cargado'}.`);
if (advertencias.length) {
  console.log(`\nAdvertencias (${advertencias.length}):`);
  for (const a of advertencias) console.log(`  - ${a}`);
}
