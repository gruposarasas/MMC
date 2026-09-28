# Fuente de los manuales

- `marcas.html` y `admin.html`: el contenido. `estilos.css`: diseño (Poppins y colores del Mundial).
- `img/`: capturas de la app con datos de demostración (claves y códigos inventados).
- `capturas.mjs`: regenera las capturas contra una instancia local de la app con datos de demo.
- `pdf.mjs`: genera el PDF con Chromium (Playwright): `node pdf.mjs marcas` / `node pdf.mjs admin`.
  Las rutas del script apuntan a una carpeta de trabajo; ajustalas antes de usarlo.
