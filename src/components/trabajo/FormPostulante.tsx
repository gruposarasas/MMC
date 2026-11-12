'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DEPARTAMENTOS, PUESTOS, DISPONIBILIDAD, IDIOMAS, CV_MAX, CLAVE_MIN } from '@/lib/trabajo';
import { toast } from '../Toast';
import { enviar, Chips } from './Comun';

export type ValoresPostulante = {
  nombre: string; nacimiento: string; mail: string; whatsapp: string; direccion: string; localidad: string; departamento: string;
  puesto: string; puestos_extra: string[]; puesto_otro: string; puesto_actual: string; experiencia: number;
  disponibilidad: string[]; idiomas: string[]; movilidad: boolean; sobre_mi: string; visible: boolean;
};

export const POSTULANTE_VACIO: ValoresPostulante = {
  nombre: '', nacimiento: '', mail: '', whatsapp: '', direccion: '', localidad: '', departamento: '',
  puesto: '', puestos_extra: [], puesto_otro: '', puesto_actual: '', experiencia: 0,
  disponibilidad: [], idiomas: [], movilidad: false, sobre_mi: '', visible: true,
};

/** Alta (nuevo) o edición del perfil del postulante, con el CV. */
export function FormPostulante({ inicial, nuevo, tieneCv, idCv, volverA }: { inicial: ValoresPostulante; nuevo: boolean; tieneCv?: boolean; idCv?: string; volverA?: string }) {
  const router = useRouter();
  const [v, setV] = useState(inicial);
  const [cv, setCv] = useState<File | null>(null);
  const [clave, setClave] = useState('');
  const [acepto, setAcepto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const set = <K extends keyof ValoresPostulante>(k: K, x: ValoresPostulante[K]) => setV((o) => ({ ...o, [k]: x }));
  const extra = (i: number) => v.puestos_extra[i] ?? '';
  const setExtra = (i: number, x: string) => {
    const l = [extra(0), extra(1)];
    l[i] = x;
    set('puestos_extra', l.filter(Boolean));
  };
  const pideOtro = v.puesto === 'otro' || v.puestos_extra.includes('otro');
  const hoy = new Date();
  const maxNac = `${hoy.getFullYear() - 16}-12-31`;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (nuevo && !cv) return toast('Subí tu CV en PDF o una foto (JPG o PNG).');
    if (cv && cv.size > CV_MAX) return toast('El CV pesa más de 5 MB.');
    if (nuevo && clave.length < CLAVE_MIN) return toast(`Elegí una clave de al menos ${CLAVE_MIN} caracteres.`);
    if (nuevo && !acepto) return toast('Para publicar tu CV tenés que aceptar el uso de tus datos.');
    const f = new FormData();
    for (const [k, x] of Object.entries(v)) {
      if (Array.isArray(x)) x.forEach((y) => f.append(k, y));
      else f.append(k, String(x));
    }
    if (cv) f.append('cv', cv);
    if (clave) f.append('clave', clave);
    if (nuevo) f.append('acepto', String(acepto));
    setEnviando(true);
    const r = await enviar(nuevo ? '/api/trabajo/postulante/registro' : '/api/trabajo/postulante/perfil', f);
    setEnviando(false);
    if (!r) return;
    toast(nuevo ? '¡Listo! Tu CV ya está publicado.' : 'Cambios guardados.');
    setCv(null);
    setClave('');
    if (volverA) router.push(volverA);
    router.refresh();
  }

  return (
    <form className="bt-form" onSubmit={guardar} noValidate>
      <fieldset>
        <legend>Tus datos</legend>
        <div className="bt-campo"><label htmlFor="pNombre">Nombre y apellido</label>
          <input id="pNombre" autoComplete="name" value={v.nombre} onChange={(e) => set('nombre', e.target.value)} maxLength={120} required /></div>
        <div className="bt-dos">
          <div className="bt-campo"><label htmlFor="pNac">Fecha de nacimiento</label>
            <input id="pNac" type="date" min="1930-01-01" max={maxNac} value={v.nacimiento} onChange={(e) => set('nacimiento', e.target.value)} required /></div>
          <div className="bt-campo"><label htmlFor="pWa">WhatsApp</label>
            <input id="pWa" type="tel" inputMode="tel" autoComplete="tel" placeholder="261 555 1234" value={v.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} maxLength={20} required /></div>
        </div>
        <div className="bt-campo"><label htmlFor="pMail">Mail</label>
          <input id="pMail" type="email" autoComplete="email" placeholder="nombre@mail.com" value={v.mail} onChange={(e) => set('mail', e.target.value)} maxLength={200} required />
          {nuevo && <p className="bt-ayuda">Con este mail y tu clave vas a poder entrar para actualizar tu CV.</p>}</div>
      </fieldset>

      <fieldset>
        <legend>Dónde vivís</legend>
        <div className="bt-campo"><label htmlFor="pDir">Dirección</label>
          <input id="pDir" autoComplete="street-address" placeholder="Calle y número" value={v.direccion} onChange={(e) => set('direccion', e.target.value)} maxLength={150} required /></div>
        <div className="bt-dos">
          <div className="bt-campo"><label htmlFor="pLoc">Localidad o barrio</label>
            <input id="pLoc" placeholder="Ej.: Chacras de Coria" value={v.localidad} onChange={(e) => set('localidad', e.target.value)} maxLength={80} /></div>
          <div className="bt-campo"><label htmlFor="pDep">Departamento</label>
            <select id="pDep" value={v.departamento} onChange={(e) => set('departamento', e.target.value)} required>
              <option value="">Elegí…</option>
              {DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}
            </select></div>
        </div>
      </fieldset>

      <fieldset>
        <legend>Qué trabajo buscás</legend>
        <div className="bt-campo"><label htmlFor="pPuesto">Puesto que buscás</label>
          <select id="pPuesto" value={v.puesto} onChange={(e) => set('puesto', e.target.value)} required>
            <option value="">Elegí…</option>
            {PUESTOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select></div>
        <div className="bt-dos">
          {[0, 1].map((i) => (
            <div className="bt-campo" key={i}><label htmlFor={`pExtra${i}`}>Otro puesto (opcional)</label>
              <select id={`pExtra${i}`} value={extra(i)} onChange={(e) => setExtra(i, e.target.value)} disabled={i === 1 && !extra(0)}>
                <option value="">—</option>
                {PUESTOS.filter(([k]) => k !== v.puesto && k !== extra(1 - i)).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select></div>
          ))}
        </div>
        {pideOtro && (
          <div className="bt-campo"><label htmlFor="pOtro">¿Qué otro puesto?</label>
            <input id="pOtro" value={v.puesto_otro} onChange={(e) => set('puesto_otro', e.target.value)} maxLength={60} /></div>
        )}
        <div className="bt-dos">
          <div className="bt-campo"><label htmlFor="pActual">Puesto actual o último</label>
            <input id="pActual" placeholder="Ej.: Cocinero en Hotel Aconcagua" value={v.puesto_actual} onChange={(e) => set('puesto_actual', e.target.value)} maxLength={120} /></div>
          <div className="bt-campo"><label htmlFor="pExp">Años de experiencia</label>
            <select id="pExp" value={v.experiencia} onChange={(e) => set('experiencia', Number(e.target.value))}>
              <option value={0}>Sin experiencia</option>
              {Array.from({ length: 30 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n === 30 ? '30 o más' : n === 1 ? '1 año' : `${n} años`}</option>)}
            </select></div>
        </div>
        <div className="bt-campo"><span className="bt-label">Disponibilidad</span>
          <Chips nombre="Disponibilidad" opciones={DISPONIBILIDAD} valor={v.disponibilidad} cambiar={(x) => set('disponibilidad', x)} /></div>
        <div className="bt-campo"><span className="bt-label">Idiomas</span>
          <Chips nombre="Idiomas" opciones={IDIOMAS} valor={v.idiomas} cambiar={(x) => set('idiomas', x)} /></div>
        <label className="bt-check"><input type="checkbox" checked={v.movilidad} onChange={(e) => set('movilidad', e.target.checked)} /> Tengo movilidad propia</label>
        <div className="bt-campo"><label htmlFor="pSobre">Contá algo de vos (opcional)</label>
          <textarea id="pSobre" rows={3} value={v.sobre_mi} onChange={(e) => set('sobre_mi', e.target.value)} maxLength={600} placeholder="Experiencia, cursos, lo que te gusta hacer…" />
          <p className="bt-ayuda">{v.sobre_mi.length}/600</p></div>
      </fieldset>

      <fieldset>
        <legend>Tu CV</legend>
        <label className="bt-archivo">
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e) => setCv(e.target.files?.[0] ?? null)} />
          <span>{cv ? cv.name : tieneCv ? 'Cambiar el CV' : 'Elegí tu CV (PDF o foto)'}</span>
        </label>
        <p className="bt-ayuda">PDF, JPG o PNG de hasta 5 MB. Desde el celular podés sacarle una foto a tu CV impreso.
          {tieneCv && idCv && <> · <a className="bt-link" href={`/api/trabajo/cv/${idCv}`} target="_blank" rel="noopener noreferrer">Ver el CV cargado</a></>}</p>
      </fieldset>

      <fieldset>
        <legend>{nuevo ? 'Tu clave' : 'Cuenta'}</legend>
        <div className="bt-campo"><label htmlFor="pClave">{nuevo ? 'Elegí una clave' : 'Nueva clave (dejalo vacío para no cambiarla)'}</label>
          <input id="pClave" type="password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} maxLength={100} />
          {nuevo && <p className="bt-ayuda">Al menos {CLAVE_MIN} caracteres. Anotala: la vas a necesitar para entrar.</p>}</div>
        {!nuevo && (
          <label className="bt-check"><input type="checkbox" checked={v.visible} onChange={(e) => set('visible', e.target.checked)} /> Mostrar mi CV a los hoteles y restaurantes (destildalo si ya conseguiste trabajo)</label>
        )}
        {nuevo && (
          <label className="bt-check"><input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} />
            <span>Acepto que mis datos y mi CV los vean los hoteles, restaurantes y demás empresas registradas en el Banco de Trabajo de AEHGA, para ofrecerme trabajo. Puedo pausar o borrar mi perfil cuando quiera (Ley 25.326).</span></label>
        )}
      </fieldset>

      <button className="bt-btn" type="submit" disabled={enviando}>{enviando ? 'Guardando…' : nuevo ? 'Publicar mi CV' : 'Guardar cambios'}</button>
    </form>
  );
}

export function BorrarPerfil() {
  const router = useRouter();
  return (
    <button type="button" className="bt-link peligro" onClick={async () => {
      if (!confirm('¿Borrar tu perfil, tu CV y tus postulaciones? No se puede deshacer.')) return;
      if (await enviar('/api/trabajo/postulante/baja')) { toast('Tu perfil se borró.'); router.push('/trabajo'); router.refresh(); }
    }}>Borrar mi perfil</button>
  );
}
