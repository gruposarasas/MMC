# GM-CONTROL · Grupo Modesto

App de gestión de **Grupo Modesto** (fábrica mayorista de panificados, pastas y pastelería de Mendoza, con las marcas Modesto, Bastante y La Social): ventas, compras, gastos, sueldos, equipo, costos y KPI mensuales, con un cashflow permanente. Se carga a mano o con planillas, y de a poco se automatiza.

- **Producción:** https://gm.saraimagineers.com (equipo: https://gm.saraimagineers.com/mi). Dominio propuesto: confirmarlo antes del deploy.
- **Stack:** Next.js 15 (App Router, TypeScript) · Postgres en Supabase (proyecto propio, São Paulo) con `postgres` · Docker en Easypanel.
- **Diseño:** identidad de Grupo Modesto (del PDF de marca): marrón `#45302D`, crema `#F8F4EC`, topo `#9B837B` y terracota `#B4482E` de acento; Nunito Sans; el isotipo de curvas de nivel (`public/gm-crema.png`), el logo "Grupo Modesto · Donde nacen tres historias" (`public/img/grupo-modesto-*.png`), figuras de trazo por módulo y la guarda con las tres historias (Modesto, Bastante y La Social) en `public/img`.
- **Origen:** hecha a partir de BB-CONTROL (Bruno Brown), con el mismo código.

## Módulos y rutas

| Ruta | Quién | Qué |
|---|---|---|
| `/` | Todos | Elegir "Soy del equipo" o "Administración". Con sesión, va directo. |
| `/ingresar` | Administración | Ingreso con `ADMIN_PASSWORD`. |
| `/kpi` | Administración | Ventas − costos (compras) − gastos − sueldos = rentabilidad, con % sobre ventas, comparación con el mes anterior, "de cada $100", 12 meses, cashflow y acumulado, gastos por rubro y avisos (pagos que vencen, cumpleaños, pedidos del equipo, lo que falta cargar). Sin IVA o con IVA. Mes o año. |
| `/ventas` | Administración | Ventas del mes en curso (o el que elijas): con IVA, sin IVA, IVA, notas de crédito, por día. Filtros por cliente, comprobante y con/sin IVA. **Importar Excel de Contabilium** (o `.csv`) y carga a mano. |
| `/compras` | Administración | Mercadería. **Leer la factura con una foto o PDF** (completa todo el formulario) o cargarla **como una factura**: proveedor (de la lista), comprobante y varios productos, cada uno con cantidad, unidad, precio e IVA (autocompleta con lo ya comprado y con los insumos de Costos, y puede actualizar sus costos). También "solo el total". Pesos o dólares, pagado o a pagar con vencimiento. Por rubro, "qué se compró" y pendientes de pago. "Repetir" para cargar otra igual. **Importar Excel.** |
| `/gastos` | Administración | Igual que compras, para lo que no es mercadería: alquiler, servicios, impuestos, F.931, inversiones… **Importar Excel.** |
| `/proveedores` | Administración | Lista de proveedores de compras y gastos: CUIT, rubro habitual, contacto, teléfono, mail, CBU o alias. Cuánto se le compró en el año y link a sus comprobantes. Editar (el nombre cambia en todos sus comprobantes), desactivar, **unir repetidos** y **Importar Excel**. |
| `/sueldos` | Administración | Un renglón por persona y mes: bruto, neto, extras, adelantos a descontar, a pagar y pagado. "Armar sueldos" crea el mes con el sueldo de referencia de cada uno. |
| `/equipo` · `/equipo/[id]` | Administración | Fichas con todos los datos, cumpleaños (próximos y del año), vacaciones (días por antigüedad según la LCT), certificados médicos, uniforme, adelantos, sueldos y la clave de la app. Aprobar o rechazar los pedidos. |
| `/costos` · `/costos/[id]` | Administración | Ingeniería de costos: insumos (en pesos o dólares), receta de cada producto con merma, costos variables, margen, markup y precio sugerido. Dólar de referencia. |
| `/contabilidad` | Administración y contador | Obligaciones del mes de cada razón social (F.931, IVA e Ingresos Brutos): el contador carga monto, vencimiento, nota y archivos; administración las marca pagadas. Pestañas: **IVA estimado**, **Equipo** (ART o seguro y novedades del mes para sueldos) y **Accesos** (solo administración: claves del contador y razones sociales). |
| `/contador` | Contador | Ingreso del contador con su mail y su clave. Ve solo Contabilidad. |
| `/ajustes` | Administración | Rubros de compras y gastos (y su clase para el tablero), dólar y link de la app del equipo. |
| `/mi` | Equipo | App de cada persona (DNI + clave de 6 números): pedir vacaciones, adelantos y uniforme, mandar certificados (foto o PDF), ver sus sueldos y actualizar sus datos. Se puede agregar a la pantalla de inicio. |
| `/api/archivos/[id]` | Admin, dueño o contador | Certificados médicos (la persona que lo subió), fotos o PDF de facturas y archivos de contabilidad (también el contador). Excel, CSV, TXT y ZIP se descargan. |
| `/api/salud` | — | Healthcheck. |

