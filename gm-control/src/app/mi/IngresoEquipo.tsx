'use client';
import { ingresarEquipo } from '@/acciones/sesion';
import { useEnvio } from '@/components/FormAccion';

export function IngresoEquipo() {
  const [estado, onSubmit, pendiente] = useEnvio(ingresarEquipo);
  return (
    <form onSubmit={onSubmit}>
      <label className="campo">
        <span>DNI</span>
        <input name="dni" inputMode="numeric" autoComplete="username" required />
      </label>
      <label className="campo" style={{ marginTop: 12 }}>
        <span>Clave</span>
        <input name="clave" type="password" inputMode="numeric" autoComplete="current-password" required />
      </label>
      {estado?.error && <p className="err" role="alert" style={{ marginTop: 10 }}>{estado.error}</p>}
      <button className="btn" disabled={pendiente}>{pendiente ? 'Entrando…' : 'Entrar'}</button>
    </form>
  );
}
