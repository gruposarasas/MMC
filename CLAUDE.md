# Mundial de Café: app de beneficios — brief de construcción

> **Aclaraciones vigentes (pisan lo que dice el brief):**
> - El dominio de producción es **https://mmc.saraimagineers.com** (no `mundial.brunobrown.cafe`). Es el que va en el QR de los carteles y en el link del panel de marca.
> - El repositorio y el proyecto de Supabase se llaman **MMC** (no `mundial-cafe`). El proyecto de Easypanel se llama **`mmc`**.
> - **El beneficio y las condiciones los elige cada marca** desde su panel (`/marca`). Al tocar "Enviar cupón" se publica y queda de solo lectura; solo administración lo puede editar, ocultar, eliminar o reabrir. Los créditos por visitante y el código de caja los sigue definiendo administración.
> - La app se puede agregar a la pantalla de inicio (manifiesto e íconos). La billetera invita a hacerlo.
> - **Sorteo de la camiseta de Enzo:** aviso en el registro y tarjeta en la billetera. Al público se le dice "Sorteo: domingo 4 de octubre, 18 hs" y "Poné presente a partir de las 18 hs". Internamente, "Estoy presente" solo funciona el **domingo 4 de octubre de 18 a 20 hs (Mendoza)**, validado en el servidor (`SORTEO_DESDE`/`SORTEO_HASTA` en `src/lib/config.ts`); el cierre de las 20 no se muestra al público. **`/sorteo`** es la pantalla para proyectar (pide la contraseña de administración): nombres en vivo, "Modo prueba" para ensayar fuera de horario y SORTEAR con una ruleta de casino de hasta 50 casilleros. El ganador lo elige el servidor (`sortear()`) entre **todos** los presentes (la rueda muestra hasta 50). Quien puso presente participa de **todos** los sorteos, aunque haya salido antes (si el ganador no aparece, se vuelve a sortear con los mismos); `ganadores` es solo historial. Leyenda: "* Para ganar el premio hay que presentar el DNI". En `/admin/carteles` hay un cartel blanco y rojo de la camiseta con el mismo QR.
> - **Torneo de baristas (por rondas de puntaje):** Ronda 1 (sábado 3, los 31 inscriptos, pasan 16) → Ronda 2 (domingo a la mañana, pasan 6) → Ronda 3 (domingo a la tarde, pasan 2; el 3° y 4° de esta ronda son 3° y 4° puesto) → Final 1 vs 1 (domingo 18:30). Se compite de a 3 mesas, turnos de 30 min; puntaje de 1 a 9 con un decimal y cada ronda arranca de cero. Empates: pasa el de mejor puntaje en el espresso (`puntajes.espresso`); si también empatan, decide el jurado (`puntajes.desempate`). Los horarios de la Ronda 1 salen del Excel (`docs/torneo/fuente/cronograma-original.xlsx`) y están en `baristas.turno`; los de las rondas 2, 3 y la final dependen del puesto (`TURNOS` en `src/lib/rondas.ts`). `/competencia` es la pantalla pública para proyectar (y para seguir en vivo desde la billetera) (tabla estilo F1 de la ronda en curso y la final con podio); `/admin/baristas` carga puntajes ronda por ronda y "Cerrar ronda" pasa a los mejores. Tablas `baristas`, `puntajes` (por ronda) y `torneo`. PDF para los baristas en `docs/torneo/`.
> - **Votaciones del público:** en la billetera hay accesos a "Stand más lindo" (`/votar`, solo las marcas con `en_votacion`, que se marca al editar la marca en Beneficios), "Baristas" (`/torneo`: perfiles, mensajes de aliento y barista favorito) y "Mapa" (`/mapa`). Cada visitante vota una sola vez en cada una, hasta el **domingo 4 a las 20 hs** (`VOTOS_CIERRE`); desde ese momento los ganadores se ven en la app. Administración ve todo en `/admin?tab=votos` y puede ocultar mensajes.
> - **Baristas y jurados:** cada barista tiene su clave y completa su perfil en `/baristas`, donde ve los mensajes y la devolución del jurado. Hay 3 jurados (`/jurado`), que se muestran siempre como "Jurado 1, 2 y 3", sin nombres. La planilla está en `src/lib/planilla.ts` (**provisoria** hasta que llegue la oficial). Las claves de baristas y jurados se generan en `/admin/baristas`.
> - Estado y detalles técnicos: ver `README.md`.

App web para el **Mundial de Café by Bruno Brown**. El evento es en Bodega Arizu, Mendoza, el **sábado 3 y el domingo 4 de octubre de 2026**, con entrada libre.

