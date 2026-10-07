'use client';

// Si algo falla al cargar (por ejemplo, la base no responde), se muestra esto en vez de una pantalla en blanco.
export default function ErrorPantalla({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="ingreso">
      <div className="ingreso-c">
        <img src="/b-crema.png" alt="Bruno Brown" />
        <h1>Algo no anduvo</h1>
        <p>
          No pudimos cargar esta pantalla. Si recién se instaló la app, lo más probable es la conexión con la base de datos: en{' '}
          <a href="/api/salud">/api/salud</a> está el motivo.
        </p>
        <button className="btn" onClick={() => reset()}>Probar de nuevo</button>
      </div>
    </div>
  );
}
