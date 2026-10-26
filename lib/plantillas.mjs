// Plantillas HTML del sitio. Cada función devuelve el texto de una página completa.
import { DIAS, describirOrdinales, formatoHora, vigente, fechaLarga, coincideDia } from './fechas.mjs';
import { formaFoto } from './imagen.mjs';
import { incrustarCoordenadas, incrustarDireccion, enlaceDireccion } from './mapas.mjs';

export const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0]; // lunes a domingo
const mayuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const esMisa = (act) => /^misa/i.test(act);
const nombreCorto = (ig) => ig.localidad || ig.nombre;
const linkWhatsApp = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`;
const soloTel = (t) => String(t).replace(/[^\d+]/g, '');

/* ---------- Piezas ---------- */

const PALETAS = [['#EADFD3', '#8A4B48'], ['#DDE5DF', '#5E7367']];

function placeholder(ig) {
  const [fondo, tinta] = ig.tema === 'salvia' ? PALETAS[1] : PALETAS[0];
  return `<svg class="foto foto--vacia" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><rect width="320" height="200" fill="${fondo}"/><rect y="168" width="320" height="32" fill="${tinta}" opacity=".14"/><path d="M96 168V102l64-40 64 40v66z" fill="${tinta}"/><path d="M160 62V32M148 44h24" stroke="${tinta}" stroke-width="5" stroke-linecap="round"/><path d="M144 168v-34a16 16 0 0 1 32 0v34z" fill="${fondo}"/><circle cx="160" cy="98" r="9" fill="${fondo}"/></svg>`;
}

function imgTag(f, base, alt, { prioridad = false } = {}) {
  const medidas = f.w && f.h ? ` width="${f.w}" height="${f.h}"` : '';
  return `<img class="foto" src="${base}${esc(f.src)}"${medidas} alt="${esc(alt)}" ${prioridad ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}

function imagen(ctx, ig, base, opciones) {
  const f = ctx.fotoDe(ig);
  return f ? imgTag(f, base, `Foto de ${ig.nombre}`, opciones) : placeholder(ig);
}

const hrefIglesia = (base, cod) => `${base}iglesias/${cod}/`;

/** Mapa que se carga al tocar "Ver mapa". Sin JavaScript queda solo el botón "Cómo llegar". */
function mapaHtml({ embed, enlace, nombre }) {
  if (!enlace && !embed) return '';
  const datos = embed ? ` data-mapa="${esc(embed)}" data-titulo="Mapa de ${esc(nombre)}"` : '';
  return `<div class="mapa"${datos}><a class="btn btn--sec btn--chico mapa__ir" href="${esc(enlace || embed)}" target="_blank" rel="noopener">Cómo llegar</a></div>`;
}

function mapaIglesia(ctx, ig) {
  const c = ctx.coordenadas[ig.cod];
  return mapaHtml({
    embed: c ? incrustarCoordenadas(c) : '',
    enlace: ig.maps || (c ? `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}` : ''),
    nombre: ig.nombre,
  });
}

function lugarSecretaria(ctx, s) {
  const zona = ctx.config.secretaria_localidad || 'Atlántida, Canelones, Uruguay';
  if (!s.direccion) return '';
  // Si la dirección ya trae localidad (tiene coma), se usa tal cual
  return s.direccion.includes(',') ? s.direccion : `${s.direccion}, ${zona}`;
}

const PIN = `<svg class="pin" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.500a2.5 2.5 0 0 1 0 5z"/></svg>`;
const WA = `<svg class="wa-icono" viewBox="0 0 32 32" aria-hidden="true" focusable="false"><rect width="32" height="32" rx="7" fill="#25A55A"/><path fill="#fff" d="M16 6.500a9.500 9.500 0 0 0-8.200 14.300L6.500 25.500l4.800-1.200A9.500 9.500 0 1 0 16 6.500zm0 1.800a7.700 7.700 0 1 1-3.900 14.300l-.4-.2-2.800.7.8-2.700-.2-.4A7.700 7.700 0 0 1 16 8.300zm-3 3.300c-.2 0-.5.100-.7.400-.3.300-1 1-1 2.400s1 2.800 1.200 3c.1.200 2 3.200 5 4.400 2.500 1 3 .8 3.500.7.600-.1 1.800-.7 2-1.400.3-.7.300-1.300.2-1.400l-.5-.3-1.900-.9c-.3-.1-.5-.1-.7.100l-.9 1.100c-.2.200-.3.200-.6.100-.3-.2-1.200-.5-2.300-1.400-.8-.7-1.400-1.600-1.600-1.900-.2-.3 0-.4.100-.6l.4-.5c.1-.2.200-.3.300-.5.100-.2 0-.4 0-.5l-.9-2.100c-.2-.5-.5-.5-.7-.5z"/></svg>`;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const textoDesde = (iso) => { const [, m, d] = iso.split('-').map(Number); return `A partir del ${d} de ${MESES[m - 1]}`; };

