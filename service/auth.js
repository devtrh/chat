const jwt = require('jsonwebtoken');
const db  = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;

// Saca el id de usuario del JWT. Devuelve null si no hay token, si la firma no
// cuadra, o si el token no trae `id`.
//
// NUNCA lee usuario_id de query ni de body: esa era justamente la falla del
// código original (cualquiera se hacía pasar por otro cambiando un número).
function idDeToken(req) {
  const h = (req.headers && req.headers.authorization) || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    const payload = jwt.verify(h.slice(7), JWT_SECRET);
    const id = payload && payload.id;
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
}

// Middleware. Deja en req.usuario = { id, rol_clave }.
// El rol se lee de la BASE, no del cliente: mandar ?rol_clave=admin no sirve.
async function requiereAuth(req, res, next) {
  const id = idDeToken(req);
  if (id == null) return res.status(401).json({ error: 'Token requerido o inválido' });
  try {
    const { rows } = await db.query(
      `SELECT u.id, r.clave AS rol_clave
         FROM public.usuarios u
         JOIN public.roles r ON r.id = u.rol_id
        WHERE u.id = $1 AND u.activo = true`,
      [id]
    );
    if (!rows[0]) return res.status(401).json({ error: 'Usuario inactivo o inexistente' });
    req.usuario = { id: rows[0].id, rol_clave: rows[0].rol_clave };
    next();
  } catch (err) { next(err); }
}

module.exports = { idDeToken, requiereAuth };
