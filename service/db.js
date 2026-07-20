const { Pool } = require('pg');

// search_path: las tablas del chat viven en el schema `chat`; `public` queda
// disponible para leer `usuarios` y `roles` sin calificar.
const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl:      false,
  max:      10,
  options:  '-c search_path=chat,public',
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  connect: () => pool.connect(),
  pool,
};
