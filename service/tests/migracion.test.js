/** Corre: node tests/migracion.test.js */
const assert = require('node:assert');
const M = require('../lib/migracion.js');

// La sala 'cliente' se vuelve 'grupo' y pierde la referencia a ops_clientes
const cliente = { id: 24, tipo: 'cliente', nombre: 'ACC', referencia_id: 1, participantes: [3, 7] };
assert.deepStrictEqual(M.transformarSala(cliente), {
  id: 24, tipo: 'grupo', nombre: 'ACC', referencia_id: null, participantes: [3, 7],
});

// Los otros tipos pasan intactos, pero referencia_id SIEMPRE queda en null
for (const t of ['persona', 'grupo', 'departamento']) {
  const s = { id: 5, tipo: t, nombre: 'X', referencia_id: 99, participantes: [1] };
  const r = M.transformarSala(s);
  assert.strictEqual(r.tipo, t, `${t} no debe cambiar de tipo`);
  assert.strictEqual(r.referencia_id, null, `${t} debe quedar sin referencia_id`);
  assert.strictEqual(r.id, 5);
}

// participantes ausente o null se vuelve arreglo vacío (la columna es NOT NULL)
assert.deepStrictEqual(M.transformarSala({ id: 1, tipo: 'grupo', nombre: 'A' }).participantes, []);
assert.deepStrictEqual(M.transformarSala({ id: 1, tipo: 'grupo', nombre: 'A', participantes: null }).participantes, []);

// Un tipo desconocido revienta: mejor parar la migración que meter basura
assert.throws(() => M.transformarSala({ id: 1, tipo: 'inventado', nombre: 'A' }), /tipo/i);

// rutaAdjunto: determinista a partir del id del mensaje, para que re-correr
// el script NO genere una ruta distinta ni duplique archivos en disco.
const r1 = M.rutaAdjunto(287, 'installer.rar', new Date('2026-03-15T10:00:00Z'));
const r2 = M.rutaAdjunto(287, 'installer.rar', new Date('2026-03-15T10:00:00Z'));
assert.strictEqual(r1, r2, 'la misma entrada debe dar la misma ruta (idempotencia)');
assert.strictEqual(r1, '2026/03/287-installer.rar');

// Nombres peligrosos quedan saneados y nunca escapan del directorio
assert.strictEqual(M.rutaAdjunto(9, '../../etc/passwd', new Date('2026-01-02T00:00:00Z')), '2026/01/9-etc_passwd');
assert.strictEqual(M.rutaAdjunto(9, null, new Date('2026-01-02T00:00:00Z')), '2026/01/9-archivo');
assert.ok(!M.rutaAdjunto(9, '../x', new Date('2026-01-02T00:00:00Z')).includes('..'));

console.log('OK migracion');
