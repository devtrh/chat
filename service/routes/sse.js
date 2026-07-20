const express = require('express');
const sse     = require('../lib/sse');

const router = express.Router();

router.get('/', (req, res) => {
  const uid = req.usuario.id;   // del JWT, nunca del query

  res.writeHead(200, {
    'Content-Type':      'text/event-stream',
    'Cache-Control':     'no-cache',
    'Connection':        'keep-alive',
    'X-Accel-Buffering': 'no',   // por si nginx no trae proxy_buffering off
  });
  res.flushHeaders();

  sse.registrar(uid, res);

  // Lista de quién está en línea, para el que acaba de entrar.
  res.write(`event: online_list\ndata: ${JSON.stringify({ users: sse.conectados() })}\n\n`);

  // Avisar a los demás que este usuario se conectó.
  for (const otro of sse.conectados()) {
    if (otro !== uid) sse.enviar(otro, 'status', { user_id: uid, online: true });
  }

  const latido = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(latido); }
  }, 25000);

  req.on('close', () => {
    clearInterval(latido);
    const seFue = sse.quitar(uid, res);
    if (seFue) {
      for (const otro of sse.conectados()) {
        sse.enviar(otro, 'status', { user_id: uid, online: false });
      }
    }
  });
});

module.exports = router;
