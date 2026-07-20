/** Corre: node tests/adjuntos.test.js */
const assert = require('node:assert');
const path   = require('node:path');
const os     = require('node:os');
const fs     = require('node:fs');

const RAIZ = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-adj-'));
process.env.ADJUNTOS_PATH = RAIZ;
const A = require('../lib/adjuntos.js');

// sanearNombre: nunca deja separadores ni saltos de directorio
assert.strictEqual(A.sanearNombre('informe.pdf'), 'informe.pdf');
assert.strictEqual(A.sanearNombre('../../etc/passwd'), 'etc_passwd');
assert.strictEqual(A.sanearNombre('..\\..\\windows\\system32'), 'windows_system32');
assert.strictEqual(A.sanearNombre('/absoluto.txt'), 'absoluto.txt');
assert.strictEqual(A.sanearNombre('con espacios y ñ.xlsx'), 'con espacios y ñ.xlsx');
assert.strictEqual(A.sanearNombre(''), 'archivo');
assert.strictEqual(A.sanearNombre(null), 'archivo');
assert.strictEqual(A.sanearNombre('...'), 'archivo');
assert.ok(A.sanearNombre('a'.repeat(500)).length <= 120, 'debe recortar nombres largos');

// guardar(): escribe DENTRO de la raíz y devuelve una ruta relativa
const buf = Buffer.from('hola mundo');
const g = A.guardar('reporte.pdf', buf);
assert.ok(!path.isAbsolute(g.ruta), 'la ruta guardada debe ser relativa');
assert.strictEqual(g.bytes, buf.length);
const absoluta = path.join(RAIZ, g.ruta);
assert.ok(fs.existsSync(absoluta), 'el archivo debe existir en disco');
assert.strictEqual(fs.readFileSync(absoluta).toString(), 'hola mundo');

// dos archivos con el mismo nombre no se pisan
const g2 = A.guardar('reporte.pdf', Buffer.from('otro'));
assert.notStrictEqual(g.ruta, g2.ruta, 'nombres iguales deben producir rutas distintas');

// EL PUNTO CENTRAL: un nombre malicioso NO escapa de la raíz
const mal = A.guardar('../../../evil.sh', Buffer.from('x'));
const malAbs = path.resolve(RAIZ, mal.ruta);
assert.ok(malAbs.startsWith(path.resolve(RAIZ) + path.sep),
  'un nombre con ../ no debe escribir fuera de ADJUNTOS_PATH');

// leer(): resuelve dentro de la raíz y rechaza rutas que se salen
assert.strictEqual(A.leer(g.ruta).toString(), 'hola mundo');
assert.throws(() => A.leer('../../../etc/passwd'), /fuera de/i,
  'leer() debe rechazar rutas que salen de la raíz');
assert.throws(() => A.leer('/etc/passwd'), /fuera de/i);

fs.rmSync(RAIZ, { recursive: true, force: true });
console.log('OK adjuntos');