## Cómo se calculan los números

- **Rentabilidad (KPI)** = ventas − compras − gastos − sueldos, **sin IVA** por defecto (el IVA no es ni ingreso ni costo). Se puede ver con IVA.
- **Ventas sin IVA** = neto (gravado + no gravado + exento). Las percepciones cobradas no son venta.
- **Compras y gastos sin IVA** = neto + percepciones/otros impuestos. Los importes en dólares se pasan a pesos con la cotización de cada comprobante.
- **Sueldos** = neto + extras de cada mes (el costo). Los adelantos son la misma plata pagada antes: se descuentan de "a pagar", no del costo. Las **cargas sociales (F.931)** van en Gastos, rubro de clase "cargas".
- **Cashflow** = ventas con IVA − compras y gastos con IVA − sueldos, por fecha del comprobante. Incluye inversiones.
- **No cargar el pago del saldo de IVA a ARCA como gasto**: el KPI ya trabaja sin IVA.

## Importar ventas de Contabilium

1. En Contabilium: Ventas → Comprobantes, filtrar el mes y exportar a Excel (`.xlsx`). Si sale `.xls`, guardarlo como `.xlsx`.
2. En `/ventas` → **Importar Excel**. La app busca sola la fila de títulos y reconoce las columnas (fecha, tipo, punto de venta, número, cliente, CUIT, neto gravado / no gravado / exento, IVA 21 / 10,5 / 27, percepciones, total, estado). Se pueden corregir a mano antes de importar.
3. Las notas de crédito restan, las anuladas y la fila de totales se saltean, y si el archivo trae una fila por producto se agrupan por comprobante.
4. Reimportar el mismo mes **no duplica**: actualiza por tipo + número de comprobante. Cada importación se puede deshacer.

También sirve el Excel de "Mis comprobantes" de ARCA.

## Contabilium (API)

Con plan Full o superior, Contabilium tiene API. En **Ajustes → Contabilium** se cargan el email de la API y la API Key (Contabilium → Mi cuenta → Configuración → API → Credenciales). Se guardan **cifradas** en la base (con `SESSION_SECRET`); también se pueden poner como variables `CONTABILIUM_EMAIL` y `CONTABILIUM_API_KEY`. "Guardar y probar" muestra tres ventas de ejemplo para compararlas con Contabilium.

- **Ventas:** botón **Traer de Contabilium** (trae el mes o el año que estás mirando) y, si está activado, **sincronización automática cada 6 horas** de los últimos 35 días. Usa `/api/comprobantes/search` en tramos de 7 días. Cuenta facturas, notas de débito y notas de crédito (en negativo); deja afuera cotizaciones, remitos y presupuestos. Neto e IVA salen de los renglones del comprobante; las percepciones son la diferencia con el total. Una factura que ya estaba importada por Excel se actualiza, no se duplica (misma clave tipo + número: "Factura A", "FCA" o "1 - Factura A" son lo mismo).
- **Productos:** en Costos, **Traer productos de Contabilium** crea o actualiza los productos con su rubro, precio sin IVA e IVA (`/api/conceptos/search`).
- Respeta el límite de pedidos de la API (~2 por segundo) y reintenta si Contabilium pide esperar.
- Para pruebas o para Chile/Uruguay, `CONTABILIUM_URL` cambia la dirección de la API (por defecto `https://rest.contabilium.com`).

## Proveedores

- En compras y gastos el proveedor **se elige de la lista** (buscando por nombre o CUIT). Si no está, **"+ Agregar proveedor nuevo"** lo suma a la lista al guardar (con CUIT opcional). Un nombre escrito sin elegirlo no se puede guardar. En compras es obligatorio; en gastos, opcional (por ejemplo, un impuesto).
- Al elegirlo se completa su **rubro habitual**.
- Un proveedor se reconoce por CUIT o por nombre, sin importar mayúsculas, acentos ni "S.A." o "SRL" al final. Al cambiarle el nombre o unir uno repetido, el nombre viejo queda guardado para reconocerlo en Excel viejos.
- Al importar compras o gastos desde Excel, los proveedores que no estaban se agregan solos a la lista (y si traen CUIT y el de la lista no tenía, se lo completa).
- Los proveedores que ya estaban escritos en compras y gastos pasaron a la lista automáticamente (`005_proveedores.sql`).

