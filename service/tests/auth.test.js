/** Corre: node tests/auth.test.js */
const assert = require('node:assert');
const jwt    = require('jsonwebtoken');

process.env.JWT_SECRET = 'secreto-de-prueba';
const A = require('../auth.js');

const firmar = (payload) => jwt.sign(payload, process.env.JWT_SECRET);

// idDeToken: saca el id del header Authorization
assert.strictEqual(A.idDeToken({ headers: { authorization: 'Bearer ' + firmar({ id: 42 }) } }), 42);

// sin token, mal formado, o firmado con otro secreto → null
assert.strictEqual(A.idDeToken({ headers: {} }), null);
assert.strictEqual(A.idDeToken({ headers: { authorization: 'Bearer basura' } }), null);
assert.strictEqual(A.idDeToken({ headers: { authorization: firmar({ id: 42 }) } }), null,
  'sin el prefijo Bearer no se acepta');
assert.strictEqual(
  A.idDeToken({ headers: { authorization: 'Bearer ' + jwt.sign({ id: 42 }, 'otro-secreto') } }),
  null,
  'un token firmado con otro secreto debe rechazarse');

// un token sin `id` no sirve
assert.strictEqual(A.idDeToken({ headers: { authorization: 'Bearer ' + firmar({ nombre: 'x' }) } }), null);

// EL PUNTO CENTRAL: el id del token gana sobre cualquier cosa que mande el cliente
const req = {
  headers: { authorization: 'Bearer ' + firmar({ id: 7 }) },
  query:   { usuario_id: '999', rol_clave: 'admin' },
  body:    { usuario_id: 999 },
};
assert.strictEqual(A.idDeToken(req), 7,
  'el usuario_id de query/body debe ser ignorado por completo');

console.log('OK auth');
