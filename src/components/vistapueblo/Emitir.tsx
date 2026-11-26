'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MONTOS, pesos, fechaLarga, sumarDias, hoyMendoza, dondeVale, textoWhatsapp, numeroWhatsapp, validarFila } from '@/lib/vistapueblo';
import { leerXlsx, leerCsv } from '@/lib/planilla-excel';
import { toast } from '../Toast';
import { enviar } from './Comun';
import { TarjetaVP } from './Tarjeta';

type Local = { id: string; nombre: string };
type Creada = { id: string; numero: number; nombre: string; mail: string; whatsapp: string; monto: number; vence: string; codigo: string; link: string };
type Opc = { monto: number; vence: string; todos: boolean; locales: string[]; mensaje: string; lote: string };

const opcionesIniciales = (): Opc => ({ monto: 50000, vence: sumarDias(hoyMendoza(), 90), todos: true, locales: [], mensaje: '', lote: '' });

// ------------------------------------------------------------ envío por WhatsApp y mail
export function linkWhatsapp(t: { nombre: string; monto: number; vence: string; whatsapp: string }, donde: string, link: string) {
  const n = t.whatsapp ? numeroWhatsapp(t.whatsapp) : '';
  return `https://wa.me/${n}?text=${encodeURIComponent(textoWhatsapp(t, donde, link))}`;
}
export function linkMail(t: { nombre: string; monto: number; vence: string; mail: string }, donde: string, link: string) {
  const asunto = `🎁 Tu gift card de Vistapueblo por ${pesos(t.monto)}`;
  return `mailto:${encodeURIComponent(t.mail)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(textoWhatsapp(t, donde, link))}`;
}

/** Botones para mandar una gift card: abren WhatsApp o el mail con el mensaje armado y la marcan como enviada. */
export function BotonesEnvio({ t, donde, link }: { t: { id: string; nombre: string; monto: number; vence: string; whatsapp: string; mail: string }; donde: string; link: string }) {
  const router = useRouter();
  const marcar = (accion: string) => fetch('/api/vp/admin/tarjeta', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: t.id, accion }) }).then(() => router.refresh()).catch(() => null);
  return (
    <div className="vp-envio">
      <a className="vp-btn chico wa" href={linkWhatsapp(t, donde, link)} target="_blank" rel="noopener noreferrer" onClick={() => marcar('enviada_wa')}>WhatsApp</a>
      {t.mail && <a className="vp-btn chico linea" href={linkMail(t, donde, link)} onClick={() => marcar('enviada_mail')}>Mail</a>}
      <button type="button" className="vp-btn chico linea" onClick={async () => { await navigator.clipboard.writeText(link).catch(() => null); toast('Link copiado.'); }}>Copiar link</button>
      <a className="vp-link" href={link} target="_blank" rel="noopener noreferrer">Ver tarjeta</a>
    </div>
  );
}

// ------------------------------------------------------------ opciones comunes
function Opciones({ o, set, locales, conMonto, textoMonto }: { o: Opc; set: (x: Partial<Opc>) => void; locales: Local[]; conMonto: boolean; textoMonto?: string }) {
  const hoy = hoyMendoza();
  return (
    <>
      {conMonto && (
        <div className="vp-campo">
          <span className="vp-label">{textoMonto ?? 'Monto'}</span>
          <div className="vp-montos">
            {MONTOS.map((m) => <button key={m} type="button" className={o.monto === m ? 'on' : ''} aria-pressed={o.monto === m} onClick={() => set({ monto: m })}>{pesos(m)}</button>)}
          </div>
        </div>
      )}
      <div className="vp-campo">
        <label htmlFor="vpVence">Vence el</label>
        <div className="vp-vence">
          <input id="vpVence" type="date" min={hoy} value={o.vence} onChange={(e) => set({ vence: e.target.value })} />
          {[30, 60, 90, 180].map((d) => <button key={d} type="button" className={o.vence === sumarDias(hoy, d) ? 'on' : ''} onClick={() => set({ vence: sumarDias(hoy, d) })}>{d} días</button>)}
        </div>
      </div>
      <div className="vp-campo">
        <span className="vp-label">Dónde la pueden usar</span>
        <div className="vp-chips">
          <button type="button" className={o.todos ? 'on' : ''} aria-pressed={o.todos} onClick={() => set({ todos: true, locales: [] })}>Todos los restaurantes</button>
          {locales.map((l) => {
            const on = !o.todos && o.locales.includes(l.id);
            return (
              <button key={l.id} type="button" className={on ? 'on' : ''} aria-pressed={on}
                onClick={() => {
                  const ls = o.todos ? [l.id] : on ? o.locales.filter((x) => x !== l.id) : [...o.locales, l.id];
                  set(ls.length ? { todos: false, locales: ls } : { todos: true, locales: [] });
                }}>{l.nombre}</button>
            );
          })}
        </div>
      </div>
      <div className="vp-campo">
        <label htmlFor="vpMsj">Mensaje en la tarjeta (opcional)</label>
        <input id="vpMsj" maxLength={300} placeholder="Ej.: ¡Gracias por ser parte de Vistapueblo!" value={o.mensaje} onChange={(e) => set({ mensaje: e.target.value })} />
      </div>
    </>
  );
}

