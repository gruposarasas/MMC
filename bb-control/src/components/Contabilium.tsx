'use client';
import { conectarContabilium, type EstadoConexion } from '@/acciones/contabilium';
import { useEnvio } from '@/components/FormAccion';
import type { Estado } from '@/lib/form';
import { fecha, pesos } from '@/lib/formato';

/** Botón que ejecuta una acción con Contabilium y muestra el resultado al lado. */
export function BotonContabilium({ accion, campos = {}, texto, cargando, clase = 'btn claro' }: { accion: (prev: Estado, f: FormData) => Promise<Estado>; campos?: Record<string, string>; texto: string; cargando: string; clase?: string }) {
  const [estado, onSubmit, pendiente] = useEnvio(accion);
  return (
    <form onSubmit={onSubmit} style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {Object.entries(campos).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <button className={clase} disabled={pendiente}>{pendiente ? cargando : texto}</button>
      {estado?.ok && !pendiente && <span className="okmsg" role="status" style={{ fontSize: 13 }}>{estado.ok}</span>}
      {estado?.error && !pendiente && <span className="err" role="alert" style={{ fontSize: 13 }}>{estado.error}</span>}
    </form>
  );
}

/** Formulario de conexión: email y API Key, con prueba y muestra de ventas para comparar. */
export function ConectarContabilium({ email, tieneClave }: { email: string; tieneClave: boolean }) {
  const [estado, onSubmit, pendiente] = useEnvio(conectarContabilium as (p: Estado, f: FormData) => Promise<Estado>);
  const e = estado as EstadoConexion | null;
  return (
    <form onSubmit={onSubmit} className="form">
      <label className="campo">
        <span>Email de la API</span>
        <input name="email" type="email" defaultValue={email} autoComplete="off" required />
      </label>
      <label className="campo">
        <span>API Key</span>
        <input name="clave" type="password" autoComplete="new-password" placeholder={tieneClave ? '•••••••• (ya guardada)' : ''} required={!tieneClave} />
      </label>
      {e?.error && <p className="err" role="alert">{e.error}</p>}
      {e?.ok && (
        <div className="ancho">
          <div className="aviso ok" style={{ marginBottom: 8 }}>{e.ok}</div>
          {e.muestra && e.muestra.length > 0 ? (
            <>
              <p className="sub" style={{ margin: '0 0 6px' }}>Así se leen tus últimas ventas. Comparalas con Contabilium (neto, IVA y total):</p>
              <div className="tabla-env">
                <table className="t">
                  <thead><tr><th>Fecha</th><th>Comprobante</th><th>Cliente</th><th className="der">Neto</th><th className="der">IVA</th><th className="der">Total</th></tr></thead>
                  <tbody>
                    {e.muestra.map((v) => (
                      <tr key={`${v.comprobante}${v.numero}`}>
                        <td className="num">{fecha(v.fecha)}</td>
                        <td>{v.comprobante} <span className="chico">{v.numero}</span></td>
                        <td className="corta">{v.cliente}</td>
                        <td className="der num">{pesos(v.neto)}</td>
                        <td className="der num">{pesos(v.iva)}</td>
                        <td className="der num">{pesos(v.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="sub">No hay ventas en los últimos 30 días para mostrar de ejemplo.</p>
          )}
          {e.campos && e.campos.length > 0 && (
            <details style={{ marginTop: 8, fontSize: 12.5, color: 'var(--tinta3)' }}>
              <summary style={{ cursor: 'pointer' }}>Datos técnicos (campos que devuelve Contabilium)</summary>
              {e.campos.join(', ')}
            </details>
          )}
        </div>
      )}
      <div className="form-pie">
        <button className="btn" disabled={pendiente}>{pendiente ? 'Probando…' : 'Guardar y probar'}</button>
      </div>
    </form>
  );
}
