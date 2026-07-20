// Registro de conexiones SSE por usuario. Un usuario puede tener varias
// pestañas abiertas, por eso el valor es un Set de respuestas.
const clientes = new Map(); // Map<usuarioId, Set<Response>>

function enviar(usuarioId, evento, datos) {
  const set = clientes.get(usuarioId);
  if (!set || !set.size) return;
  const payload = `event: ${evento}\ndata: ${JSON.stringify(datos)}\n\n`;
  for (const res of set) {
    try { res.write(payload); } catch { /* conexión muerta; se limpia en 'close' */ }
  }
}

function conectados() {
  return [...clientes.keys()];
}

function registrar(usuarioId, res) {
  if (!clientes.has(usuarioId)) clientes.set(usuarioId, new Set());
  clientes.get(usuarioId).add(res);
}

// Devuelve true si el usuario quedó sin conexiones (se fue del todo).
function quitar(usuarioId, res) {
  const set = clientes.get(usuarioId);
  if (!set) return false;
  set.delete(res);
  if (set.size) return false;
  clientes.delete(usuarioId);
  return true;
}

// Difunde a los participantes de una sala. En grupos y departamentos los
// admins también pueden estar viendo sin ser participantes, así que ahí se
// avisa a todos los conectados (igual que hacía Gestión).
function difundirSala(sala, evento, datos) {
  if (sala && (sala.tipo === 'grupo' || sala.tipo === 'departamento')) {
    for (const uid of conectados()) enviar(uid, evento, datos);
  } else {
    for (const uid of ((sala && sala.participantes) || [])) enviar(uid, evento, datos);
  }
}

module.exports = { clientes, enviar, conectados, registrar, quitar, difundirSala };
