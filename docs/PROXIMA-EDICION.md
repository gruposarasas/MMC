# Cómo volver a armar la app para la próxima edición

Guía para reutilizar la app del **Mundial de Café by Bruno Brown** en la 5ta edición o siguientes. La app de la 4ta edición (3 y 4 de octubre de 2026, Bodega Arizu) quedó guardada tal cual en el repositorio con la etiqueta de git **`edicion-2026`**. El informe con todos los resultados está en `docs/difusion/Mundial de Cafe - Informe de la app 4ta edicion.pdf`.

> **Para hacerlo con Claude:** abrí una sesión de Claude Code sobre este repositorio y decile:
> *"Leé docs/PROXIMA-EDICION.md y prepará la app para el Mundial de Café [año], que es el [días] en [lugar]."*
> Con este archivo, `CLAUDE.md` y `README.md` tiene todo lo que necesita.

---

## Qué hay hoy

| Parte | Dónde |
|---|---|
| Código (Next.js 15 + TypeScript) | Repositorio `gruposarasas/MMC`, rama `main` |
| Base de datos y logos | Supabase, proyecto **MMC** (`ypyhinicminqjfpckxbj`, São Paulo) |
| Servidor | Easypanel, proyecto **`mmc`**, app desde la rama `main` con el `Dockerfile` |
| Dominio | `https://mmc.saraimagineers.com` (registro A `mmc` en GoDaddy → servidor de Easypanel) |
| Diseño, textos y flujos | `referencia/prototipo-mundial.html` y `CLAUDE.md` |
| Detalles técnicos | `README.md` (rutas, variables, base de datos, deploy) |
| Material impreso y de difusión | `docs/` (manuales, reglamento, carteles, cronogramas, resumen) |

**Funciones de la app:** registro y billetera de cupones, canje con código de caja, panel de cada marca, back office, carteles para imprimir, sorteo con ruleta (`/sorteo`), votación del stand más lindo y del barista favorito, mensajes de aliento, mapa, torneo de baristas con 3 jurados y pantalla en vivo (`/competencia`).

---

## Paso a paso

### 1. Guardar la edición anterior (antes de tocar nada)

1. **Visitantes:** en `/admin` → Visitantes → **Descargar CSV**. Guardá el archivo en un lugar seguro: tiene datos personales (Ley 25.326), no lo subas al repositorio.
2. **Base completa:** en Supabase → Database → Backups, o con la CLI: `supabase db dump --data-only -f respaldo-2026.sql` (pide la contraseña de la base).
3. El código ya queda guardado en la etiqueta `edicion-2026`. Para volver a esa versión: `git checkout edicion-2026`.

### 2. Decidir dónde corre

- **Opción A (recomendada): el mismo proyecto.** Se reutiliza Supabase, Easypanel y el dominio. Solo hay que limpiar la base (paso 3) y cambiar fechas y textos (paso 4).
- **Opción B: un proyecto nuevo** (por ejemplo, si cambia el organizador o el dominio):
  1. Crear un proyecto de Supabase en São Paulo.
  2. Aplicar en orden todas las migraciones de `supabase/migrations/` y después `supabase/seed.sql` (las 34 marcas del prototipo).
  3. Crear la app en Easypanel como dice el `README.md` (sección "Deploy en Easypanel") con las 5 variables de entorno.
  4. Apuntar el dominio nuevo y cambiar `URL_PUBLICA` en `src/lib/config.ts` (es la dirección que va en el QR).

### 3. Limpiar la base (opción A)

El archivo `supabase/nueva-edicion.sql` deja la base lista para el año nuevo en una sola transacción:

- cambia la fecha de fin del evento en la base (vencimiento mínimo de los cupones y canjes "post evento");
- borra canjes, votos, mensajes, sorteos y el torneo (baristas, puntajes y planillas de los jurados);
- deja las marcas cargadas pero sin cupón, ocultas, fuera de la votación y con códigos de caja nuevos;
- invalida las claves de los jurados;
- conserva o borra a los visitantes, según lo que elijas.

Antes de correrlo: reemplazá `2027-10-03` por el último día del evento nuevo y elegí la opción de visitantes. Se corre en Supabase → SQL Editor. Se probó sobre la base de prueba local (con vuelta atrás) y funciona.

### 4. Cambiar fechas y textos en el código

Todo lo que depende de la edición está en pocos archivos:

