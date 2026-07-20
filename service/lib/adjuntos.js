const fs     = require('node:fs');
const path   = require('node:path');
const crypto = require('node:crypto');

const RAIZ = () => path.resolve(process.env.ADJUNTOS_PATH || '/adjuntos');

// Deja un nombre seguro para el sistema de archivos: sin separadores, sin
// saltos de directorio, sin nombres degenerados. Conserva acentos y espacios
// porque el nombre se le muestra al usuario.
function sanearNombre(nombre) {
  const base = String(nombre == null ? '' : nombre)
    .replace(/[\\/]+/g, '_')       // separadores → guion bajo
    .replace(/\0/g, '')            // bytes nulos
    .replace(/^[._]+/, '')         // puntos/guiones al inicio ("..", "_etc", ".oculto")
    .trim()
    .slice(0, 120);
  return base.length ? base : 'archivo';
}

// Ruta relativa <año>/<mes>/<uuid>-<nombre>. El uuid evita colisiones.
function rutaDe(nombre, ahora = new Date()) {
  const y = String(ahora.getFullYear());
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  return path.posix.join(y, m, `${crypto.randomUUID()}-${sanearNombre(nombre)}`);
}

// Resuelve una ruta relativa contra la raíz y verifica que no se salga.
// Es la última línea de defensa: aunque la base traiga una ruta envenenada,
// aquí se corta.
function absoluta(rutaRel) {
  const raiz = RAIZ();
  const abs  = path.resolve(raiz, rutaRel);
  if (abs !== raiz && !abs.startsWith(raiz + path.sep)) {
    throw new Error(`Ruta fuera de la raíz de adjuntos: ${rutaRel}`);
  }
  return abs;
}

function guardar(nombre, buffer) {
  const ruta = rutaDe(nombre);
  const abs  = absoluta(ruta);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, buffer);
  return { ruta, bytes: buffer.length };
}

function leer(rutaRel) {
  return fs.readFileSync(absoluta(rutaRel));
}

module.exports = { sanearNombre, rutaDe, absoluta, guardar, leer };