/** Fila de la secretaría parroquial (una sola para todas las comunidades), con foto a la izquierda */
function filaSecretaria(ctx, base) {
  if (!ctx.secretaria.length) return '';
  const foto = ctx.fotoSecretaria
    ? `<div class="fila__foto">${imgTag(ctx.fotoSecretaria, base, 'Frente de la secretaría parroquial')}</div>`
    : '';
  const info = ctx.secretaria.map((s) => {
    const lugar = lugarSecretaria(ctx, s);
    return `<div class="fila__datos">${s.direccion ? `<p>${esc(s.direccion)}</p>` : ''}${s.telefono ? `<p><a href="tel:${esc(soloTel(s.telefono))}">${esc(s.telefono)}</a></p>` : ''}${s.desde ? `<p class="fila__desde">${esc(textoDesde(s.desde))}</p>` : ''}${s.horario ? `<p>${esc(s.horario)}</p>` : ''}</div>${lugar ? mapaHtml({ embed: incrustarDireccion(lugar), enlace: enlaceDireccion(lugar), nombre: 'la secretaría parroquial' }) : ''}`;
  }).join('');
  return `<li class="fila fila--secretaria" id="secretaria"><div class="cont fila__in">${foto}<div class="fila__info"><h2>Secretaría parroquial</h2>${info}</div></div></li>`;
}

function filaSalida(h, ig, base) {
  return `<li class="salida${esMisa(h.act) ? ' salida--misa' : ''}"><span class="salida__hora">${formatoHora(h.min)}</span><div class="salida__info"><span class="salida__que">${esc(h.act)}</span><a class="salida__donde" href="${hrefIglesia(base, ig.cod)}"><span class="salida__loc">${esc(nombreCorto(ig))}</span><span class="salida__iglesia">${esc(ig.nombre)}</span></a></div></li>`;
}

/** Junta filas iguales que solo cambian en el ordinal (2.º y 4.º miércoles) */
function fusionar(filas) {
  const mapa = new Map();
  for (const f of filas) {
    const k = `${f.cod}|${f.dow}|${f.min}|${f.act}`;
    let e = mapa.get(k);
    if (!e) { e = { cod: f.cod, dow: f.dow, min: f.min, act: f.act, nths: [], regular: false }; mapa.set(k, e); }
    if (f.nth == null) e.regular = true;
    else if (!e.nths.includes(f.nth)) e.nths.push(f.nth);
  }
  return [...mapa.values()].map((e) => ({
    ...e,
    etiqueta: e.regular || !e.nths.length ? '' : mayuscula(describirOrdinales(e.nths, e.dow)),
  }));
}

function cuandoGrupo(g) {
  const partes = [];
  if (g.dow != null) partes.push(g.nth != null ? mayuscula(describirOrdinales([g.nth], g.dow)) : mayuscula(DIAS[g.dow]));
  if (g.desdeMin != null && g.hastaMin != null) partes.push(`de ${formatoHora(g.desdeMin)} a ${formatoHora(g.hastaMin)}`);
  else if (g.desdeMin != null) partes.push(`a las ${formatoHora(g.desdeMin)}`);
  return partes.join(' ');
}