function Resultado({ creadas, opc, locales, alVolver }: { creadas: Creada[]; opc: Opc; locales: Local[]; alVolver: () => void }) {
  const donde = dondeVale(opc.todos, opc.locales, locales);
  return (
    <div className="vp-panel">
      <h2>{creadas.length === 1 ? '¡Gift card creada!' : `¡${creadas.length} gift cards creadas!`}</h2>
      <p className="vp-ayuda">Tocá WhatsApp o Mail en cada una: se abre el mensaje armado con el link a la tarjeta y queda marcada como enviada.</p>
      {creadas.length === 1 && <div style={{ maxWidth: 380, margin: '14px 0' }}><TarjetaVP nombre={creadas[0].nombre} monto={creadas[0].monto} vence={creadas[0].vence} numero={creadas[0].numero} /></div>}
      <ul className="vp-lista">
        {creadas.map((t) => (
          <li key={t.id}>
            <div><b>N° {t.numero} · {t.nombre}</b><span>{pesos(t.monto)} · vence {fechaLarga(t.vence)} · {t.whatsapp || t.mail}</span></div>
            <BotonesEnvio t={t} donde={donde} link={t.link} />
          </li>
        ))}
      </ul>
      {creadas.length > 1 && (
        <p className="vp-ayuda">
          <button type="button" className="vp-link" onClick={() => descargarLinks(creadas)}>Descargar la lista con los links (Excel)</button>
        </p>
      )}
      <button type="button" className="vp-btn linea" onClick={alVolver}>Crear otras</button>
    </div>
  );
}

