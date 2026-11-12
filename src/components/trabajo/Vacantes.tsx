'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DEPARTAMENTOS, PUESTOS, JORNADAS, ESTADOS_POSTULACION } from '@/lib/trabajo';
import { toast } from '../Toast';
import { enviar } from './Comun';

export type ValoresVacante = { id?: string; puesto: string; titulo: string; descripcion: string; departamento: string; jornada: string; sueldo: string };

export function FormVacante({ inicial, alGuardar }: { inicial: ValoresVacante; alGuardar?: string }) {
  const router = useRouter();
  const [v, setV] = useState(inicial);
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof ValoresVacante, x: string) => setV((o) => ({ ...o, [k]: x }));
  return (
    <form className="bt-form" noValidate onSubmit={async (e) => {
      e.preventDefault();
      setEnviando(true);
      const r = await enviar('/api/trabajo/empresa/vacante', v);
      setEnviando(false);
      if (!r) return;
      toast(v.id ? 'Vacante actualizada.' : '¡Vacante publicada!');
      if (!v.id) setV({ ...inicial });
      if (alGuardar) router.push(alGuardar);
      router.refresh();
    }}>
      <fieldset>
        <legend>{v.id ? 'Editar la vacante' : 'Publicar una vacante'}</legend>
        <div className="bt-dos">
          <div className="bt-campo"><label htmlFor="vPuesto">Puesto</label>
            <select id="vPuesto" value={v.puesto} onChange={(e) => set('puesto', e.target.value)} required>
              <option value="">Elegí…</option>
              {PUESTOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select></div>
          <div className="bt-campo"><label htmlFor="vJor">Jornada</label>
            <select id="vJor" value={v.jornada} onChange={(e) => set('jornada', e.target.value)} required>
              <option value="">Elegí…</option>
              {JORNADAS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select></div>
        </div>
        <div className="bt-campo"><label htmlFor="vTit">Título</label>
          <input id="vTit" placeholder="Ej.: Mozo/a para turno noche" value={v.titulo} onChange={(e) => set('titulo', e.target.value)} maxLength={100} required /></div>
        <div className="bt-dos">
          <div className="bt-campo"><label htmlFor="vDep">Departamento</label>
            <select id="vDep" value={v.departamento} onChange={(e) => set('departamento', e.target.value)} required>
              <option value="">Elegí…</option>
              {DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}
            </select></div>
          <div className="bt-campo"><label htmlFor="vSueldo">Sueldo (opcional)</label>
            <input id="vSueldo" placeholder="Ej.: A convenir · $900.000" value={v.sueldo} onChange={(e) => set('sueldo', e.target.value)} maxLength={80} /></div>
        </div>
        <div className="bt-campo"><label htmlFor="vDesc">Descripción</label>
          <textarea id="vDesc" rows={5} placeholder="Tareas, horarios, requisitos, qué ofrecen…" value={v.descripcion} onChange={(e) => set('descripcion', e.target.value)} maxLength={2000} /></div>
      </fieldset>
      <button className="bt-btn" type="submit" disabled={enviando}>{enviando ? 'Guardando…' : v.id ? 'Guardar cambios' : 'Publicar vacante'}</button>
    </form>
  );
}

export function AccionesVacante({ id, abierta }: { id: string; abierta: boolean }) {
  const router = useRouter();
  const hacer = async (accion: string, msj: string) => {
    if (accion === 'borrar' && !confirm('¿Borrar la vacante y sus postulaciones? No se puede deshacer.')) return;
    if (await enviar('/api/trabajo/empresa/vacante', { id, accion })) {
      toast(msj);
      if (accion === 'borrar') router.push('/trabajo/empresa?tab=vacantes');
      router.refresh();
    }
  };
  return (
    <div className="bt-acciones">
      {abierta
        ? <button type="button" className="bt-btn chico linea" onClick={() => hacer('cerrar', 'La vacante se cerró: ya no recibe postulaciones.')}>Cerrar vacante</button>
        : <button type="button" className="bt-btn chico linea" onClick={() => hacer('abrir', 'La vacante volvió a abrirse.')}>Volver a abrir</button>}
      <button type="button" className="bt-link peligro" onClick={() => hacer('borrar', 'Vacante borrada.')}>Borrar</button>
    </div>
  );
}

export function EstadoPostulacion({ vacante, postulante, estado }: { vacante: string; postulante: string; estado: string }) {
  const router = useRouter();
  const [v, setV] = useState(estado);
  return (
    <select className={`bt-estado e-${v}`} aria-label="Estado de la postulación" value={v} onChange={async (e) => {
      const nuevo = e.target.value;
      setV(nuevo);
      if (!(await enviar('/api/trabajo/empresa/postulacion', { vacante, postulante, estado: nuevo }))) setV(v);
      else router.refresh();
    }}>
      {ESTADOS_POSTULACION.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
    </select>
  );
}

export function Postularme({ vacante, conSesion, yaPostulado }: { vacante: string; conSesion: boolean; yaPostulado: boolean }) {
  const router = useRouter();
  const [mensaje, setMensaje] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(yaPostulado);
  if (listo) return <p className="bt-ok">✓ Ya te postulaste. La empresa ve tu CV y te va a contactar por WhatsApp o mail.</p>;
  if (!conSesion)
    return (
      <div className="bt-cta">
        <p>Para postularte necesitás tu perfil con el CV cargado.</p>
        <Link className="bt-btn" href={`/trabajo/postulante?vacante=${vacante}`}>Cargar mi CV y postularme</Link>
      </div>
    );
  return (
    <form className="bt-form" onSubmit={async (e) => {
      e.preventDefault();
      setEnviando(true);
      const r = await enviar('/api/trabajo/postular', { vacante, mensaje });
      setEnviando(false);
      if (r) { setListo(true); toast('¡Te postulaste!'); router.refresh(); }
    }}>
      <div className="bt-campo"><label htmlFor="pMsj">Mensaje para la empresa (opcional)</label>
        <textarea id="pMsj" rows={3} maxLength={500} value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Contá por qué te interesa o cuándo podés empezar." /></div>
      <button className="bt-btn" type="submit" disabled={enviando}>{enviando ? 'Enviando…' : 'Postularme con mi CV'}</button>
    </form>
  );
}

export function OcultarAdmin({ tipo, id, oculto }: { tipo: 'postulante' | 'empresa' | 'vacante'; id: string; oculto: boolean }) {
  const router = useRouter();
  return (
    <button type="button" className="link" onClick={async () => {
      if (await enviar('/api/admin/trabajo', { tipo, id, ocultar: !oculto })) { toast(oculto ? 'Visible otra vez.' : 'Oculto.'); router.refresh(); }
    }}>{oculto ? 'Mostrar' : 'Ocultar'}</button>
  );
}