function datosParaNavegador(ctx, base) {
  return JSON.stringify({
    base,
    zona: ctx.config.zona_horaria,
    iglesias: ctx.iglesias.map((i) => ({ cod: i.cod, nombre: i.nombre, loc: nombreCorto(i) })),
    horarios: ctx.horariosNoVencidos.map((h) => ({ cod: h.cod, dow: h.dow, nth: h.nth, min: h.min, act: h.act, desde: h.desde, hasta: h.hasta })),
  }).replace(/</g, '\\u003c');
}

function avisoHtml(ctx, a, base) {
  const ig = a.cod ? ctx.iglesias.find((i) => i.cod === a.cod) : null;
  const donde = ig ? `${ig.nombre}, ${nombreCorto(ig)}` : 'Todas las comunidades';
  const oculto = !vigente(a, ctx.hoyIso);
  const texto = a.titulo ? `${a.titulo}. ${a.texto}` : a.texto;
  const compartir = `${texto} (${ig ? nombreCorto(ig) : ctx.config.nombre_sitio})`;
  const destino = ig ? `${hrefIglesia(base, ig.cod)}#avisos` : `${base}#avisos`;
  return `<li class="aviso" data-desde="${esc(a.desde)}" data-hasta="${esc(a.hasta)}"${oculto ? ' hidden' : ''}>${a.titulo ? `<h3 class="aviso__titulo">${esc(a.titulo)}</h3>` : ''}<p class="aviso__texto">${esc(a.texto)}</p><p class="aviso__donde">${esc(donde)}</p><a class="btn btn--wa btn--chico" data-compartir data-texto="${esc(compartir)}" data-url="${esc(destino)}" href="${esc(linkWhatsApp(compartir))}">Compartir por WhatsApp</a></li>`;
}

function seccionAvisos(ctx, lista, base, { titulo = 'Avisos', id = 'avisos' } = {}) {
  const visibles = lista.filter((a) => vigente(a, ctx.hoyIso)).length;
  return `<section class="seccion" id="${id}" aria-labelledby="t-${id}"><div class="cont"><h2 id="t-${id}">${esc(titulo)}</h2><ul class="avisos">${lista.map((a) => avisoHtml(ctx, a, base)).join('')}</ul><p class="vacio" data-vacio-avisos${visibles ? ' hidden' : ''}>No hay avisos por ahora.</p></div></section>`;
}

function botonUnirse(ctx, base) {
  if (!ctx.config.whatsapp_comunidad) return '';
  return `<section class="seccion seccion--unirse" id="unirse" aria-labelledby="t-unirse"><div class="cont unirse"><div><h2 id="t-unirse">Sumate a nuestra comunidad</h2><p>Recibí los avisos y novedades de las parroquias en el grupo de WhatsApp.</p></div><div class="unirse__acciones"><a class="btn btn--wa btn--grande" href="${esc(ctx.config.whatsapp_comunidad)}" rel="noopener">Unirme por WhatsApp</a><a class="enlace" href="${base}unirse/">Ver código QR</a></div></div></section>`;
}

/* ---------- Estructura común ---------- */

