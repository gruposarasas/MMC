# GM-CONTROL · brief

App de gestión de **Grupo Modesto**, fábrica mayorista de panificados, pastas, pastelería y producción de Mendoza, con sus marcas Modesto (casa de café), Bastante (café) y La Social (pizzería de barrio). Datos financieros al día y un cashflow permanente para ver los KPI. Simple, mobile-friendly, carga manual primero y automatización de a poco.

- **Idioma:** español rioplatense con voseo. **Zona horaria:** `America/Argentina/Mendoza`.
- **Diseño:** identidad de Grupo Modesto (marrón `#45302D`, crema `#F8F4EC`, topo `#9B837B`, terracota `#B4482E` de acento, Nunito Sans, el isotipo de curvas de nivel, figuras de trazo y la guarda de las tres historias). Gráficos con la paleta validada en `globals.css` (`--s-*`).
- **Módulos:** Ventas · Compras (mercadería, por rubro, como factura o leyendo la foto) · Gastos · Proveedores · Sueldos · Equipo (con la app `/mi` de cada persona) · Costos · Contabilidad (el contador entra en `/contador`) · KPI (ventas − costos − gastos − sueldos = rentabilidad, con porcentajes).
- La app vive en la carpeta `gm-control/` del repo MMC (Easypanel: build path `/gm-control`). Es autónoma: se puede pasar a un repo propio copiando la carpeta.
- Hecha a partir de BB-CONTROL (Bruno Brown). Estado, cálculos y deploy: ver `README.md`.
