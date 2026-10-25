// Lee el ancho y alto de una imagen (PNG, JPEG o WebP) sin librerías externas.
// Sirve para que la página reserve el lugar de la foto y elija cómo mostrarla.

/**
 * Cómo conviene mostrar la foto:
 *  h = horizontal, a todo el ancho; v = vertical, junto al título; c = chica, en tamaño reducido.
 */
export function formaFoto(f) {
  if (!f || !f.w || !f.h) return 'h';
  const vertical = f.h > f.w * 1.05;
  if (f.w < (vertical ? 600 : 900)) return 'c';
  return vertical ? 'v' : 'h';
}

export function medidasImagen(b) {
  try {
    // PNG
    if (b.length > 24 && b.readUInt32BE(0) === 0x89504e47) {
      return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    }
    // WebP
    if (b.length > 30 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
      const tipo = b.toString('ascii', 12, 16);
      if (tipo === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
      if (tipo === 'VP8L') {
        const bits = b.readUInt32LE(21);
        return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
      }
      if (tipo === 'VP8X') return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
    }
    // JPEG
    if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) {
          return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
        }
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
  } catch { /* se devuelve null */ }
  return null;
}
