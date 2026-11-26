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
| `/sorteo` | Organización | Pantalla para proyectar el sorteo de la camiseta (pide la contraseña de admin): presentes en vivo, SORTEAR con ruleta y ganador. `/admin/sorteo` redirige acá. |
| `/competencia` | Público | Pantalla del torneo de baristas para proyectar: tabla estilo F1 de la ronda en curso y la final con podio. |
| `/admin/baristas` | Organización | Participantes, puntajes ronda por ronda y cierre de cada ronda (pasan 16, 6 y 2). |
| `/votar` | Visitante | Votación del stand más lindo (una vez por visitante). El ganador se ve en la app desde el domingo 4 a las 20 hs. |
| `/torneo` · `/torneo/[id]` | Visitante | Perfiles de los baristas, mensajes de aliento y voto al barista favorito (una vez por visitante). |
| `/mapa` | Público | Mapa del evento con zoom (`public/img/mapa.jpg`, sale de `docs/mapa/mapa-stands.pdf`). |
| `/baristas` | Barista | Ingreso con su clave: foto, historia, experiencia, hobby y por qué merece ganar; mensajes recibidos y la devolución del jurado. |
| `/jurado` | Jurados | Jurado 1, 2 y 3 entran con su clave y cargan su planilla de cada barista en la ronda en curso. |
| `/trabajo` | Público | **Banco de Trabajo AEHGA** (gastronomía y hotelería): portada, `/trabajo/vacantes`, `/trabajo/postulante` (carga y edición del CV, postulaciones) y `/trabajo/empresa` (registro, buscador de CVs por puesto, departamento, edad, experiencia, disponibilidad e idiomas; vacantes y postulantes). Administración lo ve en `/admin?tab=trabajo`. |
| `/vistapueblo` | Vistapueblo (demo) | **Gift cards de Vistapueblo**: backoffice en `/vistapueblo/admin` (resumen, métricas, nueva gift card, importar Excel, imprimir vouchers, lista, cuenta corriente por local y locales con su %, PIN y clave del panel); la tarjeta del cliente en `/vistapueblo/g/[token]` (QR que cambia cada 30 s); lo que abre la caja al escanear, `/vistapueblo/c/[clave]`; la caja de cada restaurante en `/vistapueblo/caja`, y el panel de cada local en `/vistapueblo/local`. |
| `/api/salud` | — | Healthcheck. |

## Variables de entorno

