/**
 * Fase 2 — copia el chat de tesoreria.public a AUD.chat.
 *
 *   node scripts/migrar_fase2.js            → DRY-RUN (no escribe nada)
 *   node scripts/migrar_fase2.js --apply    → escribe
 *
 * SOLO LEE del origen. No borra ni modifica nada en `tesoreria`.
 * Idempotente: re-correrlo no duplica (ON CONFLICT DO NOTHING + rutas
 * deterministas).
 */
const fs   = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');
const { transformarSala, rutaAdjunto } = require('../lib/migracion');

const APPLY = process.argv.includes('--apply');
const RAIZ  = path.resolve(process.env.ADJUNTOS_PATH || '/adjuntos');

const conf = (database) => ({
  host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database, ssl: false,
});
const T = new Pool(conf('tesoreria'));   // origen (solo lectura)
const A = new Pool(conf('AUD'));         // destino

const mb = (n) => (n / 1048576).toFixed(1) + ' MB';

(async () => {
  console.log(APPLY ? '### APLICANDO ###' : '### DRY-RUN (no escribe) ###');

  // ── 1. Salas ────────────────────────────────────────────────────────────
  const { rows: salas } = await T.query(
    'SELECT id, tipo, nombre, referencia_id, participantes, created_at FROM chat_rooms ORDER BY id'
  );
  console.log(`\nSalas en origen: ${salas.length}`);
  let salasNuevas = 0;
  for (const s of salas) {
    const t = transformarSala(s);
    if (s.tipo !== t.tipo) console.log(`  sala ${s.id} "${s.nombre}": ${s.tipo} -> ${t.tipo} (referencia_id ${s.referencia_id} -> null)`);
    if (!APPLY) { salasNuevas++; continue; }
    const r = await A.query(
      `INSERT INTO chat.chat_rooms (id, tipo, nombre, referencia_id, participantes, created_at)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
      [t.id, t.tipo, t.nombre, t.referencia_id, t.participantes, s.created_at]
    );
    salasNuevas += r.rowCount;
  }
  console.log(`  insertadas: ${salasNuevas}`);

  // ── 2. Mensajes ─────────────────────────────────────────────────────────
  // SIN archivo_data: traer los 133 adjuntos de golpe son ~850 MB de RAM
  // (las cadenas de JS son UTF-16). El binario se pide uno por uno abajo.
  const { rows: msgs } = await T.query(
    `SELECT id, room_id, usuario_id, contenido, archivo_nombre, archivo_mime,
            leido_por, favorito_por, reacciones, created_at,
            (archivo_data IS NOT NULL) AS tiene_adjunto
       FROM mensajes_chat ORDER BY id`
  );
  const conAdj = msgs.filter(m => m.tiene_adjunto).length;
  console.log(`\nMensajes en origen: ${msgs.length}  (con adjunto: ${conAdj})`);

  let msgsNuevos = 0, archivos = 0, bytes = 0;
  for (const m of msgs) {
    let ruta = null, tam = null;

    if (m.tiene_adjunto) {
      // Una fila, una columna. Se libera al terminar la iteración.
      const { rows: [a] } = await T.query('SELECT archivo_data FROM mensajes_chat WHERE id = $1', [m.id]);
      const buf = Buffer.from(a.archivo_data, 'base64');
      ruta = rutaAdjunto(m.id, m.archivo_nombre, m.created_at);
      tam  = buf.length;
      bytes += tam;
      archivos++;
      if (APPLY) {
        const abs = path.resolve(RAIZ, ruta);
        if (!abs.startsWith(RAIZ + path.sep)) throw new Error(`ruta fuera de la raiz: ${ruta}`);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, buf);
      }
    }

    if (!APPLY) { msgsNuevos++; continue; }
    const r = await A.query(
      `INSERT INTO chat.mensajes_chat
         (id, room_id, usuario_id, contenido, archivo_nombre, archivo_mime,
          archivo_ruta, archivo_bytes, leido_por, favorito_por, reacciones, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING`,
      [m.id, m.room_id, m.usuario_id, m.contenido, m.archivo_nombre, m.archivo_mime,
       ruta, tam, m.leido_por, m.favorito_por, JSON.stringify(m.reacciones), m.created_at]
    );
    msgsNuevos += r.rowCount;
  }
  console.log(`  insertados: ${msgsNuevos}`);
  console.log(`  archivos a disco: ${archivos}  (${mb(bytes)} reales)`);

  // ── 3. Secuencias ───────────────────────────────────────────────────────
  // Se insertó con ids explícitos, así que el SERIAL sigue en 1 y el próximo
  // mensaje nuevo chocaría. Esto no da la cara hasta que alguien escribe.
  if (APPLY) {
    await A.query(`SELECT setval('chat.chat_rooms_id_seq',    COALESCE((SELECT MAX(id) FROM chat.chat_rooms), 1))`);
    await A.query(`SELECT setval('chat.mensajes_chat_id_seq', COALESCE((SELECT MAX(id) FROM chat.mensajes_chat), 1))`);
    const s1 = await A.query(`SELECT last_value FROM chat.chat_rooms_id_seq`);
    const s2 = await A.query(`SELECT last_value FROM chat.mensajes_chat_id_seq`);
    console.log(`\nSecuencias: salas=${s1.rows[0].last_value}  mensajes=${s2.rows[0].last_value}`);
  }

  await T.end(); await A.end();
  console.log(APPLY ? '\nListo. Corre la verificacion.' : '\nDRY-RUN terminado. Nada se escribio.');
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
