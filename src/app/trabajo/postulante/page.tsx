import Link from 'next/link';
import { postulanteActual, postulacionesDe } from '@/lib/trabajo-servidor';
import { nombrePuesto } from '@/lib/trabajo';
import { AccesoPostulante } from '@/components/trabajo/Acceso';
import { FormPostulante, BorrarPerfil } from '@/components/trabajo/FormPostulante';
import { Salir } from '@/components/trabajo/Comun';
import { fechaCorta } from '@/components/trabajo/fechas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Busco trabajo · Banco de Trabajo AEHGA' };

const ESTADO: Record<string, string> = { nueva: 'Enviada', vista: 'Vista por la empresa', contactado: 'Te contactaron', descartado: 'No seleccionado' };

export default async function Postulante({ searchParams }: { searchParams: Promise<{ vacante?: string }> }) {
  const { vacante } = await searchParams;
  const volverA = vacante && /^[0-9a-f-]{36}$/i.test(vacante) ? `/trabajo/vacantes/${vacante}` : undefined;
  const p = await postulanteActual();
  if (!p)
    return (
      <section className="bt-angosto">
        <h1 className="bt-h1">Busco trabajo</h1>
        <p className="bt-lead">Cargá tu CV una sola vez: los hoteles y restaurantes de Mendoza lo van a poder ver y te van a escribir por WhatsApp o mail.</p>
        <AccesoPostulante volverA={volverA} />
      </section>
    );

  const ps = await postulacionesDe(p.id);
  return (
    <section className="bt-angosto">
      <div className="bt-titulo">
        <h1 className="bt-h1">Hola, {p.nombre.split(' ')[0]}</h1>
        <Salir url="/api/trabajo/postulante/salir" />
      </div>
      {p.oculto ? <p className="bt-aviso">Tu perfil está suspendido y las empresas no lo ven. Comunicate con AEHGA.</p>
        : p.visible ? <p className="bt-ok">✓ Tu CV está publicado como <b>{nombrePuesto(p.puesto)}</b> en {p.departamento}.</p>
        : <p className="bt-aviso">Tu CV está pausado: las empresas no lo ven. Tildá &quot;Mostrar mi CV&quot; para volver a publicarlo.</p>}

      <div className="bt-bloque">
        <div className="bt-titulo"><h2>Mis postulaciones</h2><Link className="bt-link" href="/trabajo/vacantes">Ver vacantes →</Link></div>
        {ps.length ? (
          <ul className="bt-lista">
            {ps.filter((x) => x.v).map((x) => (
              <li key={x.v!.id}>
                <Link href={`/trabajo/vacantes/${x.v!.id}`}><b>{x.v!.titulo}</b></Link>
                <span>{x.v!.empresa?.nombre} · {fechaCorta(x.cuando)}{x.v!.abierta ? '' : ' · cerrada'}</span>
                <em className={`e-${x.estado}`}>{ESTADO[x.estado] ?? x.estado}</em>
              </li>
            ))}
          </ul>
        ) : <p className="bt-vacio">Todavía no te postulaste a ninguna vacante.</p>}
      </div>

      <h2 className="bt-h2">Mi perfil y mi CV</h2>
      <FormPostulante
        nuevo={false}
        tieneCv={!!p.cv_path}
        idCv={p.id}
        inicial={{
          nombre: p.nombre, nacimiento: p.nacimiento, mail: p.mail, whatsapp: p.whatsapp, direccion: p.direccion, localidad: p.localidad,
          departamento: p.departamento, puesto: p.puesto, puestos_extra: p.puestos_extra, puesto_otro: p.puesto_otro, puesto_actual: p.puesto_actual,
          experiencia: p.experiencia, disponibilidad: p.disponibilidad, idiomas: p.idiomas, movilidad: p.movilidad, sobre_mi: p.sobre_mi, visible: p.visible,
        }}
      />
      <p style={{ marginTop: 24 }}><BorrarPerfil /></p>
    </section>
  );
}