## Leer facturas con una foto

En **Nueva compra** o **Nuevo gasto**, el botón **Leer foto o PDF** (en el celular abre la cámara) lee el comprobante con Claude (la IA de Anthropic) y completa proveedor (lo busca en la lista por CUIT o nombre; si no está, queda como proveedor nuevo con su CUIT), comprobante, número, fecha, vencimiento de pago, moneda, renglones con cantidad, unidad, precio sin IVA y alícuota, percepciones y rubro. Muestra si el total cargado **coincide con el de la factura** y avisa lo que no se pudo leer bien. Nada se guarda hasta tocar **Guardar**.

- La foto o el PDF quedan guardados con el comprobante (link **Factura** en la lista). También se puede adjuntar a mano al cargar o editar.
- Necesita la variable `ANTHROPIC_API_KEY` (se saca en console.anthropic.com → API Keys, con crédito cargado). Cuesta alrededor de **US$ 0,03 a 0,10 por factura** (más si es un PDF de varias páginas).
- Si el pedido fuera rechazado por los filtros de seguridad del modelo, la API reintenta sola con el modelo alternativo recomendado (`fallbacks: "default"`).
- Las facturas B, C y los tickets se cargan con el precio final (sin IVA discriminado). Las notas de crédito restan.

## Contabilidad (el contador)

- **Acceso:** en Contabilidad → Accesos, administración pone el nombre y el mail del contador (o de cada persona del estudio) y genera una **clave** (se muestra una sola vez, con botones para mandarla por mail o copiarla). El contador entra en `/contador`. Ve solo Contabilidad. "Nueva clave" corta las sesiones abiertas; "Quitar acceso" lo deja afuera.
- **Obligaciones del mes:** por cada razón social, F.931 (cargas sociales), IVA e Ingresos Brutos. Abre en el **mes a liquidar** (el anterior). El contador carga monto, vencimiento y nota y sube archivos (PDF, Excel, CSV, TXT, ZIP o fotos, hasta 8 MB; se revisa el contenido, no solo la extensión). Estados: sin cargar, a pagar, vencida (en rojo) y pagada.
- **Solo administración marca pagado.** Lo pagado no se cambia (ni sus archivos): primero hay que deshacer el pago. Todo queda en el **historial** de cada obligación (quién cargó, cambió, subió o pagó).
- **F.931 e Ingresos Brutos pasan solos a Gastos** como un gasto del mes liquidado (rubros de clase "cargas" e "impuestos", proveedor ARCA o ATM Mendoza), a pagar con su vencimiento: entran en el KPI y en "Pagos que vencen". Si el contador cambia el monto, el gasto se actualiza; pagarlo en Gastos o en Contabilidad lo marca pagado en los dos lados. **No cargues el F.931 a mano en Gastos** para no duplicarlo.
- **El IVA no va a Gastos** (el KPI es sin IVA), pero su vencimiento aparece en "Pagos que vencen" del KPI.
- **IVA estimado:** IVA de las ventas (débito) menos IVA de compras y gastos (crédito) de cada mes, contra lo que declaró el contador; últimos 6 meses. Las percepciones de las facturas de compra se muestran aparte (no se restan: están juntas las de IVA y las de IIBB).
- **Equipo:** ART o seguro de cada persona (lo elige administración; el contador lo ve) y las **novedades del mes** para liquidar sueldos: altas, bajas, vacaciones aprobadas y licencias médicas (días que caen en el mes) y adelantos a descontar. No muestra el motivo de los certificados.
- **Razones sociales:** arranca con "Grupo Modesto" (sin CUIT); se le carga el CUIT y se agregan las demás (fábrica, franquicias, cada marca) en Accesos.

## Importar compras, gastos, productos, insumos y proveedores

En Compras, Gastos, Proveedores y Costos hay un botón **Importar** con una **planilla modelo** para bajar. Igual que en Ventas, la app reconoce las columnas solas y se pueden corregir antes de importar.

