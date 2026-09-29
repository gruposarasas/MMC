'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import recursos from '@/lib/recursos.json';
import { MESES } from '@/lib/config';
import { SorteoAviso } from './SorteoVisitante';
import { validarRegistro, type DatosRegistro, type Errores, type Via } from '@/lib/validar';

export function Registro() {
  const router = useRouter();
  const anio = new Date().getFullYear();
  const [f, setF] = useState<DatosRegistro>({ nombre: '', dia: '', mes: '', anio: '', via: 'mail', contacto: '', acepto: false, novedades: true });
  const [e, setE] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const set = <K extends keyof DatosRegistro>(k: K, v: DatosRegistro[K]) => setF((x) => ({ ...x, [k]: v }));

  const enfocarError = () =>
    requestAnimationFrame(() => (form.current?.querySelector('.campo.error input, .campo.error select, .err') as HTMLElement | null)?.focus?.());

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault();
    const { errores } = validarRegistro(f);
    setE(errores);
    if (Object.keys(errores).length) return enfocarError();
    setEnviando(true);
    try {
      const r = await fetch('/api/registro', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (j.errores) {
          setE(j.errores);
          enfocarError();
        } else setE({ acepto: j.error || 'No pudimos registrarte. Probá de nuevo en un momento.' });
        setEnviando(false);
        return;
      }
      router.replace(j.ya_existia ? '/billetera?aviso=ya' : '/billetera');
      router.refresh();
    } catch {
      setE({ acepto: 'Sin conexión. Revisá tu internet y probá de nuevo.' });
      setEnviando(false);
    }
  }

  const cambiarVia = (via: Via) => {
    setF((x) => ({ ...x, via, contacto: '' }));
    setE((x) => ({ ...x, contacto: undefined }));
  };

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="deco" src={recursos.ic_planta} alt="" style={{ width: 170, right: -40, top: 40 }} />
      <div className="tel-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src={recursos.logo} alt="Mundial de Café by Bruno Brown" />
        <h1 className="h1">TUS CUPONES DE DESCUENTO MUNDIAL</h1>
        <p className="lead">Registrate una vez y recibí tus cupones de descuento para usar en cada stand en el evento y en las sucursales también.</p>
        <SorteoAviso />
        <form ref={form} onSubmit={enviar} noValidate>
          <div className={`campo ${e.nombre ? 'error' : ''}`}>
            <label htmlFor="rNom">Nombre y apellido</label>
            <input id="rNom" autoComplete="name" value={f.nombre} onChange={(x) => set('nombre', x.target.value)} placeholder="Como figura en tu DNI" maxLength={120} aria-invalid={!!e.nombre} aria-describedby={e.nombre ? 'eNom' : undefined} />
            {e.nombre && <div className="err" id="eNom">{e.nombre}</div>}
          </div>
          <div className={`campo ${e.nac ? 'error' : ''}`}>
            <label id="lNac">Fecha de nacimiento</label>
            <div className="fecha" role="group" aria-labelledby="lNac">
              <select aria-label="Día" value={f.dia} onChange={(x) => set('dia', x.target.value)}>
                <option value="">Día</option>
                {Array.from({ length: 31 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
              </select>
              <select aria-label="Mes" value={f.mes} onChange={(x) => set('mes', x.target.value)}>
                <option value="">Mes</option>
                {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <select aria-label="Año" value={f.anio} onChange={(x) => set('anio', x.target.value)}>
                <option value="">Año</option>
                {Array.from({ length: 90 }, (_, i) => anio - 10 - i).map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            {e.nac && <div className="err">{e.nac}</div>}
          </div>
          <div className="campo">
            <label id="lVia">¿Dónde querés recibir tus cupones?</label>
            <div className="seg" role="group" aria-labelledby="lVia">
              <button type="button" className={f.via === 'mail' ? 'on' : ''} aria-pressed={f.via === 'mail'} onClick={() => cambiarVia('mail')}>Mail</button>
              <button type="button" className={f.via === 'wa' ? 'on' : ''} aria-pressed={f.via === 'wa'} onClick={() => cambiarVia('wa')}>WhatsApp</button>
            </div>
          </div>
          <div className={`campo ${e.contacto ? 'error' : ''}`}>
            {f.via === 'mail' ? (
              <>
                <label htmlFor="rCon">Tu mail</label>
                <input id="rCon" type="email" inputMode="email" autoComplete="email" value={f.contacto} onChange={(x) => set('contacto', x.target.value)} placeholder="nombre@mail.com" maxLength={200} aria-invalid={!!e.contacto} />
                <div className="ayuda">Tus cupones quedan guardados con este mail: con él los recuperás desde cualquier celular y te avisamos antes de su vencimiento.</div>
              </>
            ) : (
              <>
                <label htmlFor="rCon">Tu WhatsApp</label>
                <input id="rCon" type="tel" inputMode="tel" autoComplete="tel" value={f.contacto} onChange={(x) => set('contacto', x.target.value)} placeholder="261 555 1234" maxLength={20} aria-invalid={!!e.contacto} />
                <div className="ayuda">Con característica, sin 0 ni 15. Tus cupones quedan guardados con este número: con él los recuperás desde cualquier celular y te avisamos antes de su vencimiento.</div>
              </>
            )}
            {e.contacto && <div className="err">{e.contacto}</div>}
          </div>
          <label className="check">
            <input type="checkbox" checked={f.acepto} onChange={(x) => set('acepto', x.target.checked)} />
            <span>Acepto que Bruno Brown use mis datos para darme estos beneficios.</span>
          </label>
          {e.acepto && <div className="err" tabIndex={-1}>{e.acepto}</div>}
          <label className="check">
            <input type="checkbox" checked={f.novedades} onChange={(x) => set('novedades', x.target.checked)} />
            <span>Quiero recibir novedades y beneficios de Bruno Brown y del próximo Mundial.</span>
          </label>
          <button className="btn" type="submit" disabled={enviando}>{enviando ? 'Un momento…' : 'Recibir mis cupones'}</button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 18 }}>
          <Link className="link" href="/recuperar">¿Ya te registraste? Recuperá tus cupones</Link>
        </p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={recursos.guarda} alt="" style={{ width: '100%', display: 'block', marginTop: 'auto' }} />
    </>
  );
}
