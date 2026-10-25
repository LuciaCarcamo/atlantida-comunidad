// Comportamiento del navegador: tablero de misas por día, próxima misa,
// avisos que se ocultan al vencer y botones de compartir por WhatsApp.
// Si algo de esto falla, la página sigue mostrando el contenido ya armado.
import {
  DIAS, DIAS_CORTOS, coincideDia, formatoHora, fechaLarga, fechaCorta, fechaMasDias,
  isoDeFecha, ocurrenciasDelDia, partesEnZona, proximaOcurrencia, vigente,
} from './fechas.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const mayuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const bruto = document.getElementById('datos');
const datos = bruto ? JSON.parse(bruto.textContent) : null;

/** Fecha y hora de Uruguay. Para probar: ?hoy=2026-11-03&hora=09:30 en la dirección. */
function ahoraEnZona() {
  const p = new URLSearchParams(location.search);
  let a = partesEnZona(datos?.zona || 'America/Montevideo');
  const hoy = p.get('hoy');
  if (hoy && /^\d{4}-\d{2}-\d{2}$/.test(hoy)) {
    const [y, m, d] = hoy.split('-').map(Number);
    a = { ...a, y, m, d };
  }
  const hora = p.get('hora');
  if (hora && /^\d{1,2}:\d{2}$/.test(hora)) {
    const [hh, mm] = hora.split(':').map(Number);
    a = { ...a, hh, mm };
  }
  return a;
}

/* ---------- Avisos: mostrar solo los vigentes ---------- */
function filtrarAvisos(ahora) {
  const iso = isoDeFecha(fechaMasDias(ahora, 0));
  document.querySelectorAll('.avisos').forEach((ul) => {
    let visibles = 0;
    ul.querySelectorAll('.aviso').forEach((li) => {
      const ok = vigente({ desde: li.dataset.desde, hasta: li.dataset.hasta }, iso);
      li.hidden = !ok;
      if (ok) visibles++;
    });
    const vacio = ul.parentElement.querySelector('[data-vacio-avisos]');
    if (vacio) vacio.hidden = visibles > 0;
  });
}

/* ---------- Tablero "¿Dónde hay misa?" ---------- */
function montarTablero(ahora) {
  const cont = document.getElementById('dias');
  const salidas = document.getElementById('salidas');
  const fechaSel = document.getElementById('fecha-sel');
  if (!cont || !salidas || !fechaSel || !datos) return;

  const porCod = new Map(datos.iglesias.map((i) => [i.cod, i]));
  const minAhora = ahora.hh * 60 + ahora.mm;
  const fechas = Array.from({ length: 7 }, (_, i) => fechaMasDias(ahora, i));

  const etiqueta = (i, f) => (i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : `${DIAS_CORTOS[f.getDay()]} ${f.getDate()}`);
  const titulo = (i, f) => (i === 0 ? `Hoy, ${fechaLarga(f)}` : i === 1 ? `Mañana, ${fechaLarga(f)}` : mayuscula(fechaLarga(f)));

  const fila = (h, paso) => {
    const ig = porCod.get(h.cod);
    if (!ig) return '';
    const misa = /^misa/i.test(h.act);
    return `<li class="salida${misa ? ' salida--misa' : ''}${paso ? ' salida--paso' : ''}"><span class="salida__hora">${formatoHora(h.min)}</span><div class="salida__info"><span class="salida__que">${esc(h.act)}</span><a class="salida__donde" href="${esc(datos.base || '')}iglesias/${esc(ig.cod)}/"><span class="salida__loc">${esc(ig.loc)}</span><span class="salida__iglesia">${esc(ig.nombre)}</span></a></div></li>`;
  };

  const botones = fechas.map((f, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'dia-btn';
    b.textContent = etiqueta(i, f);
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', () => elegir(i));
    return b;
  });
  cont.replaceChildren(...botones);

  function elegir(i) {
    botones.forEach((b, j) => b.setAttribute('aria-pressed', String(j === i)));
    const f = fechas[i];
    fechaSel.textContent = titulo(i, f);
    const filas = ocurrenciasDelDia(datos.horarios, f);
    salidas.innerHTML = filas.length
      ? filas.map((h) => fila(h, i === 0 && h.min < minAhora - 30)).join('')
      : '<li class="salida-vacia">No hay misas ni oraciones programadas este día. Elegí otro día.</li>';
  }
  elegir(0);
}

/* ---------- Próxima misa de cada comunidad ---------- */
function montarProximas(ahora) {
  if (!datos) return;
  document.querySelectorAll('[data-proxima]').forEach((el) => {
    const cod = el.dataset.proxima;
    const filas = datos.horarios.filter((h) => h.cod === cod && /^misa/i.test(h.act));
    const r = proximaOcurrencia(filas, ahora, { dias: 60 });
    if (!r) { el.textContent = ''; return; }
    const hora = formatoHora(r.fila.min);
    const cuando = r.offset === 0 ? `hoy a las ${hora}`
      : r.offset === 1 ? `mañana a las ${hora}`
      : `el ${DIAS[r.fecha.getDay()]} ${fechaCorta(r.fecha)} a las ${hora}`;
    el.textContent = `Próxima misa: ${cuando}`;
  });
}

/* ---------- Compartir por WhatsApp ---------- */
function activarCompartir() {
  document.querySelectorAll('a[data-compartir]').forEach((a) => {
    const texto = a.dataset.texto || document.title;
    const u = new URL(a.dataset.url || '', location.href);
    if (!a.dataset.url) u.hash = '';
    u.search = '';
    a.href = `https://wa.me/?text=${encodeURIComponent(`${texto}\n${u.href}`)}`;
  });
}

/* ---------- Mapas: se cargan recién al tocar "Ver mapa" ---------- */
function activarMapas() {
  document.querySelectorAll('.mapa[data-mapa]').forEach((caja) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'btn btn--sec btn--chico';
    boton.textContent = 'Ver mapa';
    boton.setAttribute('aria-expanded', 'false');
    let marco = null;
    boton.addEventListener('click', () => {
      if (!marco) {
        marco = document.createElement('div');
        marco.className = 'mapa__marco';
        const f = document.createElement('iframe');
        f.src = caja.dataset.mapa;
        f.title = caja.dataset.titulo || 'Mapa';
        f.loading = 'lazy';
        f.referrerPolicy = 'no-referrer-when-downgrade';
        marco.append(f);
        caja.prepend(marco);
      }
      const abierto = boton.getAttribute('aria-expanded') === 'false';
      marco.hidden = !abierto;
      boton.setAttribute('aria-expanded', String(abierto));
      boton.textContent = abierto ? 'Ocultar mapa' : 'Ver mapa';
    });
    caja.querySelector('.mapa__ir')?.before(boton);
  });
}

/* ---------- Menú Iglesias: se cierra al tocar afuera o con Escape ---------- */
function activarMenu() {
  const menu = document.querySelector('.menu-ig');
  if (!menu) return;
  document.addEventListener('click', (e) => { if (!menu.contains(e.target)) menu.open = false; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') menu.open = false; });
}

function activarImprimir() {
  document.querySelectorAll('[data-imprimir]').forEach((b) => b.addEventListener('click', () => window.print()));
}

try {
  const ahora = ahoraEnZona();
  filtrarAvisos(ahora);
  montarTablero(ahora);
  montarProximas(ahora);
} catch (e) {
  console.error('No se pudo actualizar la página con la fecha de hoy:', e);
}
activarCompartir();
activarImprimir();
activarMapas();
activarMenu();
