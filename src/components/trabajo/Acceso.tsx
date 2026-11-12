'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEPARTAMENTOS, TIPOS_EMPRESA, CLAVE_MIN } from '@/lib/trabajo';
import { toast } from '../Toast';
import { enviar } from './Comun';
import { FormPostulante, POSTULANTE_VACIO } from './FormPostulante';

function Entrar({ url, que, volverA }: { url: string; que: string; volverA?: string }) {
  const router = useRouter();
  const [mail, setMail] = useState('');
  const [clave, setClave] = useState('');
  const [enviando, setEnviando] = useState(false);
  return (
    <form className="bt-form" onSubmit={async (e) => {
      e.preventDefault();
      setEnviando(true);
      const r = await enviar(url, { mail, clave });
      setEnviando(false);
      if (r) { if (volverA) router.push(volverA); router.refresh(); }
    }}>
      <fieldset>
        <legend>Entrar {que}</legend>
        <div className="bt-campo"><label htmlFor="eMail">Mail</label>
          <input id="eMail" type="email" autoComplete="email" value={mail} onChange={(e) => setMail(e.target.value)} required /></div>
        <div className="bt-campo"><label htmlFor="eClave">Clave</label>
          <input id="eClave" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} required /></div>
      </fieldset>
      <button className="bt-btn" type="submit" disabled={enviando || !mail || !clave}>{enviando ? 'Entrando…' : 'Entrar'}</button>
    </form>
  );
}

function Pestanas({ a, b, valor, cambiar }: { a: string; b: string; valor: 0 | 1; cambiar: (x: 0 | 1) => void }) {
  return (
    <div className="bt-seg" role="tablist">
      <button type="button" role="tab" aria-selected={valor === 0} className={valor === 0 ? 'on' : ''} onClick={() => cambiar(0)}>{a}</button>
      <button type="button" role="tab" aria-selected={valor === 1} className={valor === 1 ? 'on' : ''} onClick={() => cambiar(1)}>{b}</button>
    </div>
  );
}

export function AccesoPostulante({ volverA }: { volverA?: string }) {
  const [t, setT] = useState<0 | 1>(0);
  return (
    <>
      <Pestanas a="Cargar mi CV" b="Ya tengo perfil" valor={t} cambiar={setT} />
      {t === 0 ? <FormPostulante inicial={POSTULANTE_VACIO} nuevo volverA={volverA} /> : <Entrar url="/api/trabajo/postulante/entrar" que="a tu perfil" volverA={volverA} />}
    </>
  );
}

export function AccesoEmpresa() {
  const [t, setT] = useState<0 | 1>(0);
  return (
    <>
      <Pestanas a="Registrar mi empresa" b="Ya estoy registrado" valor={t} cambiar={setT} />
      {t === 0 ? <RegistroEmpresa /> : <Entrar url="/api/trabajo/empresa/entrar" que="como empresa" />}
    </>
  );
}

function RegistroEmpresa() {
  const router = useRouter();
  const [v, setV] = useState({ nombre: '', tipo: '', cuit: '', departamento: '', direccion: '', contacto: '', mail: '', whatsapp: '', clave: '' });
  const [acepto, setAcepto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof typeof v, x: string) => setV((o) => ({ ...o, [k]: x }));
  return (
    <form className="bt-form" noValidate onSubmit={async (e) => {
      e.preventDefault();
      if (v.clave.length < CLAVE_MIN) return toast(`Elegí una clave de al menos ${CLAVE_MIN} caracteres.`);
      if (!acepto) return toast('Tenés que aceptar cuidar los datos de los postulantes.');
      setEnviando(true);
      const r = await enviar('/api/trabajo/empresa/registro', { ...v, acepto });
      setEnviando(false);
      if (r) { toast('¡Listo! Ya podés buscar personal y publicar vacantes.'); router.refresh(); }
    }}>
      <fieldset>
        <legend>Tu establecimiento</legend>
        <div className="bt-campo"><label htmlFor="rNom">Nombre</label>
          <input id="rNom" autoComplete="organization" placeholder="Ej.: Hotel Aconcagua" value={v.nombre} onChange={(e) => set('nombre', e.target.value)} maxLength={120} required /></div>
        <div className="bt-dos">
          <div className="bt-campo"><label htmlFor="rTipo">Tipo</label>
            <select id="rTipo" value={v.tipo} onChange={(e) => set('tipo', e.target.value)} required>
              <option value="">Elegí…</option>
              {TIPOS_EMPRESA.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select></div>
          <div className="bt-campo"><label htmlFor="rCuit">CUIT (opcional)</label>
            <input id="rCuit" inputMode="numeric" placeholder="30-12345678-9" value={v.cuit} onChange={(e) => set('cuit', e.target.value)} maxLength={14} /></div>
        </div>
        <div className="bt-dos">
          <div className="bt-campo"><label htmlFor="rDep">Departamento</label>
            <select id="rDep" value={v.departamento} onChange={(e) => set('departamento', e.target.value)} required>
              <option value="">Elegí…</option>
              {DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}
            </select></div>
          <div className="bt-campo"><label htmlFor="rDir">Dirección</label>
            <input id="rDir" value={v.direccion} onChange={(e) => set('direccion', e.target.value)} maxLength={150} /></div>
        </div>
      </fieldset>
      <fieldset>
        <legend>Contacto</legend>
        <div className="bt-campo"><label htmlFor="rCon">Persona de contacto</label>
          <input id="rCon" autoComplete="name" value={v.contacto} onChange={(e) => set('contacto', e.target.value)} maxLength={80} required /></div>
        <div className="bt-dos">
          <div className="bt-campo"><label htmlFor="rMail">Mail</label>
            <input id="rMail" type="email" autoComplete="email" value={v.mail} onChange={(e) => set('mail', e.target.value)} maxLength={200} required /></div>
          <div className="bt-campo"><label htmlFor="rWa">WhatsApp</label>
            <input id="rWa" type="tel" inputMode="tel" placeholder="261 555 1234" value={v.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} maxLength={20} required /></div>
        </div>
        <div className="bt-campo"><label htmlFor="rClave">Elegí una clave</label>
          <input id="rClave" type="password" autoComplete="new-password" value={v.clave} onChange={(e) => set('clave', e.target.value)} maxLength={100} required />
          <p className="bt-ayuda">Al menos {CLAVE_MIN} caracteres. Con tu mail y esta clave entrás desde cualquier dispositivo.</p></div>
        <label className="bt-check"><input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
          <span>Me comprometo a usar los datos de los postulantes solo para ofrecerles trabajo y a no compartirlos con terceros (Ley 25.326).</span></label>
      </fieldset>
      <button className="bt-btn" type="submit" disabled={enviando}>{enviando ? 'Registrando…' : 'Registrar mi empresa'}</button>
    </form>
  );
}
