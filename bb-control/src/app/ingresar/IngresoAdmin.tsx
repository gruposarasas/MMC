'use client';
import { ingresarAdmin } from '@/acciones/sesion';
import { useEnvio } from '@/components/FormAccion';

export function IngresoAdmin() {
  const [estado, onSubmit, pendiente] = useEnvio(ingresarAdmin);
  return (
    <form onSubmit={onSubmit}>
      <label className="campo">
        <span>Contraseña</span>
        <input name="clave" type="password" autoComplete="current-password" required autoFocus />
      </label>
      {estado?.error && <p className="err" role="alert" style={{ marginTop: 10 }}>{estado.error}</p>}
      <button className="btn" disabled={pendiente}>{pendiente ? 'Entrando…' : 'Entrar'}</button>
    </form>
  );
}
