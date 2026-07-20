# chat

Chat compartido del grupo. Un solo servicio consumido por Gestión, POS CRM,
Tickets, Checador y Contabilidad: **es el mismo chat** en todas.

- `service/` — API + SSE (Node/Express). Imagen Docker `chat-service`.
- `ui/` — paquete React `@devtrh/chat-ui` (Fase 3, aún no existe).

Diseño y plan viven en el repo `gestion`:
`docs/superpowers/specs/2026-07-20-chat-servicio-compartido-design.md`
`docs/superpowers/plans/2026-07-20-chat-servicio-fase1.md`

## Estado: Fase 1

El servicio existe y responde. **Sin datos y sin consumidores** — el chat de
Gestión sigue corriendo contra sus tablas viejas y nadie nota nada.

## Correr las pruebas

    cd service && npm test

## Generar `chat.env` (¡ojo con el `$`!)

Los valores se copian del contenedor de Gestión, así el `JWT_SECRET` queda
idéntico por construcción y nadie tiene que ver los secretos:

    cd /home/devn8n/chat
    docker exec teso-backend printenv | grep -E '^(DB_HOST|DB_PORT|DB_USER|DB_PASSWORD|JWT_SECRET)=' > chat.env
    echo 'DB_NAME=AUD' >> chat.env
    sed -i 's/\$/$$/g' chat.env        # <-- IMPRESCINDIBLE
    chmod 600 chat.env

**Por qué el `sed`:** docker compose (2.39) **interpola `$` incluso dentro de
`env_file`**. Una contraseña que contenga `$algo` llega al contenedor con ese
trozo borrado y Postgres responde `password authentication failed`, aunque el
archivo esté perfecto. Escapar `$` como `$$` lo arregla; compose lo devuelve a
un `$` literal.

Renombrar el archivo de `.env` a `chat.env` **no** basta: compose interpola
`env_file` sin importar el nombre. Verificado el 2026-07-20 (23 caracteres
llegaban como 19).

Para comprobar que llegó completo, sin revelarlo:

    docker exec chat-service  sh -c 'v=$(printenv DB_PASSWORD); echo "${#v} $(printf %s "$v" | sha256sum | cut -c1-8)"'
    docker exec teso-backend  sh -c 'v=$(printenv DB_PASSWORD); echo "${#v} $(printf %s "$v" | sha256sum | cut -c1-8)"'

Los dos hashes deben coincidir.

## Desplegar

1. Clonar en `/home/devn8n/chat`.
2. Crear `chat.env` (ver arriba) con `DB_*` (**`DB_NAME=AUD` en MAYUSCULAS** — la minuscula no existe), `JWT_SECRET` (el MISMO que usa Gestión: si no
   coincide, los tokens no validan y todo responde 401).
3. Aplicar `service/sql/01_schema_chat.sql` en la base `AUD`. (hecho 2026-07-20)
4. Pegar `nginx.chat.conf` DENTRO del `server {}` de `n8n.datazentrika.com`.
5. `docker compose up -d --build`
