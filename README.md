# Atlántida Comunidad (Estación Atlántida, Atlántida, Las Toscas, Parque del Plata)

Sitio estático en español con estas páginas: **Inicio** (comunidades, mapas, secretaría y avisos), **Iglesias** (una página
por comunidad), **Misas** (dónde hay misa hoy y en la semana, de todas las comunidades), **Caminos de fe** (todos los grupos)
y **Unirme** (WhatsApp con QR). Cada iglesia usa un color de acento, burdeos o salvia, que se alternan solos. Los datos salen de una planilla de
Google Sheets que edita quien administra; no hay servidor ni base de datos que mantener.

## Cómo funcionan los datos

1. **Al armar el sitio** (`node build.mjs`) se leen las hojas publicadas de Google y se escribe todo
   directamente en el HTML (lo que ven las personas y los buscadores).
2. **Si Google falla** o una hoja está mal, se usa la copia de `datos/respaldo/`. La web nunca queda vacía.
3. **Al abrir la página**, el navegador calcula con la fecha de hoy: las misas de cada día, la próxima misa
   de cada comunidad, y oculta los avisos fuera de su fecha.

Las filas con errores (día mal escrito, hora inválida, iglesia inexistente) se saltan y el armado muestra
una advertencia que dice la hoja y la fila.

## Probar en tu computadora

Requiere Node 20 o más nuevo.

```
npm install
npm run build     # arma el sitio en dist/
npm run vista     # lo muestra en http://localhost:8080
npm test          # prueba la lógica de fechas
```

Si no tenés Node, podés ver un sitio ya armado (la carpeta `dist/`) con lo que tengas instalado:
`python3 -m http.server --directory dist 8080` o `php -S localhost:8080 -t dist`.

Para ver cómo se vería otro día: `http://localhost:8080/?hoy=2026-12-20&hora=08:00`
(o al armar: `HOY=2026-12-20 npm run build`).

## La planilla

Cada pestaña es una hoja. Se leen estos nombres de columna (en minúsculas, sin tildes):

| Pestaña | Columnas obligatorias | Opcionales |
|---|---|---|
| Iglesias | `cod_iglesia`, `nombre_iglesia` | `localidad_iglesia`, `ubicacion_maps` (link de Google Maps), `desc_iglesia` (texto sobre la iglesia), `color_iglesia` (`burdeos` o `salvia`; si no, se alternan), `foto_iglesia`, `whatsapp_iglesia`, y si hace falta `direccion_iglesia`, `telefono_iglesia` |
| Horarios_misas | `cod_iglesia`, `dia_misa`, `horario_misa` | `actividad_misa` (Misa, Rosario, etc.), `desde_vigencia_misa`, `hasta_vigencia_misa` |
| Grupos | `cod_iglesia`, `grupo` | `dia_grupo`, `h_desde_grupo`, `h_hasta_grupo`, `desc_grupo`, `desde_vigencia_grupo`, `hasta_vigencia_grupo` |
| Avisos | `desc_aviso` | `cod_iglesia` (vacío o `todas` = general), `titulo_aviso`, `fec_desde_aviso`, `fec_hasta_aviso` |
| Secretaria | `direccion_secretaria` | `telefono_secretaria`, `horario_secretaria`, `desde_vigencia_secretaria`, `hasta_vigencia_secretaria` |
| Config (opcional) | `clave`, `valor` | claves: `nombre_sitio`, `descripcion_sitio`, `url_sitio`, `whatsapp_comunidad`, `telefono_general`, `secretaria_localidad` |

Las columnas `id_...` son para tu organización: la web no las usa ni las muestra.

- **Días:** `Martes`, `Sábado`, y también `1er Miércoles`, `2do Miércoles`, `3er`, `4to`, `Último viernes`.
- **Horas:** `8:30`, `16:00`.
- **Fechas:** día-mes-año, por ejemplo `07-11-2026` o `7-11-26`.
- **Vigencia:** un horario o grupo aparece solo entre sus fechas (útil para el horario de verano). Un aviso
  se muestra entre `fec_desde_aviso` y `fec_hasta_aviso`, inclusive, y desaparece solo.
