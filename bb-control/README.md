# BB-CONTROL · Bruno Brown

App de gestión de **Bruno Brown** (importadora de café): ventas, compras, gastos, sueldos, equipo, costos y KPI mensuales, con un cashflow permanente. Se carga a mano o con planillas, y de a poco se automatiza.

- **Producción:** https://bb.saraimagineers.com (equipo: https://bb.saraimagineers.com/mi)
- **Stack:** Next.js 15 (App Router, TypeScript) · Postgres en Supabase (proyecto `BB-CONTROL`, ref `lojzzhmlsocbamejedxy`, São Paulo) con `postgres` · Docker en Easypanel (proyecto `bb`).
- **Diseño:** identidad de Bruno Brown y de la app del Mundial de Café: ciruela `#281722`, bordó `#8E3949`, arena `#C2A27B`, crema `#F3E9DC`, Poppins, la "B", las figuras geométricas y la guarda (`public/img`).
- Vive en la carpeta `bb-control/` del repo de MMC. Es una app aparte: su propio `package.json`, `Dockerfile` y base.

## Módulos y rutas

| Ruta | Quién | Qué |
|---|---|---|
| `/` | Todos | Elegir "Soy del equipo" o "Administración". Con sesión, va directo. |
| `/ingresar` | Administración | Ingreso con `ADMIN_PASSWORD`. |
| `/kpi` | Administración | Ventas − costos (compras) − gastos − sueldos = rentabilidad, con % sobre ventas, comparación con el mes anterior, "de cada $100", 12 meses, cashflow y acumulado, gastos por rubro y avisos (pagos que vencen, cumpleaños, pedidos del equipo, lo que falta cargar). Sin IVA o con IVA. Mes o año. |
| `/ventas` | Administración | Ventas del mes en curso (o el que elijas): con IVA, sin IVA, IVA, notas de crédito, por día. Filtros por cliente, comprobante y con/sin IVA. **Importar Excel de Contabilium** (o `.csv`) y carga a mano. |
| `/compras` | Administración | Mercadería: fecha, rubro, proveedor, comprobante, cantidad, neto, IVA, percepciones, total, pesos o dólares, pagado o a pagar con vencimiento. Por rubro y pendientes de pago. "Repetir" para cargar otra igual. |
| `/gastos` | Administración | Igual que compras, para lo que no es mercadería: alquiler, servicios, impuestos, F.931, inversiones… |
| `/sueldos` | Administración | Un renglón por persona y mes: bruto, neto, extras, adelantos a descontar, a pagar y pagado. "Armar sueldos" crea el mes con el sueldo de referencia de cada uno. |
| `/equipo` · `/equipo/[id]` | Administración | Fichas con todos los datos, cumpleaños (próximos y del año), vacaciones (días por antigüedad según la LCT), certificados médicos, uniforme, adelantos, sueldos y la clave de la app. Aprobar o rechazar los pedidos. |
| `/costos` · `/costos/[id]` | Administración | Ingeniería de costos: insumos (en pesos o dólares), receta de cada producto con merma, costos variables, margen, markup y precio sugerido. Dólar de referencia. |
| `/ajustes` | Administración | Rubros de compras y gastos (y su clase para el tablero), dólar y link de la app del equipo. |
| `/mi` | Equipo | App de cada persona (DNI + clave de 6 números): pedir vacaciones, adelantos y uniforme, mandar certificados (foto o PDF), ver sus sueldos y actualizar sus datos. Se puede agregar a la pantalla de inicio. |
| `/api/archivos/[id]` | Admin o dueño | Certificados médicos. |
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

## Variables de entorno

| Variable | Qué es |
|---|---|
| `DATABASE_URL` | Conexión a Postgres. En Supabase: Project Settings → Database → Connection string → **Session pooler** (puerto 5432), con `?sslmode=require` al final. |
| `ADMIN_PASSWORD` | Contraseña del panel de administración. Larga. |
| `SESSION_SECRET` | Firma de las cookies, 32 caracteres o más: `openssl rand -base64 48`. |

## Base de datos

- Migraciones en `db/migraciones/*.sql`. **Se aplican solas al arrancar el contenedor** (`scripts/migrar.mjs`, que anota cada una en la tabla `_migraciones`); también con `npm run migrar`.
- Tablas: `ventas`, `importaciones`, `egresos` (compras y gastos, columna `tipo`), `rubros`, `sueldos`, `empleados`, `vacaciones`, `certificados`, `archivos`, `uniformes`, `adelantos`, `insumos`, `productos`, `receta`, `ajustes`.
- Todo el acceso es desde el servidor. En Supabase, RLS queda activado sin políticas y `anon`/`authenticated` no tienen permisos (`002_permisos_supabase.sql`): la API pública no ve nada. El aviso "RLS Enabled No Policy" del panel es esperado.
- Los certificados médicos se guardan en la base (fotos achicadas en el celular, PDF hasta 8 MB).

## Deploy en Easypanel

1. **Base:** proyecto `BB-CONTROL` de Supabase (SARA GROUP, São Paulo). Las migraciones `001` y `002` ya están aplicadas.
2. En el proyecto `bb` de Easypanel, un servicio **App**.
3. **Source:** GitHub `gruposarasas/MMC`, la rama, **Build path `/bb-control`**, build con **Dockerfile**.
4. **Environment:** las tres variables de arriba. `DATABASE_URL` se copia de Supabase → **Connect** → **Session pooler** (usuario `postgres.lojzzhmlsocbamejedxy`, puerto 5432), con la contraseña de la base y `?sslmode=require` al final.
5. **Domains:** `bb.saraimagineers.com` → puerto **80**, HTTPS (Let's Encrypt). Easypanel le pasa `PORT=80` al contenedor, igual que en MMC.
6. Deploy. En los logs: `[migrar] base al día` y `Ready`. `https://bb.saraimagineers.com/api/salud` responde `{"ok":true}`.
7. Entrar a `/ingresar`, cargar el dólar y el equipo, y generar la clave de cada persona en su ficha (el botón "Mandar por WhatsApp" arma el mensaje con el link a `/mi`).

La app corre en **un solo contenedor**: los límites de intentos de ingreso se guardan en memoria.

## Desarrollo

```bash
cd bb-control
npm install
cp .env.example .env.local   # completar
npm run migrar
npm run dev
```

`npm run lint` corre el chequeo de tipos.

## Próximos pasos (automatizar de a poco)

- Traer las ventas directo de la API de Contabilium (en vez del Excel).
- Cargar compras desde las facturas recibidas (ARCA / Contabilium).
- Avisos por WhatsApp: cumpleaños, pedidos aprobados, vencimientos.
- Cashflow por fecha de cobro y de pago, con saldo de bancos.