Los visitantes escanean un QR fijo, se registran y reciben una billetera con cupones de descuento de las marcas presentes. Los cupones se usan en los stands y, si la marca lo habilita, después del evento en sus sucursales.

- **Dominio de producción:** **https://mundial.brunobrown.cafe**. El registro A apunta a 179.198.108.200, el servidor de Easypanel.
- **Plazo:** tiene que estar en producción y probada el **jueves 1 de octubre**. Priorizá que funcione bien en celulares por sobre cualquier extra.
- **Idioma:** español rioplatense con voseo.
- **Zona horaria:** `America/Argentina/Mendoza`.

---

## 0. Cómo usar este documento

- `referencia/prototipo-mundial.html` es el **prototipo aprobado por el dueño**. Es la fuente de verdad del diseño, los textos, los flujos y los datos iniciales, incluidos los logos de las 34 marcas, que están embebidos en el archivo (`LOGOS`). Abrilo en el navegador y recorré los cuatro modos: Visitante, Marca, Back office y Carteles.
- El prototipo guarda todo en `localStorage`. **La versión real usa Supabase** como base compartida, y toda regla de créditos se valida en el servidor.
- Antes de construir, proponé el plan y el modelo de datos, y esperá el OK.

---

## 1. Stack

- Next.js (App Router) con TypeScript. Es web mobile-first, **no** hace falta instalarla.
- **Supabase** en un proyecto propio, `mundial-cafe`, en São Paulo, separado del de Sara App.
  - Postgres con RLS.
  - Storage para los logos de las marcas.
- **Deploy:** Dockerfile, con una app en **Easypanel** (proyecto nuevo `mundial`) desde este repositorio, rama `main`. Dominio `mundial.brunobrown.cafe` con HTTPS de Let's Encrypt.
- **Variables:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD` y `SESSION_SECRET`. Documentalas en el README.
- Sin envío de mails ni WhatsApp en esta versión, y sin servicios pagos adicionales.

---

## 2. Rutas

| Ruta | Quién | Qué |
|---|---|---|
| `/` | Visitante | Registro. Si ya tiene sesión en ese celular, va directo a su billetera. |
| `/recuperar` | Visitante | Entrar con el mail o el WhatsApp con que se registró. |
| `/billetera` | Visitante | Sus cupones y su historial de canjes. |
| `/canjear/[marca]` | Visitante | Teclado para el código de 4 números y pantalla de "Canje válido". |
| `/marca` | Marca | Ingreso con su clave y panel de su cupón. |
| `/admin` | Organización | Back office protegido con contraseña (`ADMIN_PASSWORD`). |
| `/admin/carteles` | Organización | Cartel con el QR a `https://mundial.brunobrown.cafe` y tarjetas de caja por marca, listos para imprimir. |

**Sesión del visitante:** cookie firmada de larga duración, 1 año, con su id. Sin contraseña.

---

## 3. Reglas de negocio

### 3.1 Registro del visitante

- **Datos:**
  - nombre y apellido (al menos dos palabras, solo letras);
  - fecha de nacimiento (día, mes y año con selectores; tiene que existir y ser de 13 años o más);
  - **mail o WhatsApp**: se elige uno, con un selector Mail/WhatsApp;
  - aceptación obligatoria del uso de datos;
  - casilla opcional de novedades, tildada por defecto.
- **Validaciones:**
  - mail con formato válido;
  - WhatsApp con 10 u 11 dígitos, que se guarda solo con los números.
- **No hay verificación por código.**
- **Contacto repetido:** si el mail o el WhatsApp ya existe, se recupera esa billetera y no se crea otra.
- **Textos, tal cual están en el prototipo:**
  - "¿Dónde querés recibir tus cupones?"
  - "Tus cupones quedan guardados con este mail: con él los recuperás desde cualquier celular y te avisamos antes de su vencimiento."
  - Botón "Recibir mis cupones".

### 3.2 Billetera

- **Qué muestra:** un cupón por marca **activa, no eliminada y con beneficio cargado**. Cada cupón tiene:
  - logo (o figura, si no tiene logo), marca y stand;
  - beneficio y condiciones;
  - vencimiento ("Válido durante el Mundial" o "Vence el dd/mm/aaaa");
  - sucursales, si corresponde;
  - créditos restantes, como granos llenos o vacíos.
- **Guardado:** arriba se ve "Tus cupones están guardados con tu mail…".

### 3.3 Canje (lo más importante)

