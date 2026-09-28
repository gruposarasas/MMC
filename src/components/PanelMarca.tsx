'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import recursos from '@/lib/recursos.json';
import { EVENTO_FIN } from '@/lib/config';
import { CamposCupon, type ValorCupon } from './CamposCupon';
import { toast } from './Toast';

export function EntrarMarca() {
  const router = useRouter();
  const [clave, setClave] = useState('');
  const [enviando, setEnviando] = useState(false);
  async function entrar(ev: React.FormEvent) {
    ev.preventDefault();
    setEnviando(true);
    const r = await fetch('/api/marca/entrar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ clave }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setEnviando(false);
    if (!r || !r.ok) return toast(j.error || 'No pudimos entrar. Probá de nuevo.');
    router.refresh();
  }
  return (
    <div className="tel" style={{ maxWidth: 460 }}>
      <div className="tel-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src={recursos.logo} alt="Mundial de Café" style={{ width: 160 }} />
        <h1 className="h1" style={{ fontSize: 26 }}>Panel de tu marca</h1>
        <p className="lead">Entrá con la clave que te dio la organización para ver tus canjes y configurar tu beneficio.</p>
        <form onSubmit={entrar}>
          <div className="campo">
            <label htmlFor="pmClave">Clave de tu marca</label>
            <input id="pmClave" autoCapitalize="characters" autoComplete="off" placeholder="SHELBY-7Q" value={clave} onChange={(e) => setClave(e.target.value)} maxLength={30} />
          </div>
          <button className="btn" type="submit" disabled={enviando || !clave.trim()}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  );
}

export function SalirMarca() {
  const router = useRouter();
  return (
    <button className="link" onClick={async () => { await fetch('/api/marca/salir', { method: 'POST' }).catch(() => {}); router.refresh(); }}>
      Salir
    </button>
  );
}

type ValorForm = ValorCupon & { beneficio: string; condiciones: string };

export function FormCupon({ inicial, codigo, creditos }: { inicial: ValorForm; codigo: string; creditos: number }) {
  const router = useRouter();
  const [v, setV] = useState<ValorForm>(inicial);
  const [enviando, setEnviando] = useState(false);
  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!v.beneficio.trim()) return toast('Escribí el beneficio que vas a dar.');
    const vence = v.vence || EVENTO_FIN;
    if (vence < EVENTO_FIN) return toast('El vencimiento no puede ser antes del 4 de octubre.');
    if (!confirm('¿Enviar tu cupón? Después no lo vas a poder cambiar ni eliminar: solo la organización puede hacerlo.')) return;
    setEnviando(true);
    const logo = v.logo === inicial.logo ? 'mantener' : v.logo || 'quitar';
    const r = await fetch('/api/marca/enviar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ beneficio: v.beneficio, condiciones: v.condiciones, vence, sucursales: v.sucursales, logo }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setEnviando(false);
    if (!r || !r.ok) return toast(j.error || 'No se pudo enviar. Probá de nuevo.');
    toast('Cupón enviado. Los visitantes ya lo ven en su billetera.');
    router.refresh();
  }
  return (
    <form className="form" onSubmit={enviar}>
      <h2 style={{ margin: 0, fontSize: 18, color: 'var(--arena)' }}>Tu cupón</h2>
      <p className="ayuda">
        Elegí el beneficio que vas a dar, completá tu logo, hasta cuándo vale y dónde se puede usar después, y envialo.{' '}
        <b>Una vez enviado no lo vas a poder cambiar ni eliminar.</b>
      </p>
      <div className="grid2">
        <div className="campo">
          <label htmlFor="pmBen">Beneficio</label>
          <input id="pmBen" value={v.beneficio} onChange={(e) => setV((y) => ({ ...y, beneficio: e.target.value }))} placeholder="2x1 en café" maxLength={34} />
          <div className="ayuda">Corto: es lo que se ve grande en el cupón. Por ejemplo, &quot;20% off&quot; o &quot;Medialuna de regalo&quot;.</div>
        </div>
        <div className="campo">
          <label htmlFor="pmCond">Condiciones</label>
          <input id="pmCond" value={v.condiciones} onChange={(e) => setV((y) => ({ ...y, condiciones: e.target.value }))} placeholder="En cualquier café de la carta" maxLength={240} />
          <div className="ayuda">Cada visitante lo puede usar {creditos === 1 ? '1 vez' : `${creditos} veces`}: eso lo define la organización.</div>
        </div>
      </div>
      <CamposCupon v={v} set={(x) => setV((y) => ({ ...y, ...x }))} />
      <div className="campo">
        <label>Código de caja</label>
        <span className="codigo">{codigo}</span>
        <div className="ayuda">Tu personal se lo dice al visitante al pagar.</div>
      </div>
      <button className="btn chico" type="submit" style={{ marginTop: 14 }} disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar cupón'}</button>
    </form>
  );
}
