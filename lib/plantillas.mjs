// Plantillas HTML del sitio. Cada función devuelve el texto de una página completa.
import { DIAS, describirOrdinales, formatoHora, vigente, fechaLarga, coincideDia } from './fechas.mjs';
import { formaFoto } from './imagen.mjs';

export const esc = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0]; // lunes a domingo
const mayuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const esMisa = (act) => /^misa/i.test(act);
const nombreCorto = (ig) => ig.localidad || ig.nombre;
const linkWhatsApp = (texto) => `https://wa.me/?text=${encodeURIComponent(texto)}`;

/* ---------- Piezas ---------- */

const MARCA = `<svg class="marca" viewBox="0 0 40 40" aria-hidden="true" focusable="false"><rect width="40" height="40" rx="9" fill="#1F4E8C"/><circle cx="20" cy="16" r="6.5" fill="#F2B632"/><path d="M20 8v24M12.5 16h15" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/></svg>`;

const PALETAS = [['#DCE8F5', '#1F4E8C'], ['#F6E6B8', '#14305A'], ['#D5EBE3', '#1F4E8C'], ['#E4DFF2', '#14305A']];

function placeholder(cod) {
  let h = 0;
  for (const c of cod) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [fondo, tinta] = PALETAS[h % PALETAS.length];
  return `<svg class="foto foto--vacia" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false"><rect width="320" height="200" fill="${fondo}"/><rect y="168" width="320" height="32" fill="${tinta}" opacity=".14"/><path d="M96 168V102l64-40 64 40v66z" fill="${tinta}"/><path d="M160 62V32M148 44h24" stroke="${tinta}" stroke-width="5" stroke-linecap="round"/><path d="M144 168v-34a16 16 0 0 1 32 0v34z" fill="${fondo}"/><circle cx="160" cy="98" r="9" fill="${fondo}"/></svg>`;
}

function imagen(ctx, ig, base, { prioridad = false } = {}) {
  const f = ctx.fotoDe(ig);
  if (!f) return placeholder(ig.cod);
  const medidas = f.w && f.h ? ` width="${f.w}" height="${f.h}"` : '';
  return `<img class="foto" src="${base}${esc(f.src)}"${medidas} alt="Foto de ${esc(ig.nombre)}" ${prioridad ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">`;
}


const hrefIglesia = (base, cod) => `${base}iglesias/${cod}/`;

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