function descargarLinks(cs: Creada[]) {
  const celda = (v: unknown) => { const s = String(v ?? ''); return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const filas = [['N°', 'Nombre', 'Mail', 'WhatsApp', 'Monto', 'Vence', 'Código', 'Link'], ...cs.map((t) => [t.numero, t.nombre, t.mail, t.whatsapp, t.monto, fechaLarga(t.vence), t.codigo, t.link])];
  const blob = new Blob(['﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'Vistapueblo - Gift cards creadas.csv';
  a.click();
}

// ------------------------------------------------------------ de a una
export function NuevaTarjeta({ locales }: { locales: Local[] }) {
  const router = useRouter();
  const [o, setO] = useState<Opc>(opcionesIniciales);
  const [c, setC] = useState({ nombre: '', mail: '', whatsapp: '' });
  const [enviando, setEnviando] = useState(false);
  const [creadas, setCreadas] = useState<Creada[] | null>(null);
  const set = (x: Partial<Opc>) => setO((v) => ({ ...v, ...x }));
  if (creadas) return <Resultado creadas={creadas} opc={o} locales={locales} alVolver={() => { setCreadas(null); setC({ nombre: '', mail: '', whatsapp: '' }); }} />;
  return (
    <div className="vp-dos-col">
      <form className="vp-panel" noValidate onSubmit={async (e) => {
        e.preventDefault();
        const v = validarFila({ ...c, monto: o.monto });
        if (v.error) return toast(v.error);
        setEnviando(true);
        const r = await enviar('/api/vp/admin/tarjetas', { filas: [v.fila], vence: o.vence, todos: o.todos, locales: o.locales, mensaje: o.mensaje, lote: 'Individual' });
        setEnviando(false);
        if (r) { setCreadas(r.tarjetas as Creada[]); router.refresh(); }
      }}>
        <h2>Nueva gift card</h2>
        <div className="vp-campo"><label htmlFor="vpNom">Nombre del cliente</label>
          <input id="vpNom" autoComplete="off" value={c.nombre} onChange={(e) => setC({ ...c, nombre: e.target.value })} maxLength={120} /></div>
        <div className="vp-fila2">
          <div className="vp-campo"><label htmlFor="vpWa">WhatsApp</label>
            <input id="vpWa" type="tel" inputMode="tel" placeholder="261 555 1234" value={c.whatsapp} onChange={(e) => setC({ ...c, whatsapp: e.target.value })} maxLength={20} /></div>
          <div className="vp-campo"><label htmlFor="vpMail">Mail</label>
            <input id="vpMail" type="email" placeholder="nombre@mail.com" value={c.mail} onChange={(e) => setC({ ...c, mail: e.target.value })} maxLength={200} /></div>
        </div>
        <Opciones o={o} set={set} locales={locales} conMonto />
        <button className="vp-btn" type="submit" disabled={enviando}>{enviando ? 'Creando…' : `Crear gift card de ${pesos(o.monto)}`}</button>
      </form>
      <div className="vp-previa">
        <span className="vp-label">Así la ve el cliente</span>
        <TarjetaVP nombre={c.nombre} monto={o.monto} vence={o.vence} />
        <p className="vp-ayuda">Vale en: {dondeVale(o.todos, o.locales, locales)}.{o.mensaje ? ` “${o.mensaje}”` : ''}</p>
      </div>
    </div>
  );
}

// ------------------------------------------------------------ importar Excel
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const ENCABEZADOS = {
  nombre: ['nombre', 'nombre y apellido', 'apellido y nombre', 'cliente', 'nombre completo'],
  mail: ['mail', 'email', 'e-mail', 'correo', 'correo electronico'],
  whatsapp: ['whatsapp', 'telefono', 'celular', 'tel', 'wsp', 'wa', 'movil'],
  monto: ['monto', 'importe', 'valor', 'gift card', 'giftcard'],
};

type Fila = { n: number; nombre: string; mail: string; whatsapp: string; monto: string; error?: string };

function leerFilas(tabla: string[][]): { filas: Fila[]; conMonto: boolean } | { error: string } {
  if (tabla.length < 2) return { error: 'La planilla no trae clientes.' };
  const enc = tabla[0].map(norm);
  const col = (k: keyof typeof ENCABEZADOS) => enc.findIndex((h) => ENCABEZADOS[k].includes(h));
  const c = { nombre: col('nombre'), mail: col('mail'), whatsapp: col('whatsapp'), monto: col('monto') };
  if (c.nombre < 0 || (c.mail < 0 && c.whatsapp < 0)) return { error: 'La planilla tiene que tener las columnas "nombre" y "mail" o "whatsapp" en la primera fila. Bajá el modelo.' };
  const v = (f: string[], i: number) => (i >= 0 ? f[i] ?? '' : '');
  return {
    conMonto: c.monto >= 0,
    filas: tabla.slice(1).map((f, i) => ({ n: i + 2, nombre: v(f, c.nombre), mail: v(f, c.mail), whatsapp: v(f, c.whatsapp), monto: v(f, c.monto) })),
  };
}

function bajarModelo() {
  const t = 'nombre;mail;whatsapp;monto\r\nJuan Pérez;juan@mail.com;2615551234;50000\r\nMaría Gómez;;2614443322;100000\r\n';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + t], { type: 'text/csv;charset=utf-8' }));
  a.download = 'Modelo gift cards Vistapueblo.csv';
  a.click();
}

