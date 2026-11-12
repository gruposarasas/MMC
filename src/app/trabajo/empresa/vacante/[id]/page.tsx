import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/supabase';
import { empresaActual, vacante, postulantesDeVacante } from '@/lib/trabajo-servidor';
import { TarjetaPostulante } from '@/components/trabajo/Tarjetas';
import { FormVacante, AccionesVacante, EstadoPostulacion } from '@/components/trabajo/Vacantes';
import { fechaCorta } from '@/components/trabajo/fechas';

export const dynamic = 'force-dynamic';

export default async function VacanteEmpresa({ params }: { params: Promise<{ id: string }> }) {
  const e = await empresaActual();
  if (!e) redirect('/trabajo/empresa');
  const { id } = await params;
  const v = await vacante(id);
  if (!v || v.empresa_id !== e.id) notFound();
  const ps = await postulantesDeVacante(v.id);
  // Abrir la vacante marca como vistas las postulaciones nuevas.
  if (ps.some((x) => x.estado === 'nueva')) await db().from('tb_postulaciones').update({ estado: 'vista' }).eq('vacante_id', v.id).eq('estado', 'nueva');
  return (
    <section>
      <p><Link className="bt-link" href="/trabajo/empresa?tab=vacantes">← Mis vacantes</Link></p>
      <div className="bt-titulo">
        <div>
          <h1 className="bt-h1" style={{ marginBottom: 0 }}>{v.titulo}</h1>
          <p className="bt-meta">{v.abierta ? 'Abierta' : 'Cerrada'} · publicada {fechaCorta(v.created_at)} · <Link className="bt-link" href={`/trabajo/vacantes/${v.id}`}>ver como la ven los postulantes</Link></p>
        </div>
        <AccionesVacante id={v.id} abierta={v.abierta} />
      </div>
      <div className="bt-columnas">
        <div>
          <h2 className="bt-h2">Postulantes · {ps.length}</h2>
          {ps.length ? (
            <div className="bt-grilla una">
              {ps.map((x) => (
                <div key={x.p.id}>
                  <TarjetaPostulante p={x.p} para={v.titulo} extra={<EstadoPostulacion vacante={v.id} postulante={x.p.id} estado={x.estado === 'nueva' ? 'vista' : x.estado} />} />
                  {x.mensaje && <p className="bt-mensaje">“{x.mensaje}” <span>· {fechaCorta(x.cuando)}</span></p>}
                </div>
              ))}
            </div>
          ) : <p className="bt-vacio">Todavía no se postuló nadie. Mientras tanto podés <Link className="bt-link" href={`/trabajo/empresa?puesto=${v.puesto}`}>buscar CVs de este puesto</Link>.</p>}
        </div>
        <div>
          <FormVacante alGuardar={`/trabajo/empresa/vacante/${v.id}`} inicial={{ id: v.id, puesto: v.puesto, titulo: v.titulo, descripcion: v.descripcion, departamento: v.departamento, jornada: v.jornada, sueldo: v.sueldo }} />
        </div>
      </div>
    </section>
  );
}