| Archivo | Qué cambiar |
|---|---|
| `src/lib/config.ts` | `EVENTO_FIN` (último día), `SORTEO_DESDE` / `SORTEO_HASTA` (ventana de "Estoy presente"), `SORTEO_TEXTO`, `VOTOS_CIERRE` y `VOTOS_TEXTO`. |
| `src/lib/rondas.ts` | `RONDAS` (días de cada ronda y cuántos pasan) y `TURNOS` (horarios y mesas de las rondas 2, 3 y la final). |
| `src/lib/planilla.ts` | Ítems que puntúa cada jurado en cada ronda, escala y ficha técnica. |
| `src/components/SorteoVisitante.tsx`, `src/components/admin/PantallaSorteo.tsx`, `src/app/admin/carteles/page.tsx`, `src/components/Camiseta.tsx` | Premio del sorteo (este año, la camiseta de Enzo). |
| `src/components/PanelMarca.tsx`, `src/components/admin/Marcas.tsx`, `src/lib/admin.ts`, `src/app/api/marca/enviar/route.ts`, `src/components/CamposCupon.tsx` | Textos "4 de octubre" del vencimiento mínimo. |
| `src/app/api/sorteo/presente/route.ts`, `src/app/admin/page.tsx`, `src/app/api/votar/route.ts` | Textos con "domingo 4". |
| `public/img/mapa.jpg` y `docs/mapa/` | Mapa de stands del nuevo evento. |
| `src/app/layout.tsx` y `src/app/manifest.ts` | Nombre y descripción de la app, si cambian. |
| `README.md` y `CLAUDE.md` | Fechas, lugar y aclaraciones de la edición nueva. |

Para encontrar cualquier fecha que quede: `grep -rn "2026\|octubre\|domingo 4\|sábado 3" src`.

Después de cambiar el código: `npm run lint` (chequeo de tipos), commit y push a `main`, y en Easypanel tocar **Implementar**.

### 5. Cargar la edición nueva

1. **Marcas:** en `/admin` → Beneficios, editar o crear las marcas, marcar las que entran a la votación del stand y generar una **Nueva clave** para cada una. Mandarles el acceso con "Mandar por WhatsApp". Cada marca carga su beneficio, condiciones y usos desde `/marca` y toca "Enviar cupón".
2. **Baristas:** en `/admin/baristas`, pegar la lista de participantes con su turno de la Ronda 1, generar las claves de los baristas y de los 3 jurados y repartirlas. Los baristas completan su perfil en `/baristas`.
3. **Carteles:** imprimir desde `/admin/carteles` el cartel con el QR, las tarjetas de caja de cada marca y el cartel del sorteo.
4. **Prueba:** registrarse desde varios celulares, canjear un cupón, votar, poner presente con el "Modo prueba" de `/sorteo` y cargar una planilla de jurado. Después, volver a limpiar con el paso 3 lo que haya quedado de la prueba.

### 6. Durante el evento

- `/admin` para seguir registros y canjes en vivo.
- `/competencia` proyectada para el torneo; "Cerrar ronda" en `/admin/baristas` pasa a los mejores a la siguiente.
- `/sorteo` proyectada en el horario del sorteo.

---

## Variables de entorno (Easypanel)

| Variable | Qué es |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta del servidor (nunca en el repositorio) |
| `ADMIN_PASSWORD` | Contraseña de `/admin` y `/sorteo`; conviene cambiarla cada edición |
| `SESSION_SECRET` | Firma de las sesiones (`openssl rand -base64 48`). Si se cambia, se cierran todas las sesiones abiertas |

---

## Lo que aprendimos en 2026

- **2.556 personas** se registraron. 588 lo hicieron antes del evento, con el QR difundido en redes. Los picos fueron de 17 a 19 hs los dos días.
- **284 canjes** en 13 marcas. Las marcas que cargaron un beneficio simple y visible (Pato Coffee, Chiamo, Macanudo) concentraron el 68% de los canjes. Conviene que todas las marcas publiquen su cupón antes del evento: este año 18 de 37 no lo hicieron.
- **No hubo canjes en sucursales** después del evento. Para que sirva, hay que comunicarlo mejor o dar más plazo.
- **Las votaciones funcionaron muy bien:** 1.124 votos al barista favorito y 1.204 mensajes de aliento. Los baristas difundieron su perfil.
- **Torneo:** 30 baristas en la app, 3 jurados con planilla digital y puntaje automático. La ficha técnica la carga el Jurado 2. Los empates se resolvieron por el espresso.
- **Sorteo:** 400 personas pusieron "Estoy presente". La ruleta proyectada y la regla de mostrar el DNI funcionaron bien.
- La app corre en un solo contenedor y los límites de uso están en memoria. Con el volumen de 2026 alcanzó de sobra.
