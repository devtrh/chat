const express = require('express');
const db      = require('../db');
const sse     = require('../lib/sse');
const adj     = require('../lib/adjuntos');
const { puedeVerSala } = require('../lib/salas');

const router = express.Router({ mergeParams: true });

// Carga la sala y corta si el usuario del token no puede verla.
// Es el guard que faltaba: antes cualquiera leía cualquier sala por id.
async function cargarSala(req, res, next) {
  try {
    const roomId = parseInt(req.params.id);
    if (!Number.isInteger(roomId)) return res.status(400).json({ error: 'sala inválida' });
    const { rows } = await db.query(
      'SELECT id, tipo, nombre, participantes FROM chat.chat_rooms WHERE id = $1',
      [roomId]
    );
    const sala = rows[0];
    if (!sala) return res.status(404).json({ error: 'sala no encontrada' });
    if (!puedeVerSala(sala, req.usuario.id, req.usuario.rol_clave)) {
      return res.status(403).json({ error: 'sin acceso a esta sala' });
    }
    req.sala = sala;
    next();
  } catch (err) { next(err); }
}

router.use('/', cargarSala);

// GET /rooms/:id/mensajes
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '200'), 500);
    const { rows } = await db.query(
      `SELECT mc.id, mc.room_id, mc.usuario_id, u.nombre AS usuario_nombre,
              mc.contenido, mc.archivo_nombre, mc.archivo_mime, mc.archivo_bytes,
              mc.leido_por, mc.favorito_por, mc.reacciones, mc.created_at
         FROM chat.mensajes_chat mc
         LEFT JOIN public.usuarios u ON u.id = mc.usuario_id
        WHERE mc.room_id = $1
        ORDER BY mc.created_at ASC
        LIMIT $2`,
      [req.sala.id, limit]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// POST /rooms/:id/mensajes — el adjunto llega en base64 y se escribe a disco
router.post('/', async (req, res, next) => {
  try {
    const uid = req.usuario.id;
    const { contenido, archivo_nombre, archivo_mime, archivo_data } = req.body;
    if (!String(contenido || '').trim() && !archivo_data) {
      return res.status(400).json({ error: 'Se requiere contenido o archivo' });
    }

    let ruta = null, bytes = null;
    if (archivo_data) {
      const buffer = Buffer.from(archivo_data, 'base64');
      const maxMB  = parseInt(process.env.MAX_UPLOAD_MB || '50');
      if (buffer.length > maxMB * 1024 * 1024) {
        return res.status(413).json({ error: `El archivo excede ${maxMB} MB` });
      }
      const g = adj.guardar(archivo_nombre, buffer);
      ruta = g.ruta; bytes = g.bytes;
    }

    const { rows } = await db.query(
      `INSERT INTO chat.mensajes_chat
         (room_id, usuario_id, contenido, archivo_nombre, archivo_mime, archivo_ruta, archivo_bytes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, room_id, usuario_id, contenido, archivo_nombre, archivo_mime,
                 archivo_bytes, leido_por, created_at`,
      [req.sala.id, uid, String(contenido || '').trim(),
       archivo_nombre ? adj.sanearNombre(archivo_nombre) : null,
       archivo_mime || null, ruta, bytes]
    );

    // En salas de tipo persona, quien escribe queda como participante.
    if (req.sala.tipo === 'persona' && !req.sala.participantes.includes(uid)) {
      await db.query(
        `UPDATE chat.chat_rooms SET participantes = array_append(participantes, $1)
          WHERE id = $2 AND NOT ($1 = ANY(participantes))`,
        [uid, req.sala.id]
      );
      req.sala.participantes.push(uid);
    }

    sse.difundirSala(req.sala, 'msg', { room_id: req.sala.id });
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// GET /rooms/:id/mensajes/:msgId/archivo — pasa por aquí, NO por nginx estático
router.get('/:msgId/archivo', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT archivo_nombre, archivo_mime, archivo_ruta
         FROM chat.mensajes_chat WHERE id = $1 AND room_id = $2`,
      [parseInt(req.params.msgId), req.sala.id]
    );
    const m = rows[0];
    if (!m || !m.archivo_ruta) return res.status(404).json({ error: 'Sin archivo' });

    let buffer;
    try {
      buffer = adj.leer(m.archivo_ruta);
    } catch (e) {
      console.error('[archivo]', e.message);
      return res.status(404).json({ error: 'Archivo no disponible' });
    }
    res.setHeader('Content-Type', m.archivo_mime || 'application/octet-stream');
    res.setHeader('Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(m.archivo_nombre || 'archivo')}`);
    res.send(buffer);
  } catch (err) { next(err); }
});

// POST /rooms/:id/mensajes/:msgId/favorito
router.post('/:msgId/favorito', async (req, res, next) => {
  try {
    const uid = req.usuario.id;
    const mid = parseInt(req.params.msgId);
    const sql = req.body.favorito === false
      ? `UPDATE chat.mensajes_chat SET favorito_por = array_remove(favorito_por, $1::integer)
          WHERE id = $2 AND room_id = $3`
      : `UPDATE chat.mensajes_chat SET favorito_por = array_append(favorito_por, $1::integer)
          WHERE id = $2 AND room_id = $3 AND NOT ($1::integer = ANY(favorito_por))`;
    await db.query(sql, [uid, mid, req.sala.id]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// POST /rooms/:id/mensajes/:msgId/reaccion — una reacción por usuario, con toggle
router.post('/:msgId/reaccion', async (req, res, next) => {
  try {
    const uid   = req.usuario.id;
    const mid   = parseInt(req.params.msgId);
    const emoji = req.body.emoji;
    if (!emoji) return res.status(400).json({ error: 'emoji requerido' });

    const cur = await db.query(
      'SELECT reacciones FROM chat.mensajes_chat WHERE id = $1 AND room_id = $2',
      [mid, req.sala.id]
    );
    if (!cur.rows.length) return res.status(404).json({ error: 'mensaje no encontrado' });

    let arr = Array.isArray(cur.rows[0].reacciones) ? cur.rows[0].reacciones : [];
    const mia = arr.find(r => r.u === uid);
    arr = arr.filter(r => r.u !== uid);              // quitar la anterior (una por usuario)
    if (!(mia && mia.e === emoji)) arr.push({ u: uid, e: String(emoji) });  // mismo emoji → toggle

    await db.query('UPDATE chat.mensajes_chat SET reacciones = $1::jsonb WHERE id = $2',
                   [JSON.stringify(arr), mid]);
    sse.difundirSala(req.sala, 'msg', { room_id: req.sala.id });
    res.json({ ok: true, reacciones: arr });
  } catch (err) { next(err); }
});

module.exports = router;
