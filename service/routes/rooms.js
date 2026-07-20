const express = require('express');
const db      = require('../db');
const { esAdmin } = require('../lib/salas');

const router = express.Router();

// GET /rooms — salas visibles para el usuario del token
router.get('/', async (req, res, next) => {
  try {
    const uid   = req.usuario.id;
    const admin = esAdmin(req.usuario.rol_clave);   // de la BASE, no del cliente
    const { rows } = await db.query(
      `SELECT r.id, r.tipo, r.nombre, r.referencia_id, r.participantes,
              CASE WHEN m.archivo_nombre IS NOT NULL AND (m.contenido IS NULL OR m.contenido = '')
                   THEN m.archivo_nombre ELSE m.contenido END AS ultimo_mensaje,
              m.created_at AS ultimo_mensaje_at,
              (SELECT COUNT(*)::int FROM chat.mensajes_chat mc
                WHERE mc.room_id = r.id
                  AND (mc.usuario_id IS NULL OR mc.usuario_id != $1)
                  AND NOT ($1 = ANY(mc.leido_por))) AS no_leidos
         FROM chat.chat_rooms r
         LEFT JOIN LATERAL (
           SELECT contenido, archivo_nombre, created_at
             FROM chat.mensajes_chat WHERE room_id = r.id
            ORDER BY created_at DESC LIMIT 1
         ) m ON true
        WHERE (r.tipo = 'persona' AND $1 = ANY(r.participantes))
           OR (r.tipo IN ('grupo','departamento') AND ($2 OR $1 = ANY(r.participantes)))
        ORDER BY ultimo_mensaje_at DESC NULLS LAST, r.nombre`,
      [uid, admin]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /rooms — crear sala
router.post('/', async (req, res, next) => {
  try {
    const { tipo, nombre, participantes } = req.body;
    if (!['persona', 'grupo', 'departamento'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo inválido' });
    }
    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ error: 'nombre requerido' });
    }
    const lista = Array.isArray(participantes) ? participantes.slice() : [];
    // El creador siempre queda dentro, para no crear salas a las que no entra.
    if (!lista.includes(req.usuario.id)) lista.push(req.usuario.id);

    const { rows } = await db.query(
      `INSERT INTO chat.chat_rooms (tipo, nombre, referencia_id, participantes)
       VALUES ($1, $2, NULL, $3) RETURNING *`,
      [tipo, String(nombre).trim(), lista]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// PATCH /rooms/:id/participantes
router.patch('/:id/participantes', async (req, res, next) => {
  try {
    const { participantes } = req.body;
    if (!Array.isArray(participantes)) {
      return res.status(400).json({ error: 'participantes requerido' });
    }
    const { rows } = await db.query(
      `UPDATE chat.chat_rooms SET participantes = $1 WHERE id = $2 RETURNING *`,
      [participantes, parseInt(req.params.id)]
    );
    if (!rows[0]) return res.status(404).json({ error: 'sala no encontrada' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// POST /rooms/:id/leido — marca leídos los mensajes ajenos de la sala
router.post('/:id/leido', async (req, res, next) => {
  try {
    const uid = req.usuario.id;   // del token, ya no del body
    await db.query(
      `UPDATE chat.mensajes_chat
          SET leido_por = array_append(leido_por, $1::integer)
        WHERE room_id = $2
          AND (usuario_id IS NULL OR usuario_id != $1::integer)
          AND NOT ($1::integer = ANY(leido_por))`,
      [uid, parseInt(req.params.id)]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
