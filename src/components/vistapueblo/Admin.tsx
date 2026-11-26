'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { pesos, fechaLarga, ESTADOS, type EstadoTarjeta } from '@/lib/vistapueblo';
import { toast } from '../Toast';
import { enviar } from './Comun';
import { BotonesEnvio } from './Emitir';

export type FilaTarjeta = {
  id: string; numero: number; nombre: string; mail: string; whatsapp: string; monto: number; saldo: number; vence: string;
  estado: EstadoTarjeta; donde: string; link: string; lote: string; enviada: boolean; vista: boolean; creada: string;
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
                <td><Link className="vp-link" href={`/vistapueblo/admin/tarjeta/${f.id}`}>{f.nombre}</Link><small>{f.whatsapp || f.mail}</small></td>
                <td className="n">{pesos(f.monto)}</td>
                <td className="n">{pesos(f.saldo)}</td>
                <td>{fechaLarga(f.vence)}</td>
                <td><span className={`vp-estado ${f.estado}`}>{ESTADOS[f.estado]}</span></td>
                <td>{f.enviada ? 'Enviada' : <span className="vp-pend">Sin enviar</span>}{f.vista ? <small>Abierta por el cliente</small> : null}</td>
                <td>{f.estado === 'sin_usar' || f.estado === 'parcial'
                  ? <BotonesEnvio t={f} donde={f.donde} link={f.link} />
                  : <Link className="vp-link" href={`/vistapueblo/admin/tarjeta/${f.id}`}>Ver detalle</Link>}</td>
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

type L = { id: string; nombre: string; porcentaje: number; pin: string; activo: boolean };

export function EditorLocales({ locales }: { locales: L[] }) {
  return (
    <div className="vp-tabla">
      <table>
        <thead><tr><th>Local</th><th>% que absorbe el local</th><th>Ejemplo con {pesos(100000)}</th><th>PIN de la caja</th><th>Activo</th></tr></thead>
        <tbody>{locales.map((l) => <FilaLocal key={l.id} l={l} />)}</tbody>
      </table>
    </div>
  );
}

function FilaLocal({ l }: { l: L }) {
  const router = useRouter();
  const [p, setP] = useState(String(l.porcentaje));
  const n = Math.min(100, Math.max(0, Number(p.replace(',', '.')) || 0));
  const guardar = async (cuerpo: object, msj: string) => { const r = await enviar('/api/vp/admin/local', { id: l.id, ...cuerpo }); if (r) { toast(msj); router.refresh(); } return r; };
  return (
    <tr style={{ opacity: l.activo ? 1 : 0.5 }}>
      <td><b>{l.nombre}</b></td>
      <td>
        <span className="vp-inline">
          <input className="vp-pct" inputMode="decimal" value={p} onChange={(e) => setP(e.target.value)} aria-label={`% que absorbe ${l.nombre}`} /> %
          {Number(p.replace(',', '.')) !== l.porcentaje && <button type="button" className="vp-btn chico" onClick={() => guardar({ porcentaje: p }, `${l.nombre}: ahora absorbe ${n}%.`)}>Guardar</button>}
        </span>
      </td>
      <td><small>Local {pesos(Math.round(100000 * n / 100))} · Vistapueblo {pesos(100000 - Math.round(100000 * n / 100))}</small></td>
      <td>
        <span className="vp-inline"><code className="vp-pin">{l.pin}</code>
          <button type="button" className="vp-link" onClick={async () => { if (confirm(`¿Darle un PIN nuevo a ${l.nombre}? Las cajas abiertas de ese local van a tener que volver a entrar.`)) await guardar({ nuevoPin: true }, 'PIN nuevo generado.'); }}>Nuevo PIN</button>
        </span>
      </td>
      <td><input type="checkbox" checked={l.activo} onChange={(e) => guardar({ activo: e.target.checked }, e.target.checked ? 'Local activado.' : 'Local desactivado.')} aria-label={`${l.nombre} activo`} /></td>
    </tr>
  );
}