- **Compras y gastos:** una fila por producto (las filas con el mismo número de comprobante forman una factura; sin número, las filas seguidas del mismo día y proveedor) o una fila por comprobante con sus totales (como el Excel de comprobantes recibidos de Contabilium o de ARCA). El rubro se busca por nombre; si no existe va al que elijas. Las notas de crédito restan, las anuladas y la fila de totales se saltean. Reimportar no duplica. Cada importación se puede deshacer.
- **Productos (Costos):** nombre, presentación, categoría, precio sin IVA o precio final con IVA, IVA, costos variables y margen. Si ya existe (mismo nombre y presentación) se actualiza.
- **Insumos (Costos):** nombre, categoría, unidad, moneda (pesos o dólares) y costo sin IVA. Si ya existe se actualiza el costo.
- **Proveedores:** nombre, CUIT, rubro, contacto, teléfono, mail, CBU o alias y notas. Si ya existe (mismo CUIT o mismo nombre) se completan o actualizan sus datos; lo que viene vacío no borra nada.

## Variables de entorno

| Variable | Qué es |
|---|---|
| `DATABASE_URL` | Conexión a Postgres. En Supabase: Project Settings → Database → Connection string → **Session pooler** (puerto 5432), con `?sslmode=require` al final. |
| `ADMIN_PASSWORD` | Contraseña del panel de administración. Larga. |
| `CONTABILIUM_EMAIL`, `CONTABILIUM_API_KEY` | Opcionales: credenciales de la API de Contabilium (si no, se cargan en Ajustes). |
| `ANTHROPIC_API_KEY` | Para leer facturas con una foto. Sin ella, todo lo demás funciona y el botón avisa que falta. |
| `SESSION_SECRET` | Firma de las cookies, 32 caracteres o más: `openssl rand -base64 48`. |

## Base de datos

- Migraciones en `db/migraciones/*.sql`. **Se aplican solas al arrancar el contenedor** (`scripts/migrar.mjs`, que anota cada una en la tabla `_migraciones`); también con `npm run migrar`.
- Tablas: `ventas`, `importaciones`, `egresos` (compras y gastos, columna `tipo`), `egreso_items` (renglones de cada factura), `proveedores` (el nombre de cada comprobante se copia de acá con un trigger), `lecturas_factura` (lo leído de una foto hasta que se guarda; se limpia a los 7 días), `razones_sociales`, `contadores`, `contab_obligaciones`, `contab_archivos`, `contab_historial`, `rubros`, `sueldos`, `empleados`, `vacaciones`, `certificados`, `archivos`, `uniformes`, `adelantos`, `insumos`, `productos`, `receta`, `ajustes`.
- Todo el acceso es desde el servidor. En Supabase, RLS queda activado sin políticas y `anon`/`authenticated` no tienen permisos (`002_permisos_supabase.sql`): la API pública no ve nada. El aviso "RLS Enabled No Policy" del panel es esperado.
- Los certificados médicos y las fotos de facturas se guardan en la base (fotos achicadas en el celular, PDF hasta 8 MB).

## Deploy en Easypanel

1. **Base:** un proyecto de Supabase (São Paulo). Las migraciones se aplican solas al arrancar el contenedor.
2. En un proyecto de Easypanel, un servicio **App**.
3. **Source:** GitHub, el repo y la rama, build con **Dockerfile**. **Build path `/gm-control`** mientras la app viva en esa carpeta del repo MMC (`/` si se pasa a un repo propio).
4. **Environment:** las tres variables de arriba. `DATABASE_URL` se copia de Supabase → **Connect** → **Session pooler** (usuario `postgres.<ref-del-proyecto>`, puerto 5432), con la contraseña de la base y `?sslmode=require` al final.
5. **Domains:** `gm.saraimagineers.com` → puerto **80**, HTTPS (Let's Encrypt). Easypanel le pasa `PORT=80` al contenedor.
6. Deploy. En los logs: `[migrar] base al día` y `Ready`. `https://gm.saraimagineers.com/api/salud` responde `{"ok":true}`.
7. Entrar a `/ingresar`, cargar el dólar y el equipo, y generar la clave de cada persona en su ficha (el botón "Mandar por WhatsApp" arma el mensaje con el link a `/mi`).

La app corre en **un solo contenedor**: los límites de intentos de ingreso se guardan en memoria.

## Desarrollo

```bash
npm install
cp .env.example .env.local   # completar
npm run migrar
npm run dev
```

`npm run lint` corre el chequeo de tipos.

## Próximos pasos (automatizar de a poco)

- Compras desde Contabilium, cuando su API publique los comprobantes de compra.
- Cargar compras desde las facturas recibidas (ARCA / Contabilium).
- Avisos por WhatsApp: cumpleaños, pedidos aprobados, vencimientos.
- Cashflow por fecha de cobro y de pago, con saldo de bancos.
