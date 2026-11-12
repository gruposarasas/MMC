import Link from 'next/link';
import { empresaActual, buscarPostulantes, vacantesDeEmpresa, POR_PAGINA } from '@/lib/trabajo-servidor';
import { DEPARTAMENTOS, PUESTOS, DISPONIBILIDAD, IDIOMAS, leerFiltros, nombrePuesto, nombreDisp, type Filtros } from '@/lib/trabajo';
import { AccesoEmpresa } from '@/components/trabajo/Acceso';
import { Salir } from '@/components/trabajo/Comun';
import { TarjetaPostulante } from '@/components/trabajo/Tarjetas';
import { FormVacante } from '@/components/trabajo/Vacantes';
import { fechaCorta } from '@/components/trabajo/fechas';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Busco personal · Banco de Trabajo AEHGA' };

type SP = Record<string, string | string[] | undefined>;

export default async function Empresa({ searchParams }: { searchParams: Promise<SP> }) {
  const e = await empresaActual();
  if (!e)
    return (
      <section className="bt-angosto">
        <h1 className="bt-h1">Busco personal</h1>
        <p className="bt-lead">Registrá tu hotel, restaurante o bar para buscar entre los CV cargados y publicar vacantes. Es gratis.</p>
        <AccesoEmpresa />
      </section>
    );
  const sp = await searchParams;
  const tab = sp.tab === 'vacantes' ? 'vacantes' : 'buscar';
  return (
    <section>
      <div className="bt-titulo">
        <div>
          <h1 className="bt-h1" style={{ marginBottom: 0 }}>{e.nombre}</h1>
          <p className="bt-meta">{e.contacto} · {e.departamento}</p>
        </div>
        <Salir url="/api/trabajo/empresa/salir" />
      </div>
      <nav className="bt-tabs" aria-label="Secciones">
        <Link href="/trabajo/empresa" className={tab === 'buscar' ? 'on' : ''}>Buscar personal</Link>
        <Link href="/trabajo/empresa?tab=vacantes" className={tab === 'vacantes' ? 'on' : ''}>Mis vacantes</Link>
      </nav>
      {tab === 'buscar' ? await Buscar(leerFiltros(sp)) : await MisVacantes(e.id)}
    </section>
  );
}

function urlCon(f: Filtros, cambios: Partial<Filtros>) {
  const x = { ...f, ...cambios };
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(x)) if (v && !(k === 'pag' && v === 1)) u.set(k, String(v));
  return `/trabajo/empresa?${u}`;
}

async function Buscar(f: Filtros) {
  const { total, filas } = await buscarPostulantes(f);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const edades = Array.from({ length: 60 }, (_, i) => i + 16);
  return (
    <>
      <form className="bt-filtros grande" method="get" action="/trabajo/empresa">
        <input name="q" defaultValue={f.q} placeholder="Buscar: nombre, barrio, experiencia…" aria-label="Buscar" className="ancho" />
        <select name="puesto" defaultValue={f.puesto} aria-label="Puesto">
          <option value="">Todos los puestos</option>
          {PUESTOS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
        <select name="dep" defaultValue={f.dep} aria-label="Departamento">
          <option value="">Toda Mendoza</option>
          {DEPARTAMENTOS.map((d) => <option key={d}>{d}</option>)}
        </select>
        <details className="bt-mas" open={!!(f.edadMin || f.edadMax || f.exp || f.disp || f.idioma || f.mov)}>
          <summary>Más filtros: edad, experiencia, disponibilidad, idiomas</summary>
          <div className="bt-mas-in">
          <div className="bt-edad">
            <select name="edadMin" defaultValue={f.edadMin} aria-label="Edad desde">
              <option value="">Edad desde</option>
              {edades.map((n) => <option key={n} value={n}>{n} años</option>)}
            </select>
            <select name="edadMax" defaultValue={f.edadMax} aria-label="Edad hasta">
              <option value="">hasta</option>
              {edades.map((n) => <option key={n} value={n}>{n} años</option>)}
            </select>
          </div>
          <select name="exp" defaultValue={f.exp} aria-label="Experiencia">
            <option value="">Cualquier experiencia</option>
            {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n === 1 ? 'Al menos 1 año' : `Al menos ${n} años`}</option>)}
          </select>
          <select name="disp" defaultValue={f.disp} aria-label="Disponibilidad">
            <option value="">Cualquier disponibilidad</option>
            {DISPONIBILIDAD.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
          <select name="idioma" defaultValue={f.idioma} aria-label="Idioma">
            <option value="">Cualquier idioma</option>
            {IDIOMAS.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
          </select>
          <label className="bt-check chico"><input type="checkbox" name="mov" value="1" defaultChecked={!!f.mov} /> Con movilidad</label>
          </div>
        </details>
        <button className="bt-btn chico" type="submit">Buscar</button>
        <Link className="bt-link" href="/trabajo/empresa">Limpiar</Link>
      </form>
      <p className="bt-meta">{total === 1 ? '1 persona' : `${total.toLocaleString('es-AR')} personas`}{f.puesto ? ` para ${nombrePuesto(f.puesto)}` : ''}{f.dep ? ` en ${f.dep}` : ''}</p>
      {filas.length ? (
        <div className="bt-grilla">{filas.map((p) => <TarjetaPostulante key={p.id} p={p} />)}</div>
      ) : <p className="bt-vacio">No hay CV con esos filtros. Probá sacando alguno.</p>}
      {paginas > 1 && (
        <nav className="bt-paginas" aria-label="Páginas">
          {f.pag > 1 && <Link href={urlCon(f, { pag: f.pag - 1 })}>← Anterior</Link>}
          <span>Página {f.pag} de {paginas}</span>
          {f.pag < paginas && <Link href={urlCon(f, { pag: f.pag + 1 })}>Siguiente →</Link>}
        </nav>
      )}
    </>
  );
}

async function MisVacantes(empresaId: string) {
  const vs = await vacantesDeEmpresa(empresaId);
  return (
    <div className="bt-columnas">
      <div>
        <h2 className="bt-h2">Tus vacantes</h2>
        {vs.length ? (
          <ul className="bt-lista">
            {vs.map((v) => (
              <li key={v.id}>
                <Link href={`/trabajo/empresa/vacante/${v.id}`}><b>{v.titulo}</b></Link>
                <span>{nombrePuesto(v.puesto)} · {nombreDisp(v.jornada)} · {fechaCorta(v.created_at)}{v.abierta ? '' : ' · cerrada'}{v.oculta ? ' · oculta por AEHGA' : ''}</span>
                <em className={v.nuevas ? 'e-nueva' : ''}>{v.postulantes === 1 ? '1 postulante' : `${v.postulantes} postulantes`}{v.nuevas ? ` · ${v.nuevas} sin ver` : ''}</em>
              </li>
            ))}
          </ul>
        ) : <p className="bt-vacio">Todavía no publicaste vacantes.</p>}
      </div>
      <div>
        <FormVacante inicial={{ puesto: '', titulo: '', descripcion: '', departamento: '', jornada: '', sueldo: '' }} />
      </div>
    </div>
  );
}