| Variable | Qué es | De dónde sale |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto | `https://ypyhinicminqjfpckxbj.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (anon) | Supabase → Project Settings → API Keys. Hoy la app no la usa para leer datos: con RLS, la anon key no ve nada. |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta del servidor | Supabase → Project Settings → API Keys → `service_role` (o una `sb_secret_…`). **Nunca** en el cliente ni en el repo. |
| `ADMIN_PASSWORD` | Contraseña de `/admin` | Elegila vos, larga. |
| `SESSION_SECRET` | Firma de las cookies (mín. 32 caracteres) | `openssl rand -base64 48` |
| `VISTAPUEBLO_PASSWORD` | (Opcional) contraseña de `/vistapueblo/admin` | Si no está, se usa `ADMIN_PASSWORD`. |

Las variables se leen **al arrancar**, no en el build: cambiar una en Easypanel solo requiere reiniciar la app.

## Deploy en Easypanel

1. En el proyecto `mmc`, crear un servicio **App**.
2. **Source:** GitHub → `gruposarasas/MMC`, rama `main`, build con **Dockerfile** (ruta `Dockerfile`).
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
- `votos_stand`, `votos_barista` (un voto por visitante: la clave primaria es el visitante) y `mensajes_barista`. Cierre de las votaciones: `VOTOS_CIERRE` en `src/lib/config.ts`.
- `jurados` (3 filas, con su clave) y `evaluaciones` (planilla de cada jurado por barista y ronda). Los ítems de la planilla están en `src/lib/planilla.ts`. Cuando los 3 completan la planilla de un barista, el puntaje de la ronda se calcula solo: promedio de los 3 menos `puntajes.descuento` (jueces fiscales), nunca menos de 1.
- `sortear()`: elige al azar entre todos los visitantes presentes (aunque hayan salido antes) y guarda el resultado en `ganadores`, como historial. El estado del sorteo (abierto o cerrado) está en la tabla `sorteo`, y la presencia en `visitantes.presente_at`.
- **Seguridad:** RLS activado en todas las tablas y sin políticas; permisos revocados a `anon` y `authenticated`, incluidas las funciones. Todo pasa por el servidor con la service role. El código de caja y la clave nunca llegan a las pantallas del visitante.
- Banco de trabajo (`20261112000001_banco_de_trabajo.sql`): `tb_postulantes`, `tb_empresas`, `tb_vacantes`, `tb_postulaciones` y `tb_vistas_cv` (qué empresa abrió qué CV). Postulantes y empresas entran con mail y clave (scrypt; no hay recuperación de clave por ahora). Los CV van al bucket **privado** `cvs` (PDF, JPG o PNG, hasta 5 MB) y se abren con links firmados de 2 minutos desde `/api/trabajo/cv/[id]`. Listas fijas (departamentos, puestos, disponibilidad, idiomas) en `src/lib/trabajo.ts`.
- Gift cards de Vistapueblo (`20261126000001_vistapueblo_giftcards.sql`): `vp_locales` (8 restaurantes, % que absorbe cada uno y PIN de 4 números para su caja, sorteado al crear la tabla: se ve en el backoffice, pestaña Locales), `vp_tarjetas` (monto, saldo, vencimiento, locales donde vale, token del QR y código `VP-XXXX-XXXX`) y `vp_consumos` (cada consumo con el % congelado y el reparto local / Vistapueblo). `vp_consumir()` valida y descuenta en una sola transacción con la fila bloqueada (consumo parcial, nunca más que el saldo); `vp_anular_consumo()` devuelve el monto. El envío es por links `wa.me` y `mailto:` (sin envío automático). La caja queda recordada en el celular con una cookie firmada (`local:versión del PIN`): un PIN nuevo cierra las cajas abiertas de ese local.
- Gift cards, segunda parte (`20261127000001_vistapueblo_v2.sql`):
  - **QR que cambia:** la tarjeta digital muestra un QR a `/vistapueblo/c/<N°>.<ventana>.<firma>` que cambia cada 30 segundos (vale hasta 90 s) y un número de 6 cifras para tipear si la cámara no lee. No lleva el token del link, así que una captura no sirve. El voucher impreso lleva un QR fijo (`/c/<N°>.p.<firma>`): el papel es el que vale. Las firmas son HMAC con `SESSION_SECRET`. Al escanear un QR válido, la caja recibe un permiso de cobro de 15 minutos para esa tarjeta.
  - **Cobro:** la caja carga el total del ticket y las personas de la mesa; la gift card paga hasta su saldo y el resto se paga aparte. `vp_consumos` guarda `ticket`, `personas` y `perdido`. Modo de uso por tarjeta (`vp_tarjetas.modo`): `saldo` (billetera, varias visitas) o `unico` (consumo total: se usa una vez y lo que sobra se pierde; anular el consumo lo devuelve).
  - **Aviso al cliente:** la tarjeta abierta consulta `/api/vp/vivo` cada 5 s y muestra el consumo al instante; además, el cliente puede activar notificaciones push (`vp_suscripciones`, librería `web-push`). Las claves VAPID se generan solas la primera vez y quedan en `vp_config`. En iPhone, las notificaciones solo funcionan si la tarjeta se agregó a la pantalla de inicio (cada tarjeta tiene su manifiesto).
  - **Panel del local** (`/vistapueblo/local`): entra con la clave de 8 caracteres de `vp_locales.clave` (se ve y se cambia en Locales). Ve sus métricas, el detalle y el Excel, solo de su local.
  - **Métricas:** por rango de fechas, mes o local; personas, mesas, consumido, venta total, % que absorben los locales y % de Vistapueblo, por día y por hora. Se bajan en Excel.
  - **Imprimir:** vouchers en hoja A4 (3 por hoja) o ticketera de 80 mm, con código y QR únicos; el nombre es opcional (queda una línea para escribirlo).
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
