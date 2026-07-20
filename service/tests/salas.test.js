/** Corre: node tests/salas.test.js */
const assert = require('node:assert');
const S = require('../lib/salas.js');

// esAdmin: solo los cuatro roles elevados
assert.strictEqual(S.esAdmin('admin'), true);
assert.strictEqual(S.esAdmin('superadmin'), true);
assert.strictEqual(S.esAdmin('ops_jefe'), true);
assert.strictEqual(S.esAdmin('jefe'), true);
assert.strictEqual(S.esAdmin('capturista'), false);
assert.strictEqual(S.esAdmin(''), false);
assert.strictEqual(S.esAdmin(null), false);
assert.strictEqual(S.esAdmin(undefined), false);

const persona      = { tipo: 'persona',      participantes: [7, 9] };
const grupo        = { tipo: 'grupo',        participantes: [7] };
const departamento = { tipo: 'departamento', participantes: [7] };

// persona: SOLO los participantes, ni siquiera un admin
assert.strictEqual(S.puedeVerSala(persona, 7,  'capturista'), true);
assert.strictEqual(S.puedeVerSala(persona, 9,  'capturista'), true);
assert.strictEqual(S.puedeVerSala(persona, 99, 'capturista'), false);
assert.strictEqual(S.puedeVerSala(persona, 99, 'admin'), false,
  'un admin NO debe leer los mensajes directos de otras dos personas');

// grupo y departamento: participantes, o cualquier admin
assert.strictEqual(S.puedeVerSala(grupo, 7,  'capturista'), true);
assert.strictEqual(S.puedeVerSala(grupo, 99, 'capturista'), false);
assert.strictEqual(S.puedeVerSala(grupo, 99, 'admin'), true);
assert.strictEqual(S.puedeVerSala(departamento, 99, 'jefe'), true);
assert.strictEqual(S.puedeVerSala(departamento, 99, 'capturista'), false);

// defensivo: sala inexistente, participantes ausentes, usuario inválido
assert.strictEqual(S.puedeVerSala(null, 7, 'admin'), false);
assert.strictEqual(S.puedeVerSala({ tipo: 'grupo' }, 7, 'capturista'), false);
assert.strictEqual(S.puedeVerSala(grupo, null, 'admin'), false);
assert.strictEqual(S.puedeVerSala({ tipo: 'otro', participantes: [7] }, 7, 'x'), true);
assert.strictEqual(S.puedeVerSala({ tipo: 'otro', participantes: [7] }, 8, 'admin'), false,
  'un tipo desconocido NO se abre a admins: se comporta como privado');

console.log('OK salas');
