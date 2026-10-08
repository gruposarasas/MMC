# BB-CONTROL · brief

App de gestión de **Bruno Brown**, importadora de café de Mendoza. Datos financieros al día y un cashflow permanente para ver los KPI. Simple, mobile-friendly, carga manual primero y automatización de a poco.

- **Idioma:** español rioplatense con voseo. **Zona horaria:** `America/Argentina/Mendoza`.
- **Diseño:** concepto de https://www.brunobrown.cafe y la identidad de la app del Mundial de Café (paleta ciruela/bordó/arena/crema, Poppins, la "B", figuras geométricas y guarda). Gráficos con la paleta validada en `globals.css` (`--s-*`).
- **Módulos:** Ventas (Excel mensual de Contabilium, con y sin IVA, mes en curso, filtros) · Compras (mercadería, por rubro) · Gastos (alquiler, servicios, impuestos, F.931, inversiones) · Sueldos · Equipo (datos, cumpleaños, vacaciones, certificados, uniforme, adelantos; cada uno pide desde su app `/mi`) · Costos (ingeniería de costos por producto) · KPI (ventas − costos − gastos − sueldos = rentabilidad, con porcentajes).
- **Agregados:** Proveedores (lista que se importa y edita; las compras eligen de ahí), lectura de facturas con una foto (`ANTHROPIC_API_KEY`) y Contabilidad (el contador entra en `/contador` y carga F.931, IVA e IIBB de cada mes; solo administración marca pagado).
- **Pendiente:** el dueño va a pasar la lista del equipo con sus datos para cargarla.
- Estado, cálculos y deploy: ver `README.md`.
