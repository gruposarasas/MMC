'use client';
import { ingresarContador } from '@/acciones/contabilidad';
import { useEnvio } from '@/components/FormAccion';

export function IngresoContador() {
  const [estado, onSubmit, pendiente] = useEnvio(ingresarContador);
  return (
    <form onSubmit={onSubmit}>
      <label className="campo">
        <span>Mail</span>
        <input name="email" type="email" autoComplete="username" required autoFocus />
      </label>
      <label className="campo" style={{ marginTop: 12 }}>
        <span>Clave</span>
        <input name="clave" type="password" autoComplete="current-password" required placeholder="xxxx-xxxx" />
      </label>
      {estado?.error && <p className="err" role="alert" style={{ marginTop: 10 }}>{estado.error}</p>}
      <button className="btn" disabled={pendiente}>{pendiente ? 'Entrando…' : 'Entrar'}</button>
    </form>
  );
}