function datosParaNavegador(ctx) {
  return JSON.stringify({
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

/* ---------- Estructura común ---------- */

function layout(ctx, { base, titulo, descripcion, cuerpo, jsonld = null, clase = '' }) {
  const { config } = ctx;
  const nav = [
    ['Misas', `${base}#misas`],
    ['Avisos', `${base}#avisos`],
    ['Comunidades', `${base}#comunidades`],
  ];
  if (config.whatsapp_comunidad) nav.push(['Unirme', `${base}unirse/`]);
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(descripcion)}">
<meta name="theme-color" content="#14305A">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(descripcion)}">
<meta property="og:locale" content="es_UY">
<link rel="icon" href="${base}favicon.svg" type="image/svg+xml">
<link rel="preload" href="${base}fonts/alegreya-latin-800-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${base}fonts/lexend-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${base}estilos.css">
<script type="module" src="${base}js/app.js"></script>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body class="${clase}">
<a class="saltar" href="#contenido">Saltar al contenido</a>
<header class="cab">
  <div class="cont cab__in">
    <a class="cab__marca" href="${base}">${MARCA}<span>${esc(config.nombre_sitio)}</span></a>
    <nav class="cab__nav" aria-label="Secciones">${nav.map(([t, h]) => `<a href="${h}">${t}</a>`).join('')}</nav>
  </div>
</header>
<main id="contenido">
${cuerpo}
</main>
<footer class="pie">
  <div class="cont">
    <p class="pie__nombre">${esc(config.nombre_sitio)}</p>
    ${config.telefono_general ? `<p>Teléfono: <a href="tel:${esc(config.telefono_general.replace(/[^\d+]/g, ''))}">${esc(config.telefono_general)}</a></p>` : ''}
    <p>Los horarios pueden cambiar. Ante la duda, consultá en la parroquia.</p>
    <p class="pie__fecha">Datos actualizados el ${esc(ctx.actualizado)}.</p>
  </div>
</footer>
<script type="application/json" id="datos">${datosParaNavegador(ctx)}</script>
</body>
</html>
`;
}

/* ---------- Inicio ---------- */

export function paginaInicio(ctx) {
  const base = './';
  const { iglesias, config } = ctx;
  const porCod = new Map(iglesias.map((i) => [i.cod, i]));
  const hoy = ctx.fechaHoy;
  const vigentesHoy = ctx.horarios.filter((h) => vigente(h, ctx.hoyIso));

  // Tablero: las del día de hoy (al armar el sitio; el navegador lo recalcula con la fecha real)
  const delDia = vigentesHoy
    .filter((h) => coincideDia(h, hoy))
    .sort((a, b) => a.min - b.min);
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

  const comunidades = `<section class="seccion" id="comunidades" aria-labelledby="t-com"><div class="cont"><h2 id="t-com">Nuestras comunidades</h2>
<ul class="comunidades">${iglesias.map((ig) => `<li><a class="com" href="${hrefIglesia(base, ig.cod)}"><span class="com__foto">${imagen(ctx, ig, base)}</span><div class="com__texto"><h3>${esc(nombreCorto(ig))}</h3><span class="com__nombre">${esc(ig.nombre)}</span><span class="com__prox" data-proxima="${esc(ig.cod)}"></span></div></a></li>`).join('')}</ul></div></section>`;

  const unirse = config.whatsapp_comunidad
    ? `<section class="seccion seccion--unirse" id="unirse" aria-labelledby="t-unirse"><div class="cont unirse"><div><h2 id="t-unirse">Sumate a la comunidad</h2><p>Recibí los avisos y novedades de las parroquias en el grupo de WhatsApp.</p></div><div class="unirse__acciones"><a class="btn btn--wa btn--grande" href="${esc(config.whatsapp_comunidad)}" rel="noopener">Unirme por WhatsApp</a><a class="enlace" href="${base}unirse/">Ver código QR</a></div></div></section>`
    : '';

  const detalle = `<section class="seccion" id="semana" aria-labelledby="t-semana"><div class="cont"><details class="semana"><summary id="t-semana">Ver todos los horarios de la semana</summary><div class="semana__dias">${semana}</div></details></div></section>`;

  const cuerpo = [tablero, seccionAvisos(ctx, ctx.avisos, base), comunidades, unirse, detalle].join('\n');

  const loc = [...new Set(iglesias.map((i) => i.localidad).filter(Boolean))];
  return layout(ctx, {
    base,
    titulo: `${config.nombre_sitio}: horarios de misas, grupos y avisos`,
    descripcion: config.descripcion_sitio || `Horarios de misas, grupos y avisos en ${loc.join(', ')}.`,
    cuerpo,
    clase: 'p-inicio',
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
  const tel = ig.telefono.replace(/[^\d+]/g, '');

  const acciones = [
    ig.maps ? `<a class="btn" href="${esc(ig.maps)}" rel="noopener">Cómo llegar</a>` : '',
    tel ? `<a class="btn btn--sec" href="tel:${esc(tel)}">Llamar</a>` : '',
    `<a class="btn btn--wa" data-compartir data-texto="${esc(compartir)}" data-url="" href="${esc(linkWhatsApp(compartir))}">Compartir por WhatsApp</a>`,
    ig.whatsapp || config.whatsapp_comunidad
      ? `<a class="btn btn--sec" href="${esc(ig.whatsapp || config.whatsapp_comunidad)}" rel="noopener">Unirme a la comunidad</a>`
      : '',
  ].filter(Boolean).join('');

  const datos = [
    ig.direccion ? `<div><dt>Dirección</dt><dd>${esc(ig.direccion)}</dd></div>` : '',
    ig.telefono ? `<div><dt>Teléfono</dt><dd><a href="tel:${esc(tel)}">${esc(ig.telefono)}</a></dd></div>` : '',
    ig.horarioParroquial ? `<div><dt>Horario parroquial</dt><dd>${esc(ig.horarioParroquial)}</dd></div>` : '',
  ].filter(Boolean).join('');

  const titulo = `<p class="ig-cab__loc">${esc(nombreCorto(ig))}</p><h1>${esc(ig.nombre)}</h1>`;
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
  ${grupos.length ? `<section class="seccion" id="grupos" aria-labelledby="t-grupos"><div class="cont"><h2 id="t-grupos">Grupos y catequesis</h2><ul class="grupos">${grupos.map((g) => `<li class="grupo"><h3>${esc(g.nombre)}</h3>${cuandoGrupo(g) ? `<p class="grupo__cuando">${esc(cuandoGrupo(g))}</p>` : ''}${g.descripcion ? `<p>${esc(g.descripcion)}</p>` : ''}</li>`).join('')}</ul></div></section>` : ''}
  ${seccionAvisos(ctx, avisosIg, base, { titulo: 'Avisos', id: 'avisos' })}
  <section class="seccion" aria-labelledby="t-otras"><div class="cont"><h2 id="t-otras">Otras comunidades</h2><ul class="otras">${otras.map((o) => `<li><a href="${hrefIglesia(base, o.cod)}">${esc(nombreCorto(o))}<span>${esc(o.nombre)}</span></a></li>`).join('')}</ul></div></section>
</article>`;

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Church',
    name: ig.nombre,
    address: { '@type': 'PostalAddress', addressLocality: ig.localidad, addressCountry: 'UY', ...(ig.direccion ? { streetAddress: ig.direccion } : {}) },
    ...(ig.telefono ? { telephone: ig.telefono } : {}),
    ...(ig.maps ? { hasMap: ig.maps } : {}),
  };

  return layout(ctx, {
    base,
    titulo: `${ig.nombre}, ${nombreCorto(ig)}: horarios de misa`,
    descripcion: `Horarios de misas, grupos y avisos de ${ig.nombre} en ${nombreCorto(ig)}.`,
    cuerpo,
    jsonld,
    clase: 'p-iglesia',
  });
}

/* ---------- Unirse (WhatsApp + QR) ---------- */

export function paginaUnirse(ctx) {
  const base = '../';
  const { config } = ctx;
  const cuerpo = `<section class="seccion unirse-pagina"><div class="cont">
  <h1>Sumate a la comunidad de WhatsApp</h1>
  <p class="unirse-pagina__texto">Un solo grupo para enterarte de los avisos y novedades de las comunidades.</p>
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
  });
}
