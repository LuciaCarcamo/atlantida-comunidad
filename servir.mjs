// Visor local: sirve la carpeta dist/ en http://localhost:8080 (sin instalar nada más).
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const PUERTO = Number(process.env.PORT) || 8080;
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
};

createServer(async (req, res) => {
  try {
    let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let archivo = path.normalize(path.join(RAIZ, ruta));
    if (!archivo.startsWith(RAIZ)) { res.writeHead(403).end('Prohibido'); return; }
    if ((await stat(archivo).catch(() => null))?.isDirectory()) archivo = path.join(archivo, 'index.html');
    const datos = await readFile(archivo);
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo).toLowerCase()] || 'application/octet-stream' }).end(datos);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('No encontrado');
  }
}).listen(PUERTO, () => console.log(`Sitio en http://localhost:${PUERTO}  (Ctrl+C para cortar)`));
