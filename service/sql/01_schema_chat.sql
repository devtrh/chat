-- Schema del chat compartido. Vive en la base `aud`, junto a usuarios y roles.
CREATE SCHEMA IF NOT EXISTS chat;

CREATE TABLE IF NOT EXISTS chat.chat_rooms (
  id            SERIAL PRIMARY KEY,
  tipo          TEXT NOT NULL CHECK (tipo IN ('persona','grupo','departamento')),
  nombre        TEXT NOT NULL,
  referencia_id INTEGER,          -- gancho para salas contextuales a futuro; hoy siempre NULL
  participantes INTEGER[] NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat.mensajes_chat (
  id             SERIAL PRIMARY KEY,
  room_id        INTEGER NOT NULL REFERENCES chat.chat_rooms(id) ON DELETE CASCADE,
  usuario_id     INTEGER REFERENCES public.usuarios(id) ON DELETE SET NULL,
  contenido      TEXT NOT NULL DEFAULT '',
  archivo_nombre TEXT,
  archivo_mime   TEXT,
  archivo_ruta   TEXT,            -- ruta relativa dentro de ADJUNTOS_PATH
  archivo_bytes  BIGINT,
  leido_por      INTEGER[] NOT NULL DEFAULT '{}',
  favorito_por   INTEGER[] NOT NULL DEFAULT '{}',
  reacciones     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_chat_room
  ON chat.mensajes_chat (room_id, created_at);

-- Para resolver "¿de qué salas soy participante?" sin escanear la tabla.
CREATE INDEX IF NOT EXISTS idx_chat_rooms_participantes
  ON chat.chat_rooms USING GIN (participantes);

-- Verificación:
--   SELECT table_name FROM information_schema.tables
--    WHERE table_schema = 'chat' ORDER BY 1;
--   Esperado: chat_rooms, mensajes_chat