1. El visitante toca **Usar** en un cupón.
2. El cajero le dice el **código de caja** de su marca, de 4 números.
3. El visitante lo escribe en **su** celular.
4. El **servidor**, en una función de Postgres transaccional, valida todo en una sola operación: marca activa, no vencida, código correcto y créditos disponibles. Si está todo bien, registra el canje. Nunca se puede superar la cantidad de créditos, ni siquiera con dos pedidos simultáneos.
5. **Intentos fallidos:** con 3 errores seguidos para esa marca, queda bloqueado 60 segundos.
6. **Pantalla "Canje válido":** fondo bordó, estrella girando, marca, beneficio, **nombre del visitante**, **hora con segundos en movimiento** y número de canje correlativo. El cajero la mira: si la hora está quieta, es una captura de pantalla.

Que un visitante sepa el código no es un riesgo aceptado como problema: solo podría gastar sus propios créditos.

Un canje hecho después del 4 de octubre se marca como `post_evento = true`.

### 3.4 Marcas

- **Datos de cada marca:**
  - nombre, stand;
  - beneficio (corto) y condiciones;
  - créditos por visitante (1 a 10);
  - código de caja (4 dígitos, único entre marcas);
  - clave de acceso al panel (única);
  - logo, y figura si no tiene logo;
  - activa, vence (fecha, mínimo el 4 de octubre) y sucursales (texto);
  - responsable y WhatsApp del responsable;
  - `enviado` (fecha) y `eliminado`.
- **Panel de la marca (`/marca`, con su clave):**
  - ve sus canjes, separados en durante el Mundial y en sucursales después;
  - completa **una sola vez** su logo, el vencimiento y las sucursales, y toca **"Enviar cupón"**, con confirmación;
  - después de enviarlo queda **solo lectura**, y solo administración lo puede editar, eliminar o reabrir;
  - el beneficio, los créditos y el código los define administración.

### 3.5 Back office (organización)

- **Resumen:**
  - visitantes registrados;
  - beneficios usados;
  - % de visitantes que usó al menos uno;
  - canjes en sucursales después del Mundial;
  - ranking de canjes por marca.
- **Beneficios:**
  - tabla de accesos con logo, marca, stand, clave, beneficio y estado del envío;
  - botón "Crear marca", que genera la clave y el código;
  - en cada marca: editar todo, cambiar el código, nueva clave, "Copiar acceso" (link y clave), "Mandar por WhatsApp" (`wa.me` con el mensaje armado), "Dejar que la marca lo cambie" y eliminar.
  - Eliminar oculta el cupón a los visitantes y conserva los canjes.
- **Visitantes:** buscador y botón "Copiar para Sheets", que copia la tabla separada por tabulaciones. Agregar además una **descarga en CSV**.
- **Canjes:** lista con número, día y hora, marca, beneficio y visitante, filtrable por marca.

### 3.6 Datos iniciales

Cargar las **34 marcas** del prototipo (`semilla()` y `LOGOS`) con sus stands, claves y códigos. Los logos van a Supabase Storage.
- Todas empiezan **sin beneficio y ocultas**, salvo Shelby, que tiene "2x1 en café" con 2 créditos. Administración completa el resto desde el back office.
- Los visitantes y los canjes de ejemplo del prototipo **no** se cargan.

---

## 4. Diseño

Seguir el prototipo exactamente.

- **Tipografía:** Poppins.
- **Colores:** ciruela `#281722`, bordó `#8E3949`, arena `#C2A27B`, crema `#F3E9DC`.
- **Recursos gráficos:** los logos y las figuras del Mundial están embebidos en el prototipo (`A`): logo claro, guarda y figuras geométricas.
- **Cupón:** tipo ticket, con muescas.
- **Pantalla de canje:** bordó a pantalla completa.
- **Accesibilidad:** foco visible y `prefers-reduced-motion` respetado.

---

## 5. Seguridad y datos

- **RLS:**
  - el visitante solo lee sus propios datos y canjes;
  - las marcas y administración operan a través de rutas del servidor con la service role;
  - nunca exponer el código de caja ni la clave al cliente del visitante.
- **Límites de uso** en el registro y el canje.
- **Datos personales:** el texto de aceptación ya está en el prototipo, por la Ley 25.326.

---

## 6. Después del evento (no es para el 3 de octubre)

- Exportación diaria de visitantes a Google Sheets con n8n.
- Aviso por mail o WhatsApp, días antes, a quienes tengan cupones sin usar próximos a vencer.

---

## 7. Orden de trabajo

1. Proyecto base, Supabase (tablas, funciones y RLS), semilla de marcas y Dockerfile.
2. Registro, billetera y canje. Es lo crítico: probarlo con varios celulares a la vez.
3. Back office y panel de marca.
4. Carteles para imprimir.
5. Deploy en Easypanel y prueba de punta a punta en `mundial.brunobrown.cafe`.
