// Autorización de salas. PURO a propósito: sin base de datos ni Express, para
// que la parte de seguridad se pueda verificar con assert.
//
// La regla la hereda de Gestión (operaciones.js:263-268) con dos cambios:
//   - el tipo 'cliente' ya no existe (salas globales solamente);
//   - un tipo desconocido NO se abre a admins (antes tampoco, se conserva).

const ROLES_ADMIN = ['admin', 'superadmin', 'ops_jefe', 'jefe'];

function esAdmin(rolClave) {
  return ROLES_ADMIN.includes(rolClave || '');
}

function puedeVerSala(sala, usuarioId, rolClave) {
  if (!sala || usuarioId == null) return false;
  const participantes = Array.isArray(sala.participantes) ? sala.participantes : [];
  const esParticipante = participantes.includes(usuarioId);

  // Los mensajes directos son privados incluso para un admin.
  if (sala.tipo === 'persona') return esParticipante;

  // Grupos y departamentos son abiertos para los roles elevados.
  if (sala.tipo === 'grupo' || sala.tipo === 'departamento') {
    return esParticipante || esAdmin(rolClave);
  }

  // Cualquier otro tipo se trata como privado.
  return esParticipante;
}

module.exports = { esAdmin, puedeVerSala, ROLES_ADMIN };