export function ImportarExcel({ locales }: { locales: Local[] }) {
  const router = useRouter();
  const [o, setO] = useState<Opc>(opcionesIniciales);
  const [archivo, setArchivo] = useState('');
  const [filas, setFilas] = useState<Fila[]>([]);
  const [conMonto, setConMonto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [creadas, setCreadas] = useState<Creada[] | null>(null);
  const set = (x: Partial<Opc>) => setO((v) => ({ ...v, ...x }));

  const revisadas = useMemo(() => filas.map((f) => ({ ...f, error: validarFila(f, o.monto).error })), [filas, o.monto]);
  const ok = revisadas.filter((f) => !f.error);
  const total = ok.reduce((s, f) => s + (validarFila(f, o.monto).fila?.monto ?? 0), 0);

  if (creadas) return <Resultado creadas={creadas} opc={o} locales={locales} alVolver={() => { setCreadas(null); setFilas([]); setArchivo(''); }} />;

  async function leer(a: File | undefined) {
    if (!a) return;
    try {
      const tabla = /\.xlsx$/i.test(a.name) ? await leerXlsx(await a.arrayBuffer()) : leerCsv(await a.text());
      const r = leerFilas(tabla);
      if ('error' in r) { toast(r.error); return; }
      setArchivo(a.name);
      setFilas(r.filas);
      setConMonto(r.conMonto);
      if (!o.lote) set({ lote: a.name.replace(/\.(xlsx|csv)$/i, '').slice(0, 80) });
    } catch (e) {
      toast((e as Error).message || 'No se pudo leer el archivo.');
    }
  }

  return (
    <div className="vp-panel">
      <h2>Importar clientes desde Excel</h2>
      <p className="vp-ayuda">Una fila por cliente con las columnas <b>nombre</b>, <b>mail</b> y/o <b>whatsapp</b>, y opcional <b>monto</b> (10000, 30000, 50000 o 100000). Sirve .xlsx o .csv. <button type="button" className="vp-link" onClick={bajarModelo}>Bajar el modelo</button></p>
      <label className="vp-archivo">
        <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => { leer(e.target.files?.[0]); e.target.value = ''; }} />
        <span>{archivo ? `📄 ${archivo} · elegir otro` : 'Elegí la planilla (.xlsx o .csv)'}</span>
      </label>
      {filas.length > 0 && (
        <>
          <div className="vp-tabla">
            <table>
              <thead><tr><th>Fila</th><th>Nombre</th><th>WhatsApp</th><th>Mail</th><th className="n">Monto</th><th /></tr></thead>
              <tbody>
                {revisadas.slice(0, 300).map((f) => (
                  <tr key={f.n} className={f.error ? 'mal' : ''}>
                    <td>{f.n}</td><td>{f.nombre}</td><td>{f.whatsapp}</td><td>{f.mail}</td>
                    <td className="n">{f.error ? '' : pesos(validarFila(f, o.monto).fila!.monto)}</td>
                    <td>{f.error ? <span className="vp-error">{f.error}</span> : '✓'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {revisadas.length > 300 && <p className="vp-ayuda">… y {revisadas.length - 300} filas más.</p>}
          </div>
          <p className="vp-resumen-import"><b>{ok.length}</b> gift cards por <b>{pesos(total)}</b>{revisadas.length - ok.length ? <> · <span className="vp-error">{revisadas.length - ok.length} filas con errores quedan afuera</span></> : null}</p>
          <Opciones o={o} set={set} locales={locales} conMonto textoMonto={conMonto ? 'Monto para las filas sin monto' : 'Monto para todos'} />
          <div className="vp-campo"><label htmlFor="vpLote">Nombre del envío (para encontrarlo después)</label>
            <input id="vpLote" maxLength={80} value={o.lote} onChange={(e) => set({ lote: e.target.value })} placeholder="Ej.: Clientes VIP diciembre" /></div>
          <button className="vp-btn" type="button" disabled={enviando || !ok.length} onClick={async () => {
            setEnviando(true);
            const r = await enviar('/api/vp/admin/tarjetas', { filas: ok.map((f) => ({ nombre: f.nombre, mail: f.mail, whatsapp: f.whatsapp, monto: f.monto })), monto: o.monto, vence: o.vence, todos: o.todos, locales: o.locales, mensaje: o.mensaje, lote: o.lote });
            setEnviando(false);
            if (r) { setCreadas(r.tarjetas as Creada[]); router.refresh(); }
          }}>{enviando ? 'Creando…' : `Crear ${ok.length} gift cards`}</button>
        </>
      )}
    </div>
  );
}
