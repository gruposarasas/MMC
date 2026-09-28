# Mundial de Café · app de beneficios

App web mobile-first del **Mundial de Café by Bruno Brown** (Bodega Arizu, Mendoza, 3 y 4 de octubre de 2026).
Los visitantes escanean un QR, se registran y reciben una billetera con cupones de las marcas; los canjean en cada stand con el código de caja de 4 números.

- **Producción:** https://mmc.saraimagineers.com
- **Stack:** Next.js 15 (App Router, TypeScript) · Supabase (proyecto `MMC`, São Paulo) · Docker en Easypanel (proyecto `mmc`).
- **Diseño y textos:** `referencia/prototipo-mundial.html`, el prototipo aprobado. El brief completo está en `CLAUDE.md`.

## Rutas

| Ruta | Quién | Qué |
|---|---|---|
| `/` | Visitante | Registro. Con sesión, va directo a la billetera. |
| `/recuperar` | Visitante | Entrar con el mail o el WhatsApp del registro. |
| `/billetera` | Visitante | Cupones e historial de canjes. |
| `/canjear/[marca]` | Visitante | Teclado del código de caja y pantalla "Canje válido". |
| `/marca` | Marca | Ingreso con su clave, sus canjes y el envío del cupón. |
| `/admin` | Organización | Back office (Resumen, Beneficios, Visitantes, Canjes). |
| `/admin/carteles` | Organización | Cartel con QR y tarjetas de caja para imprimir. |
| `/api/salud` | — | Healthcheck. |

## Variables de entorno

| Variable | Qué es | De dónde sale |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto | `https://ypyhinicminqjfpckxbj.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (anon) | Supabase → Project Settings → API Keys. Hoy la app no la usa para leer datos: con RLS, la anon key no ve nada. |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta del servidor | Supabase → Project Settings → API Keys → `service_role` (o una `sb_secret_…`). **Nunca** en el cliente ni en el repo. |
| `ADMIN_PASSWORD` | Contraseña de `/admin` | Elegila vos, larga. |
| `SESSION_SECRET` | Firma de las cookies (mín. 32 caracteres) | `openssl rand -base64 48` |

Las variables se leen **al arrancar**, no en el build: cambiar una en Easypanel solo requiere reiniciar la app.

## Deploy en Easypanel

1. En el proyecto `mmc`, crear un servicio **App**.
2. **Source:** GitHub → `gruposarasas/MMC`, rama `claude/amazing-pascal-b2epvu` (hasta que exista `main`), build con **Dockerfile** (ruta `Dockerfile`).
3. **Environment:** las cinco variables de arriba.
4. **Domains:** `mmc.saraimagineers.com` → `http://mmc_mmc:80/`, HTTPS activado (Let's Encrypt). Easypanel le pasa `PORT=80` al contenedor y eso pisa el 3000 del Dockerfile, así que el destino es el **80**. El DNS (registro A `mmc` en GoDaddy) apunta al servidor de Easypanel.
5. Deploy. Al arrancar, la app sube sola a Storage los 29 logos iniciales (`semilla/logos`) si faltan; en los logs se ve `[logos] 29 logos iniciales subidos a Storage`.

La app corre en **un solo contenedor**: los límites de uso se guardan en memoria. No escalar a varias réplicas sin moverlos a la base.

## Base de datos

Las migraciones están en `supabase/migrations/` y **ya están aplicadas** en el proyecto `MMC`, igual que la semilla (`supabase/seed.sql`).

- `marcas`, `visitantes`, `canjes`, `intentos_canje`.
- `canjear(visitante, marca, código)`: valida y registra el canje en una transacción. Bloquea la fila del visitante, así que pedidos simultáneos nunca superan los créditos. Con 3 códigos mal seguidos para una marca, bloquea 60 segundos. Los canjes después del 4/10 (hora de Mendoza) quedan con `post_evento = true`.
- `registrar_visitante(...)`: si el mail o el WhatsApp ya existen, devuelve esa billetera.
- `resumen_admin()`: números del back office.
- **Seguridad:** RLS activado en todas las tablas y sin políticas; permisos revocados a `anon` y `authenticated`, incluidas las funciones. Todo pasa por el servidor con la service role. El código de caja y la clave nunca llegan a las pantallas del visitante.
- Bucket público `logos` (hasta 1 MB, PNG/JPG/WebP). Solo sube el servidor.

### Regenerar la semilla

`npm run extraer` vuelve a leer el prototipo y regenera `public/img/`, `semilla/logos/`, `src/lib/recursos.json` y `supabase/seed.sql`. Las claves y los códigos salen del mismo algoritmo del prototipo (p. ej., Shelby → `SHELBY-JM`, código `2870`). La semilla es idempotente por nombre de marca.

## Sesiones y límites

- Cookies `httpOnly` firmadas con HMAC: visitante 1 año, marca 30 días (una "Nueva clave" cierra las sesiones abiertas de esa marca), admin 12 horas.
- Límites por IP generosos, porque en el evento mucha gente comparte IP: registro 30/min, recuperar 10/min, canje 20/min por visitante, ingreso de marca 10 fallos cada 15 min, ingreso a admin 5 fallos cada 15 min.

## Desarrollo local

```bash
npm install
cp .env.example .env.local   # completar
npm run dev
```

`npm run lint` corre el chequeo de tipos.
