/**
 * Verifica la Fase 2 comparando origen, destino y disco.
 * Sale con codigo 1 si algo no cuadra, para que falle en un pipeline.
 *   node scripts/verificar_fase2.js
 */
const fs   = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const RAIZ = path.resolve(process.env.ADJUNTOS_PATH || '/adjuntos');
const conf = (database) => ({
  host: process.env.DB_HOST, port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER, password: process.env.DB_PASSWORD,
  database, ssl: false,
});
const T = new Pool(conf('tesoreria'));
const A = new Pool(conf('AUD'));

let fallos = 0;
const check = (ok, etiqueta, detalle) => {
  console.log(`  ${ok ? 'OK  ' : 'FALLA'} ${etiqueta}${detalle ? '  ' + detalle : ''}`);
  if (!ok) fallos++;
};

(async () => {
  console.log('== conteos ==');
  const so = (await T.query('SELECT COUNT(*)::int n FROM chat_rooms')).rows[0].n;
  const sd = (await A.query('SELECT COUNT(*)::int n FROM chat.chat_rooms')).rows[0].n;
  check(so === sd, 'salas', `origen=${so} destino=${sd}`);

  const mo = (await T.query('SELECT COUNT(*)::int n FROM mensajes_chat')).rows[0].n;
  const md = (await A.query('SELECT COUNT(*)::int n FROM chat.mensajes_chat')).rows[0].n;
  check(mo === md, 'mensajes', `origen=${mo} destino=${md}`);

  const ao = (await T.query('SELECT COUNT(*)::int n FROM mensajes_chat WHERE archivo_data IS NOT NULL')).rows[0].n;
  const ad = (await A.query('SELECT COUNT(*)::int n FROM chat.mensajes_chat WHERE archivo_ruta IS NOT NULL')).rows[0].n;
  check(ao === ad, 'mensajes con adjunto', `origen=${ao} destino=${ad}`);

  console.log('\n== la sala cliente quedo como grupo ==');
  const cli = (await A.query("SELECT COUNT(*)::int n FROM chat.chat_rooms WHERE tipo='cliente'")).rows[0].n;
  check(cli === 0, 'no quedan salas tipo cliente', `n=${cli}`);
  const ref = (await A.query('SELECT COUNT(*)::int n FROM chat.chat_rooms WHERE referencia_id IS NOT NULL')).rows[0].n;
  check(ref === 0, 'ninguna sala conserva referencia_id', `n=${ref}`);

  console.log('\n== archivos en disco ==');
  const { rows: adj } = await A.query(
    'SELECT id, archivo_ruta, archivo_bytes FROM chat.mensajes_chat WHERE archivo_ruta IS NOT NULL ORDER BY id'
  );
  let faltan = 0, tamMal = 0, total = 0;
  for (const a of adj) {
    const abs = path.resolve(RAIZ, a.archivo_ruta);
    if (!fs.existsSync(abs)) { faltan++; console.log(`     falta: msg ${a.id} -> ${a.archivo_ruta}`); continue; }
    const real = fs.statSync(abs).size;
    total += real;
    if (real !== Number(a.archivo_bytes)) {
      tamMal++;
      console.log(`     tamano distinto: msg ${a.id} disco=${real} bd=${a.archivo_bytes}`);
    }
  }
  check(faltan === 0, 'todos los archivos existen', `revisados=${adj.length} faltan=${faltan}`);
  check(tamMal === 0, 'los tamanos cuadran', `distintos=${tamMal}`);
  console.log(`     peso en disco: ${(total / 1048576).toFixed(1)} MB`);

  console.log('\n== secuencias por delante del maximo id ==');
  const q = async (seq, tabla) => {
    const s = (await A.query(`SELECT last_value::int v FROM ${seq}`)).rows[0].v;
    const m = (await A.query(`SELECT COALESCE(MAX(id),0)::int v FROM ${tabla}`)).rows[0].v;
    check(s >= m, `${seq}`, `seq=${s} max_id=${m}`);
  };
  await q('chat.chat_rooms_id_seq', 'chat.chat_rooms');
  await q('chat.mensajes_chat_id_seq', 'chat.mensajes_chat');

  console.log('\n== el origen NO se toco ==');
  const b64 = (await T.query('SELECT COUNT(*)::int n FROM mensajes_chat WHERE archivo_data IS NOT NULL')).rows[0].n;
  check(b64 === 133, 'tesoreria conserva sus 133 adjuntos en base64', `n=${b64}`);

  await T.end(); await A.end();
  console.log(fallos ? `\n### ${fallos} VERIFICACION(ES) FALLIDA(S) ###` : '\n### TODO CUADRA ###');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
