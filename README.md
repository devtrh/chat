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

## Desplegar

1. Clonar en `/home/devn8n/chat`.
2. Crear `.env` con `DB_*`, `JWT_SECRET` (el MISMO que usa Gestión: si no
   coincide, los tokens no validan y todo responde 401).
3. Aplicar `service/sql/01_schema_chat.sql` en la base `aud`.
4. Pegar `nginx.chat.conf` DENTRO del `server {}` de `n8n.datazentrika.com`.
5. `docker compose up -d --build`
