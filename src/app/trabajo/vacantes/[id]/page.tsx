import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db } from '@/lib/supabase';
import { vacante, postulanteActual } from '@/lib/trabajo-servidor';
import { nombrePuesto, nombreDisp, nombreTipo } from '@/lib/trabajo';
import { Postularme } from '@/components/trabajo/Vacantes';
import { fechaCorta } from '@/components/trabajo/fechas';

export const dynamic = 'force-dynamic';

export default async function Vacante({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await vacante(id);
  if (!v || v.oculta || v.empresa?.oculta) notFound();
  const p = await postulanteActual();
  const ya = p ? !!(await db().from('tb_postulaciones').select('vacante_id').eq('vacante_id', v.id).eq('postulante_id', p.id).maybeSingle()).data : false;
  return (
    <section className="bt-angosto">
      <p><Link className="bt-link" href="/trabajo/vacantes">← Todas las vacantes</Link></p>
      <span className="bt-tag">{nombrePuesto(v.puesto)}</span>
      <h1 className="bt-h1">{v.titulo}</h1>
      <p className="bt-meta">{v.empresa?.nombre} · {nombreTipo(v.empresa?.tipo || '')} · {v.departamento}</p>
      <ul className="bt-datos grande">
        <li><b>Jornada:</b> {nombreDisp(v.jornada)}</li>
        {v.sueldo && <li><b>Sueldo:</b> {v.sueldo}</li>}
        <li><b>Publicada:</b> {fechaCorta(v.created_at)}</li>
      </ul>
      {v.descripcion && <div className="bt-texto">{v.descripcion}</div>}
      {v.abierta ? <Postularme vacante={v.id} conSesion={!!p} yaPostulado={ya} /> : <p className="bt-vacio">Esta vacante ya está cerrada.</p>}
    </section>
  );
}