- `cod_iglesia` solo admite minúsculas, números y guiones, y no se cambia después.

## Conectar la planilla (una vez)

1. En la planilla: **Archivo > Compartir > Publicar en la web**.
2. Elegí **una pestaña** (no "Documento completo") y el formato **Valores separados por comas (.csv)**. Publicar.
3. Copiá el link y pegalo en `datos/fuentes.json` en la clave de esa pestaña. Repetí para cada una.

Los links publicados son públicos: no pongas datos privados en la planilla.

## Mapas

Cada iglesia usa el link de `ubicacion_maps`. Al armar el sitio se lee la ubicación detrás del link (también los links cortos
`maps.app.goo.gl`) y la página muestra el botón **Ver mapa**, que carga el mapa recién al tocarlo, y **Cómo llegar**. Si no se
puede leer la ubicación, queda solo "Cómo llegar" y el armado avisa. El mapa de la secretaría sale de su dirección más
`secretaria_localidad` (por defecto "Atlántida, Canelones, Uruguay").

## Fotos

La foto de la secretaría es `assets/img/secretaria.webp` (hoy una de Street View provisoria: reemplazarla por una propia).

Poné las fotos en `assets/img/iglesias/` con el mismo nombre que `cod_iglesia`:
`atlantida.jpg`, `est-atlantida.jpg`, `las-toscas.jpg`, `pp-sur.jpg`, `pp-norte.jpg` (también `.jpeg`, `.png`, `.webp`).
Para reemplazarlas por las definitivas, usá el mismo nombre. Conviene que midan unos 1600 px de ancho y pesen
menos de 300 KB. Las iglesias sin foto muestran un dibujo provisorio.

## Comunidad de WhatsApp

Pegá el link de invitación en `datos/config.json` (`whatsapp_comunidad`), o como fila `whatsapp_comunidad` en
la pestaña Config. Con eso aparecen el botón "Unirme por WhatsApp", la página `/unirse/` con el código QR
(se puede imprimir) y el acceso en el menú. Si la clave está vacía, esas partes no se muestran.

## Publicar gratis en GitHub Pages

1. Creá una cuenta en github.com y un repositorio nuevo.
2. Subí el contenido de esta carpeta (sin `node_modules/` ni `dist/`).
3. En el repositorio: **Settings > Pages > Source: GitHub Actions**.
4. En la pestaña **Actions** se ejecuta "Publicar sitio". Cuando termina, la dirección aparece en Settings > Pages.

Se vuelve a publicar solo cada hora (para tomar los cambios de la planilla), cada vez que subís cambios, y a mano
con **Actions > Publicar sitio > Run workflow** cuando quieras ver un cambio ya.

Ojo: GitHub suele desactivar las tareas programadas de un repositorio público si pasan 60 días sin actividad.
Si la web deja de actualizarse sola, entrá a Actions y volvé a activar el flujo (o subí cualquier cambio).

Cuando el sitio ya tenga dirección definitiva, completá `url_sitio` en `datos/config.json`
(genera `sitemap.xml` para los buscadores).

## Estructura

```
build.mjs            arma dist/
lib/                 fechas.mjs (reglas y próxima misa), datos.mjs (lectura de la planilla), mapas.mjs, plantillas.mjs (HTML)
assets/              estilos.css, js/app.js, fonts/, img/iglesias/, favicon.svg
datos/               config.json, fuentes.json, respaldo/*.json (copia de los datos)
test/                pruebas de la lógica de fechas
.github/workflows/   publicación automática
```

Para refrescar la copia de respaldo con lo que hay hoy en Google: `npm run actualizar-respaldo`.

Tipografías: Lora e Inter (licencia OFL, incluidas en `assets/fonts/`).
