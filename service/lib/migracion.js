const path = require('node:path');
const { sanearNombre } = require('./adjuntos');

const TIPOS_DESTINO = ['persona', 'grupo', 'departamento'];

// La sala 'cliente' de Gestión se vuelve 'grupo': el servicio compartido no
// conoce ops_clientes, así que su referencia_id se anula en vez de quedar
// apuntando a una tabla que no existe en esta base.
function transformarSala(sala) {
  const tipo = sala.tipo === 'cliente' ? 'grupo' : sala.tipo;
  if (!TIPOS_DESTINO.includes(tipo)) {
    throw new Error(`tipo de sala desconocido: ${sala.tipo} (sala ${sala.id})`);
  }
  return {
    id: sala.id,
    tipo,
    nombre: sala.nombre,
    referencia_id: null,
    participantes: Array.isArray(sala.participantes) ? sala.participantes : [],
  };
}

// Ruta DETERMINISTA: usa el id del mensaje, no un uuid. Así re-correr el
// script sobreescribe el mismo archivo en vez de dejar copias huérfanas.
function rutaAdjunto(mensajeId, nombre, creadoEn) {
  const d = creadoEn instanceof Date ? creadoEn : new Date(creadoEn);
  const y = String(d.getUTCFullYear());
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  return path.posix.join(y, m, `${mensajeId}-${sanearNombre(nombre)}`);
}

module.exports = { transformarSala, rutaAdjunto, TIPOS_DESTINO };