function layout(ctx, { base, titulo, descripcion, cuerpo, jsonld = null, clase = '', activo = '', actual = '', pie = true }) {
  const { config } = ctx;
  const enlace = (clave, texto, href) => `<a href="${href}"${activo === clave ? ' aria-current="page"' : ''}>${texto}</a>`;
  const menuIglesias = `<details class="menu-ig"${activo === 'iglesias' ? ' data-activo' : ''}><summary>Iglesias</summary><ul>${ctx.iglesias.map((i) => `<li class="tema-${i.tema}"><a href="${hrefIglesia(base, i.cod)}"${actual === i.cod ? ' aria-current="page"' : ''}>${esc(nombreCorto(i))}<span>${esc(i.nombre)}</span></a></li>`).join('')}</ul></details>`;
  const nav = [
    menuIglesias,
    enlace('misas', 'Misas', `${base}misas/`),
    enlace('caminos', 'Caminos de fe', `${base}caminos-de-fe/`),
  ].join('');
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<meta name="theme-color" content="#3E3633">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:locale" content="es_UY">
<link rel="icon" href="${base}favicon.svg" type="image/svg+xml">
<link rel="preload" href="${base}fonts/lora-latin-700-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${base}fonts/inter-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${base}estilos.css">
<script type="module" src="${base}js/app.js"></script>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body class="${clase}">
<a class="saltar" href="#contenido">Saltar al contenido</a>
<header class="cab">
  <div class="cont cab__in">
    <a class="cab__marca" href="${base}"${activo === 'inicio' ? ' aria-current="page"' : ''}>Inicio</a>
    <nav class="cab__nav" aria-label="Secciones">${nav}</nav>
  </div>
</header>
<main id="contenido">
${cuerpo}
</main>
${pie ? `<footer class="pie">
  <div class="cont pie__in">
    ${ctx.secretaria.length ? `<div><p class="pie__sub">Secretaría parroquial</p>${ctx.secretaria.map((s) => `<p>${s.direccion ? esc(s.direccion) : ''}${s.telefono ? `${s.direccion ? ' · ' : ''}<a href="tel:${esc(soloTel(s.telefono))}">${esc(s.telefono)}</a>` : ''}${s.horario ? `<br>${esc(s.horario)}` : ''}</p>`).join('')}</div>` : ''}
    ${config.telefono_general ? `<div><p class="pie__sub">Teléfono</p><p><a href="tel:${esc(soloTel(config.telefono_general))}">${esc(config.telefono_general)}</a></p></div>` : ''}
  </div>
</footer>` : ''}
<script type="application/json" id="datos">${datosParaNavegador(ctx, base)}</script>
</body>
</html>
`;
}

/* ---------- Inicio ---------- */

export function paginaInicio(ctx) {
  const base = './';
  const { iglesias, config } = ctx;

  // Como en la maqueta: foto y datos de cada iglesia, alternando de lado, y la secretaría al final
  const filas = iglesias.map((ig) => `<li class="fila tema-${ig.tema}"><div class="cont fila__in"><a class="fila__foto" href="${hrefIglesia(base, ig.cod)}" tabindex="-1" aria-hidden="true">${imagen(ctx, ig, base)}</a><div class="fila__info"><h2><a href="${hrefIglesia(base, ig.cod)}">${esc(ig.nombre)}</a></h2><p class="fila__loc">${PIN}<span>${esc(nombreCorto(ig))}</span></p>${mapaIglesia(ctx, ig)}</div></div></li>`).join('');

  const cuerpo = `<h1 class="solo-lectores">${esc(config.nombre_sitio)}</h1>
<section class="inicio" aria-label="Comunidades"><ul class="filas">${filas}${filaSecretaria(ctx, base)}</ul></section>`;

  const loc = [...new Set(iglesias.map((i) => i.localidad).filter(Boolean))];
  return layout(ctx, {
    base,
    titulo: `${config.nombre_sitio}: horarios de misas, grupos y avisos`,
    descripcion: config.descripcion_sitio || `Horarios de misas, grupos y avisos en ${loc.join(', ')}.`,
    cuerpo,
    clase: 'p-inicio',
    activo: 'inicio',
    pie: false,
  });
}

/* ---------- Misas (todas las comunidades) ---------- */

export function paginaMisas(ctx) {
  const base = '../';
  const { iglesias, config } = ctx;
  const porCod = new Map(iglesias.map((i) => [i.cod, i]));
  const hoy = ctx.fechaHoy;
  const vigentesHoy = ctx.horarios.filter((h) => vigente(h, ctx.hoyIso));

  // Tablero: las del día de hoy (al armar el sitio; el navegador lo recalcula con la fecha real)
  const delDia = vigentesHoy.filter((h) => coincideDia(h, hoy)).sort((a, b) => a.min - b.min);
  const filasHoy = delDia.length
    ? delDia.map((h) => filaSalida(h, porCod.get(h.cod), base)).join('')
    : `<li class="salida-vacia">No hay misas ni oraciones programadas este día. Elegí otro día.</li>`;

  const tablero = `<section class="pizarra" id="misas" aria-labelledby="t-misas">
  <div class="cont pizarra__in">
    <h1 id="t-misas">¿Dónde hay misa?</h1>
    <div class="pizarra__tablero">
      <p class="pizarra__fecha" id="fecha-sel">Hoy, ${esc(fechaLarga(hoy))}</p>
      <div class="dias" id="dias" role="group" aria-label="Elegir día"></div>
      <ol class="salidas" id="salidas" aria-live="polite">${filasHoy}</ol>
      <p class="pizarra__nota">Tocá el nombre de la comunidad para ver sus horarios, grupos y avisos.</p>
      <p class="pizarra__nota pizarra__nota--aviso">Si el mes tiene cinco miércoles, el quinto miércoles no hay misa.</p>
    </div>
  </div>
</section>`;

  // Semana completa (sirve sin JavaScript y para los buscadores)
  const semana = ORDEN_SEMANA.map((dow) => {
    const filas = fusionar(vigentesHoy.filter((h) => h.dow === dow)).sort((a, b) => a.min - b.min);
    if (!filas.length) return '';
    return `<div class="dia"><h3>${mayuscula(DIAS[dow])}</h3><ul>${filas.map((f) => {
      const ig = porCod.get(f.cod);
      return `<li><span class="h">${formatoHora(f.min)}</span><span class="a">${esc(f.act)}</span><a class="d" href="${hrefIglesia(base, ig.cod)}">${esc(nombreCorto(ig))}</a>${f.etiqueta ? `<span class="n">${esc(f.etiqueta)}</span>` : ''}</li>`;
    }).join('')}</ul></div>`;
  }).join('');

  const detalle = `<section class="seccion" id="semana" aria-labelledby="t-semana"><div class="cont"><details class="semana"><summary id="t-semana">Ver todos los horarios de la semana</summary><div class="semana__dias">${semana}</div></details></div></section>`;

  return layout(ctx, {
    base,
    titulo: `Horarios de misas en todas las comunidades: ${config.nombre_sitio}`,
    descripcion: 'Dónde y a qué hora hay misa hoy y esta semana en Estación Atlántida, Atlántida, Las Toscas y Parque del Plata.',
    cuerpo: [tablero, detalle].join('\n'),
    clase: 'p-misas',
    activo: 'misas',
  });
}

/** Tarjetas con los grupos de todas las iglesias (inicio y página Caminos de fe) */
function grupoTodas(ctx, base) {
  const orden = new Map(ctx.iglesias.map((i, n) => [i.cod, n]));
  const porCod = new Map(ctx.iglesias.map((i) => [i.cod, i]));
  const lista = ctx.grupos
    .filter((g) => vigente(g, ctx.hoyIso))
    .sort((a, b) => orden.get(a.cod) - orden.get(b.cod) || (a.dow ?? 9) - (b.dow ?? 9) || (a.desdeMin ?? 0) - (b.desdeMin ?? 0));
  const tarjetas = lista.map((g) => {
    const ig = porCod.get(g.cod);
    return `<li class="grupo tema-${ig.tema}"><h3>${esc(g.nombre)}</h3>${cuandoGrupo(g) ? `<p class="grupo__cuando">${esc(cuandoGrupo(g))}</p>` : ''}${g.descripcion ? `<p>${esc(g.descripcion)}</p>` : ''}<a class="grupo__donde" href="${hrefIglesia(base, ig.cod)}#grupos">${esc(nombreCorto(ig))}<span>${esc(ig.nombre)}</span></a></li>`;
  }).join('');
  return { cantidad: lista.length, html: tarjetas };
}

/* ---------- Caminos de fe (todos los grupos) ---------- */

export function paginaCaminos(ctx) {
  const base = '../';
  const { config } = ctx;
  const { cantidad, html: tarjetas } = grupoTodas(ctx, base);
  const lista = { length: cantidad };

  const cuerpo = `<section class="encabezado"><div class="cont"><h1>Caminos de fe</h1><p class="encabezado__texto">Grupos, catequesis y encuentros de todas las comunidades.</p></div></section>
<section class="seccion seccion--primera"><div class="cont">${lista.length ? `<ul class="grupos grupos--lista">${tarjetas}</ul>` : '<p class="vacio">Todavía no hay grupos cargados.</p>'}</div></section>
${botonUnirse(ctx, base)}`;

  return layout(ctx, {
    base,
    titulo: `Caminos de fe: grupos y catequesis de todas las comunidades, ${config.nombre_sitio}`,
    descripcion: 'Grupos, catequesis y encuentros de las comunidades de Estación Atlántida, Atlántida, Las Toscas y Parque del Plata.',
    cuerpo,
    clase: 'p-caminos',
    activo: 'caminos',
  });
}

/* ---------- Una iglesia ---------- */

export function paginaIglesia(ctx, ig) {
  const base = '../../';
  const { config } = ctx;
  const propios = ctx.horarios.filter((h) => h.cod === ig.cod && vigente(h, ctx.hoyIso));
  const dias = ORDEN_SEMANA.map((dow) => {
    const filas = fusionar(propios.filter((h) => h.dow === dow)).sort((a, b) => a.min - b.min);
    if (!filas.length) return '';
    return `<div class="dia"><h3>${mayuscula(DIAS[dow])}</h3><ul>${filas.map((f) => `<li><span class="h">${formatoHora(f.min)}</span><span class="a${esMisa(f.act) ? ' a--misa' : ''}">${esc(f.act)}</span>${f.etiqueta ? `<span class="n">${esc(f.etiqueta)}</span>` : ''}</li>`).join('')}</ul></div>`;
  }).join('');

  const grupos = ctx.grupos
    .filter((g) => g.cod === ig.cod && vigente(g, ctx.hoyIso))
    .sort((a, b) => (a.dow ?? 9) - (b.dow ?? 9) || (a.desdeMin ?? 0) - (b.desdeMin ?? 0));

  const avisosIg = ctx.avisos.filter((a) => !a.cod || a.cod === ig.cod);
  const otras = ctx.iglesias.filter((i) => i.cod !== ig.cod);
  const compartir = `${ig.nombre}, ${nombreCorto(ig)}: horarios de misas y avisos`;
  const tel = soloTel(ig.telefono);
  const wa = ig.whatsapp || config.whatsapp_comunidad;

  const acciones = [
    `<a class="btn btn--wa" data-compartir data-texto="${esc(compartir)}" data-url="" href="${esc(linkWhatsApp(compartir))}">Compartir por WhatsApp</a>`,
    tel ? `<a class="btn btn--sec" href="tel:${esc(tel)}">Llamar</a>` : '',
  ].filter(Boolean).join('');

  const datos = [
    ig.direccion ? `<div><dt>Dirección</dt><dd>${esc(ig.direccion)}</dd></div>` : '',
    ig.telefono ? `<div><dt>Teléfono</dt><dd><a href="tel:${esc(tel)}">${esc(ig.telefono)}</a></dd></div>` : '',
    ig.horarioParroquial ? `<div><dt>Horario parroquial</dt><dd>${esc(ig.horarioParroquial)}</dd></div>` : '',
  ].filter(Boolean).join('');

  const desc = ig.descripcion ? `<div class="ig-cab__desc"><p>${esc(ig.descripcion).replace(/\n+/g, '</p><p>')}</p></div>` : '';
  const titulo = `<p class="ig-cab__loc">${esc(nombreCorto(ig))}</p><h1>${esc(ig.nombre)}</h1>${desc}`;
  const foto = ctx.fotoDe(ig);
  const forma = foto ? formaFoto(foto) : null;
  let cabecera;
  if (!foto) {
    cabecera = `<header class="ig-cab"><div class="cont ig-cab__texto">${titulo}</div></header>`;
  } else if (forma === 'h') {
    cabecera = `<header class="ig-cab"><div class="ig-cab__foto">${imagen(ctx, ig, base, { prioridad: true })}</div><div class="cont ig-cab__texto">${titulo}</div></header>`;
  } else {
    cabecera = `<header class="ig-cab ig-cab--contenida ig-cab--${forma}"><div class="cont ig-cab__in"><div class="ig-cab__foto">${imagen(ctx, ig, base, { prioridad: true })}</div><div class="ig-cab__texto">${titulo}</div></div></header>`;
  }

  const bloqueGrupos = `<section class="seccion" id="grupos" aria-labelledby="t-grupos"><div class="cont"><h2 id="t-grupos">Caminos de fe</h2>${grupos.length
    ? `<ul class="grupos">${grupos.map((g) => `<li class="grupo"><h3>${esc(g.nombre)}</h3>${cuandoGrupo(g) ? `<p class="grupo__cuando">${esc(cuandoGrupo(g))}</p>` : ''}${g.descripcion ? `<p>${esc(g.descripcion)}</p>` : ''}</li>`).join('')}</ul>`
    : '<p class="vacio">Por ahora no hay grupos cargados en esta comunidad.</p>'}
  ${wa ? `<p class="grupos__unirse"><a class="btn btn--wa" href="${esc(wa)}" rel="noopener">Sumate a nuestra comunidad</a></p>` : ''}</div></section>`;

  const ubicacion = mapaIglesia(ctx, ig)
    ? `<section class="seccion" id="ubicacion" aria-labelledby="t-ubic"><div class="cont"><h2 id="t-ubic">Dónde estamos</h2>${mapaIglesia(ctx, ig)}</div></section>`
    : '';

  const cuerpo = `<article class="iglesia">
  ${cabecera}
  <div class="cont">
    <div class="acciones">${acciones}</div>
    ${datos ? `<dl class="ficha">${datos}</dl>` : ''}
  </div>
  <section class="seccion" id="horarios" aria-labelledby="t-horarios"><div class="cont">
    <h2 id="t-horarios">Horarios de misas y oraciones</h2>
    <p class="proxima" data-proxima="${esc(ig.cod)}" data-grande></p>
    ${dias ? `<div class="semana__dias">${dias}</div>` : '<p class="vacio">Todavía no hay horarios cargados para esta comunidad.</p>'}
  </div></section>
  ${bloqueGrupos}
  ${seccionAvisos(ctx, avisosIg, base, { titulo: 'Avisos', id: 'avisos' })}
  ${ubicacion}
  <section class="seccion" aria-labelledby="t-otras"><div class="cont"><h2 id="t-otras">Otras comunidades</h2><ul class="otras">${otras.map((o) => `<li class="tema-${o.tema}"><a href="${hrefIglesia(base, o.cod)}">${esc(nombreCorto(o))}<span>${esc(o.nombre)}</span></a></li>`).join('')}</ul></div></section>
</article>`;

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Church',
    name: ig.nombre,
    address: { '@type': 'PostalAddress', addressLocality: ig.localidad, addressCountry: 'UY', ...(ig.direccion ? { streetAddress: ig.direccion } : {}) },
    ...(ig.telefono ? { telephone: ig.telefono } : {}),
    ...(ig.maps ? { hasMap: ig.maps } : {}),
    ...(ig.descripcion ? { description: ig.descripcion } : {}),
  };

  return layout(ctx, {
    base,
    titulo: `${ig.nombre}, ${nombreCorto(ig)}: horarios de misa`,
    descripcion: ig.descripcion || `Horarios de misas, grupos y avisos de ${ig.nombre} en ${nombreCorto(ig)}.`,
    cuerpo,
    jsonld,
    clase: `p-iglesia tema-${ig.tema}`,
    activo: 'iglesias',
    actual: ig.cod,
  });
}

/* ---------- Unirse (WhatsApp + QR) ---------- */

export function paginaUnirse(ctx) {
  const base = '../';
  const { config } = ctx;
  const cuerpo = `<section class="seccion unirse-pagina"><div class="cont">
  <h1>Sumate a nuestra comunidad</h1>
  <p class="unirse-pagina__texto">Un solo grupo de WhatsApp para enterarte de los avisos y novedades de las comunidades.</p>
  <div class="unirse-pagina__qr">
    ${ctx.qrSvg}
    <p>Escaneá este código con la cámara del celular.</p>
  </div>
  <p class="unirse-pagina__o">Si estás desde el celular, tocá el botón:</p>
  <div class="acciones">
    <a class="btn btn--wa btn--grande" href="${esc(config.whatsapp_comunidad)}" rel="noopener">Unirme por WhatsApp</a>
    <button class="btn btn--sec" type="button" data-imprimir>Imprimir esta página</button>
  </div>
</div></section>`;
  return layout(ctx, {
    base,
    titulo: `Unirme a la comunidad de WhatsApp: ${config.nombre_sitio}`,
    descripcion: 'Sumate al grupo de WhatsApp con los avisos y novedades de las comunidades.',
    cuerpo,
    clase: 'p-unirse',
    activo: 'unirse',
  });
}
