const express = require('express');
const { requiereAuth } = require('./auth');

const app  = express();
const MAX  = parseInt(process.env.MAX_UPLOAD_MB || '50');

// El adjunto viaja en base64 dentro del JSON: se deja margen sobre el límite
// real del archivo (base64 infla ~33%).
app.use(express.json({ limit: `${Math.ceil(MAX * 1.4)}mb` }));

// Sin auth: para que el orquestador sepa si el proceso vive.
app.get('/health', (req, res) => res.json({ ok: true }));

// Todo lo demás exige token.
//
// La ruta más específica va PRIMERO. Hoy da igual —`/rooms` sí hace match por
// prefijo con `/rooms/1/mensajes`, pero ninguna ruta del router de salas empata
// con `/:id/mensajes`, así que llama next() y cae al de mensajes (verificado)—.
// Se deja así por prevención: el día que alguien agregue un `GET /:id` a
// rooms.js, con el orden invertido se tragaría las peticiones de mensajes sin
// que nada avise.
app.use('/sse', requiereAuth, require('./routes/sse'));
app.use('/rooms/:id/mensajes', requiereAuth, require('./routes/mensajes'));
app.use('/rooms', requiereAuth, require('./routes/rooms'));

app.use((err, req, res, _next) => {
  console.error('[chat]', err.message);
  res.status(500).json({ error: 'Error interno' });
});

const PORT = parseInt(process.env.PORT || '4010');
app.listen(PORT, () => console.log(`chat-service escuchando en :${PORT}`));
