'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { pesos, fechaLarga, ESTADOS, MODOS, type EstadoTarjeta, type Modo } from '@/lib/vistapueblo';
import { toast } from '../Toast';
import { enviar } from './Comun';
import { BotonesEnvio } from './Emitir';

export type FilaTarjeta = {
  id: string; numero: number; nombre: string; mail: string; whatsapp: string; monto: number; saldo: number; vence: string;
  estado: EstadoTarjeta; donde: string; link: string; lote: string; enviada: boolean; vista: boolean; creada: string; impresa: boolean; modo: Modo;
};

export function ListaTarjetas({ filas }: { filas: FilaTarjeta[] }) {
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [lote, setLote] = useState('');
  const lotes = useMemo(() => [...new Set(filas.map((f) => f.lote).filter(Boolean))], [filas]);
  const vistas = useMemo(() => {
    const t = q.trim().toLowerCase();
    const d = t.replace(/\D/g, '');
    return filas.filter((f) =>
      (!estado || f.estado === estado) && (!lote || f.lote === lote) &&
      (!t || f.nombre.toLowerCase().includes(t) || f.mail.includes(t) || String(f.numero) === t || (d.length >= 4 && f.whatsapp.includes(d))));
  }, [filas, q, estado, lote]);
  return (
    <>
      <div className="vp-filtros">
        <input placeholder="Buscar por nombre, mail, WhatsApp o N°" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        <select value={estado} onChange={(e) => setEstado(e.target.value)} aria-label="Estado">
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
        {lotes.length > 0 && (
          <select value={lote} onChange={(e) => setLote(e.target.value)} aria-label="Envío">
            <option value="">Todos los envíos</option>
            {lotes.map((l) => <option key={l}>{l}</option>)}
          </select>
        )}
        <a className="vp-btn chico linea" href="/api/vp/admin/csv?tipo=tarjetas">Descargar Excel</a>
      </div>
      <p className="vp-ayuda">{vistas.length} gift cards · {pesos(vistas.reduce((s, f) => s + f.monto, 0))} emitidos · {pesos(vistas.filter((f) => f.estado === 'sin_usar' || f.estado === 'parcial').reduce((s, f) => s + f.saldo, 0))} de saldo disponible</p>
      <div className="vp-tabla">
        <table>
          <thead><tr><th>N°</th><th>Cliente</th><th className="n">Monto</th><th className="n">Saldo</th><th>Vence</th><th>Estado</th><th>Envío</th><th /></tr></thead>
          <tbody>
            {vistas.slice(0, 500).map((f) => (
              <tr key={f.id}>
                <td>{f.numero}</td>
                <td><Link className="vp-link" href={`/vistapueblo/admin/tarjeta/${f.id}`}>{f.nombre}</Link><small>{f.impresa ? 'Voucher impreso' : f.whatsapp || f.mail}{f.modo === 'unico' ? ` · ${MODOS.unico.titulo}` : ''}</small></td>
                <td className="n">{pesos(f.monto)}</td>
                <td className="n">{pesos(f.saldo)}</td>
                <td>{fechaLarga(f.vence)}</td>
                <td><span className={`vp-estado ${f.estado}`}>{ESTADOS[f.estado]}</span></td>
                <td>{f.impresa ? 'Impresa' : f.enviada ? 'Enviada' : <span className="vp-pend">Sin enviar</span>}{f.vista ? <small>Abierta por el cliente</small> : null}</td>
                <td>{f.estado !== 'sin_usar' && f.estado !== 'parcial'
                  ? <Link className="vp-link" href={`/vistapueblo/admin/tarjeta/${f.id}`}>Ver detalle</Link>
                  : f.impresa ? <span className="vp-envio"><Link className="vp-btn chico linea" href={`/vistapueblo/admin/imprimir?ids=${f.id}`}>Imprimir de nuevo</Link><Link className="vp-link" href={`/vistapueblo/admin/tarjeta/${f.id}`}>Ver detalle</Link></span>
                  : <BotonesEnvio t={f} donde={f.donde} link={f.link} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!vistas.length && <p className="vp-vacio">No hay gift cards con esos filtros.</p>}
      </div>
    </>
  );
}

export function AccionesTarjeta({ id, anulada, vence }: { id: string; anulada: boolean; vence: string }) {
  const router = useRouter();
  const [v, setV] = useState(vence);
  const hacer = async (cuerpo: object, msj: string) => { if (await enviar('/api/vp/admin/tarjeta', { id, ...cuerpo })) { toast(msj); router.refresh(); } };
  return (
    <div className="vp-acciones">
      <label className="vp-inline">Vence el
        <input type="date" value={v} onChange={(e) => setV(e.target.value)} />
        {v !== vence && <button type="button" className="vp-btn chico" onClick={() => hacer({ accion: 'vence', vence: v }, 'Vencimiento cambiado.')}>Guardar</button>}
      </label>
      {anulada
        ? <button type="button" className="vp-btn chico linea" onClick={() => hacer({ accion: 'reactivar' }, 'La gift card vuelve a valer.')}>Reactivar</button>
        : <button type="button" className="vp-link peligro" onClick={() => { if (confirm('¿Anular esta gift card? No se va a poder usar más (los consumos hechos quedan).')) hacer({ accion: 'anular' }, 'Gift card anulada.'); }}>Anular gift card</button>}
    </div>
  );
}

export function AnularConsumo({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button type="button" className="vp-link peligro" onClick={async () => {
      const motivo = prompt('¿Por qué anulás este consumo? El monto vuelve al saldo de la gift card y sale de la cuenta corriente.');
      if (motivo === null) return;
      if (await enviar('/api/vp/admin/consumo', { id, motivo })) { toast('Consumo anulado.'); router.refresh(); }
    }}>Anular</button>
  );
}

type L = { id: string; nombre: string; porcentaje: number; pin: string; activo: boolean; clave: string };

const aNumero = (v: string) => Number(v.replace(',', '.'));
const valido = (v: string) => v.trim() !== '' && Number.isFinite(aNumero(v)) && aNumero(v) >= 0 && aNumero(v) <= 100;

/** Locales: se cambian los % de todos y se guardan juntos con un solo botón. */
export function EditorLocales({ locales, url }: { locales: L[]; url: string }) {
  const router = useRouter();
  const [pcts, setPcts] = useState<Record<string, string>>(() => Object.fromEntries(locales.map((l) => [l.id, String(l.porcentaje)])));
  const [guardando, setGuardando] = useState(false);
  const cambiados = locales.filter((l) => pcts[l.id] !== undefined && aNumero(pcts[l.id]) !== l.porcentaje);
  const hayError = cambiados.some((l) => !valido(pcts[l.id]));

  useEffect(() => {
    if (!cambiados.length) return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [cambiados.length]);

  const guardar = async () => {
    if (!cambiados.length) return;
    if (hayError) return toast('El porcentaje va de 0 a 100.');
    setGuardando(true);
    const res = await Promise.all(cambiados.map((l) => enviar('/api/vp/admin/local', { id: l.id, porcentaje: pcts[l.id] })));
    setGuardando(false);
    const ok = res.filter(Boolean).length;
    if (ok) toast(ok === 1 ? 'Porcentaje guardado.' : `${ok} porcentajes guardados.`);
    router.refresh();
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); guardar(); }}>
      <div className="vp-tabla vp-locales">
        <table>
          <thead><tr><th>Local</th><th>% que absorbe el local</th><th>Ejemplo con {pesos(100000)}</th><th>PIN de la caja</th><th>Panel del local</th><th>Activo</th></tr></thead>
          <tbody>{locales.map((l) => (
            <FilaLocal key={l.id} l={l} url={url} valor={pcts[l.id] ?? ''} cambiado={cambiados.includes(l)} onCambio={(v) => setPcts((x) => ({ ...x, [l.id]: v }))} />
          ))}</tbody>
        </table>
      </div>
      <div className={`vp-guardar${cambiados.length ? ' on' : ''}`}>
        <span>{cambiados.length
          ? (hayError ? <span className="vp-error">Revisá los porcentajes: van de 0 a 100.</span> : <>Tenés <b>{cambiados.length}</b> {cambiados.length === 1 ? 'cambio' : 'cambios'} sin guardar.</>)
          : 'Cambiá los porcentajes y tocá Guardar.'}</span>
        <span className="vp-inline">
          {cambiados.length > 0 && <button type="button" className="vp-link" onClick={() => setPcts(Object.fromEntries(locales.map((l) => [l.id, String(l.porcentaje)])))}>Deshacer</button>}
          <button type="submit" className="vp-btn" disabled={!cambiados.length || guardando || hayError}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
        </span>
      </div>
    </form>
  );
}

function FilaLocal({ l, url, valor, cambiado, onCambio }: { l: L; url: string; valor: string; cambiado: boolean; onCambio: (v: string) => void }) {
  const router = useRouter();
  const n = valido(valor) ? aNumero(valor) : l.porcentaje;
  const local = Math.round(100000 * n / 100);
  const accion = async (cuerpo: object, msj: string) => { const r = await enviar('/api/vp/admin/local', { id: l.id, ...cuerpo }); if (r) { toast(msj); router.refresh(); } };
  return (
    <tr className={cambiado ? 'sel' : ''} style={{ opacity: l.activo ? 1 : 0.5 }}>
      <td data-t="Local"><b>{l.nombre}</b></td>
      <td data-t="% que absorbe">
        <span className="vp-inline">
          <input className="vp-pct" inputMode="decimal" value={valor} onChange={(e) => onCambio(e.target.value.replace(/[^0-9.,]/g, ''))} aria-label={`% que absorbe ${l.nombre}`} /> %
          {cambiado && <small className="vp-pend">antes {l.porcentaje}%</small>}
        </span>
      </td>
      <td data-t={`Con ${pesos(100000)}`}><small>Local {pesos(local)} · Vistapueblo {pesos(100000 - local)}</small></td>
      <td data-t="PIN de la caja">
        <span className="vp-inline"><code className="vp-pin">{l.pin}</code>
          <button type="button" className="vp-link" onClick={() => { if (confirm(`¿Darle un PIN nuevo a ${l.nombre}? Las cajas abiertas de ese local van a tener que volver a entrar.`)) accion({ nuevoPin: true }, 'PIN nuevo generado.'); }}>Nuevo PIN</button>
        </span>
      </td>
      <td data-t="Panel del local">
        <span className="vp-inline"><code className="vp-pin">{l.clave}</code>
          <button type="button" className="vp-link" onClick={async () => {
            await navigator.clipboard.writeText(`Panel de gift cards de ${l.nombre} (Vistapueblo)\n${url}/vistapueblo/local\nClave: ${l.clave}`).catch(() => null);
            toast('Acceso copiado: link y clave.');
          }}>Copiar acceso</button>
          <button type="button" className="vp-link tenue-oscuro" onClick={() => { if (confirm(`¿Darle una clave nueva al panel de ${l.nombre}? Quien esté adentro con la clave anterior va a tener que volver a entrar.`)) accion({ nuevaClave: true }, 'Clave nueva generada.'); }}>Nueva</button>
        </span>
      </td>
      <td data-t="Activo"><input type="checkbox" checked={l.activo} onChange={(e) => accion({ activo: e.target.checked }, e.target.checked ? 'Local activado.' : 'Local desactivado.')} aria-label={`${l.nombre} activo`} /></td>
    </tr>
  );
}
