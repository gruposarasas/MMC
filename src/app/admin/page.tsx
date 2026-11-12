import Link from 'next/link';
import { esAdmin, resumenAdmin, todasLasMarcas, todosLosCanjes, todosLosVisitantes } from '@/lib/datos';
import { urlLogo } from '@/lib/config';
import { diaHora, edad, fDMY, numCanje } from '@/lib/formato';
import recursos from '@/lib/recursos.json';
import { EntrarAdmin, SalirAdmin } from '@/components/admin/Comun';
import { AdminMarcas } from '@/components/admin/Marcas';
import { AdminVisitantes } from '@/components/admin/Visitantes';
import { AdminCanjes } from '@/components/admin/Canjes';
import { MensajesAdmin } from '@/components/admin/Votaciones';
import { Emb } from '@/components/Emb';
import { FotoBarista } from '@/components/Secciones';
import { rankingStand, rankingBarista, mensajes } from '@/lib/votos';
import { votosAbiertos } from '@/lib/config';
import { resumenTrabajo, listasAdminTrabajo } from '@/lib/trabajo-servidor';
import { nombrePuesto, nombreTipo } from '@/lib/trabajo';
import { OcultarAdmin } from '@/components/trabajo/Vacantes';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Back office · Mundial de Café' };

const TABS = [['resumen', 'Resumen'], ['marcas', 'Beneficios'], ['visitantes', 'Visitantes'], ['canjes', 'Canjes'], ['votos', 'Votaciones'], ['trabajo', 'Banco de trabajo']] as const;
type Tab = (typeof TABS)[number][0];

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if (!(await esAdmin())) return <EntrarAdmin />;
  const { tab: t } = await searchParams;
  const tab: Tab = (TABS.map((x) => x[0]) as string[]).includes(t || '') ? (t as Tab) : 'resumen';

  return (
    <div className="bo">
      <nav aria-label="Secciones">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={recursos.logo} alt="Mundial de Café" />
        {TABS.map(([k, n]) => (
          <Link key={k} href={`/admin?tab=${k}`} className={tab === k ? 'on' : ''} aria-current={tab === k ? 'page' : undefined}>{n}</Link>
        ))}
        <Link href="/admin/carteles">Carteles</Link>
        <Link href="/sorteo">Sorteo</Link>
        <Link href="/admin/baristas">Baristas</Link>
        <SalirAdmin />
      </nav>
      <section>{await Seccion({ tab })}</section>
    </div>
  );
}

async function Seccion({ tab }: { tab: Tab }) {
  if (tab === 'resumen') {
    const r = await resumenAdmin();
    const max = Math.max(1, ...r.ranking.map((x) => x.canjes));
    return (
      <>
        <h1>Resumen del Mundial</h1>
        <p className="sub">Se actualiza con cada registro y cada canje. Recargá la página para ver lo último.</p>
        <div className="stats">
          <div className="tarj stat"><b>{r.visitantes}</b><span>visitantes registrados</span></div>
          <div className="tarj stat"><b>{r.canjes}</b><span>beneficios usados</span></div>
          <div className="tarj stat"><b>{r.visitantes ? Math.round((r.con_canje / r.visitantes) * 100) : 0}%</b><span>de los registrados usó al menos uno</span></div>
          <div className="tarj stat"><b>{r.post_evento}</b><span>canjes en sucursales después del Mundial</span></div>
        </div>
        <div className="tarj" style={{ marginTop: 14 }}>
          <h2 style={{ margin: 0, fontSize: 17, color: 'var(--arena)' }}>Canjes por cafetería</h2>
          <div className="barras">
            {r.ranking.map((m) => (
              <div className="barra" key={m.id}>
                <span>{m.nombre}</span>
                <i style={{ width: `${Math.max(2, (m.canjes / max) * 100)}%` }} />
                <em>{m.canjes}</em>
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (tab === 'marcas') {
    const [ms, r] = await Promise.all([todasLasMarcas(), resumenAdmin()]);
    const n = new Map(r.ranking.map((x) => [x.id, x.canjes]));
    return (
      <AdminMarcas
        marcas={ms.filter((m) => !m.eliminada).map((m) => ({
          id: m.id, nombre: m.nombre, stand: m.stand, beneficio: m.beneficio, condiciones: m.condiciones, creditos: m.creditos,
          codigo: m.codigo, clave: m.clave, emblema: m.emblema, activa: m.activa, en_votacion: m.en_votacion, vence: m.vence, sucursales: m.sucursales,
          responsable: m.responsable, tel_responsable: m.tel_responsable, enviado_at: m.enviado_at, logoUrl: urlLogo(m.logo_path), canjes: n.get(m.id) || 0,
        }))}
      />
    );
  }

  if (tab === 'visitantes') {
    const [vs, cs] = await Promise.all([todosLosVisitantes(), todosLosCanjes()]);
    const n = new Map<string, number>();
    for (const c of cs) n.set(c.visitante_id, (n.get(c.visitante_id) || 0) + 1);
    return (
      <AdminVisitantes
        filas={vs.map((v) => ({
          id: v.id, nombre: v.nombre, nac: v.nacimiento, nacTxt: fDMY(v.nacimiento), edad: edad(v.nacimiento),
          mail: v.mail || '', wa: v.whatsapp || '', registro: v.created_at, registroTxt: diaHora(v.created_at),
          canjes: n.get(v.id) || 0, novedades: v.novedades,
        }))}
      />
    );
  }

  if (tab === 'votos') {
    const [st, ba, msj] = await Promise.all([rankingStand(), rankingBarista(), mensajes(undefined, true)]);
    const abierto = votosAbiertos();
    const maxS = Math.max(1, st.filas[0]?.votos || 0);
    const maxB = Math.max(1, ba.filas[0]?.votos || 0);
    return (
      <>
        <h1>Votaciones del público</h1>
        <p className="sub">
          Cada visitante vota una sola vez en cada una. {abierto ? `Se vota hasta el domingo 4 a las 20 hs; desde ese momento los ganadores se ven en la app.` : 'La votación cerró: los ganadores ya se ven en la app.'} Recargá para ver lo último.
        </p>
        <div className="stats" style={{ gridTemplateColumns: 'repeat(2,1fr)' }}>
          <div className="tarj stat">
            <b>{st.total}</b><span>votos al stand más lindo</span>
            {st.ganadores.length > 0 && <p style={{ margin: '8px 0 0' }}>{abierto ? 'Va ganando' : 'Ganó'}: <b style={{ display: 'inline', fontSize: 16 }}>{st.ganadores.map((g) => g.nombre).join(' y ')}</b>{st.ganadores.length > 1 ? ' (empate)' : ''}</p>}
          </div>
          <div className="tarj stat">
            <b>{ba.total}</b><span>votos al barista favorito</span>
            {ba.ganadores.length > 0 && <p style={{ margin: '8px 0 0' }}>{abierto ? 'Va ganando' : 'Ganó'}: <b style={{ display: 'inline', fontSize: 16 }}>{ba.ganadores.map((g) => g.nombre).join(' y ')}</b>{ba.ganadores.length > 1 ? ' (empate)' : ''}</p>}
          </div>
        </div>
        <div className="dos-col">
          <div className="tarj" style={{ marginTop: 14 }}>
            <h2 style={{ margin: 0, fontSize: 17, color: 'var(--arena)' }}>Stand más lindo</h2>
            <div className="barras">
              {st.filas.map((m, i) => (
                <div className="barra voto" key={m.id}>
                  <span><Emb logoUrl={m.logo} emblema={m.emblema} nombre={m.nombre} t={26} /> {i + 1}. {m.nombre}</span>
                  <i style={{ width: `${Math.max(2, (m.votos / maxS) * 100)}%` }} />
                  <em>{m.votos}</em>
                </div>
              ))}
            </div>
          </div>
          <div className="tarj" style={{ marginTop: 14 }}>
            <h2 style={{ margin: 0, fontSize: 17, color: 'var(--arena)' }}>Barista favorito</h2>
            <div className="barras">
              {ba.filas.map((b, i) => (
                <div className="barra voto" key={b.id}>
                  <span><FotoBarista foto={b.foto} nombre={b.nombre} t={26} /> {i + 1}. {b.nombre}</span>
                  <i style={{ width: `${Math.max(2, (b.votos / maxB) * 100)}%` }} />
                  <em>{b.votos}</em>
                </div>
              ))}
              {!ba.filas.length && <p>Todavía no hay baristas cargados.</p>}
            </div>
          </div>
        </div>
        <MensajesAdmin inicial={msj.map((m) => ({ ...m, cuando: diaHora(m.cuando) }))} />
      </>
    );
  }

  if (tab === 'trabajo') {
    const [r, l] = await Promise.all([resumenTrabajo(), listasAdminTrabajo()]);
    return (
      <>
        <h1>Banco de trabajo AEHGA</h1>
        <p className="sub">
          Página pública: <a className="link" href="/trabajo" target="_blank" rel="noopener noreferrer">/trabajo</a>. Postulantes y empresas se registran solos; desde acá podés ocultar a quien no corresponda.
        </p>
        <div className="stats">
          <div className="tarj stat"><b>{r.postulantes}</b><span>postulantes ({r.conCv} con CV)</span></div>
          <div className="tarj stat"><b>{r.empresas}</b><span>empresas registradas</span></div>
          <div className="tarj stat"><b>{r.abiertas}</b><span>vacantes abiertas (de {r.vacantes})</span></div>
          <div className="tarj stat"><b>{r.postulaciones}</b><span>postulaciones · {r.vistas} CV abiertos por empresas</span></div>
        </div>
        <h2 style={{ fontSize: 17, color: 'var(--arena)', marginTop: 22 }}>Empresas</h2>
        <div className="tabla"><table>
          <thead><tr><th>Empresa</th><th>Tipo</th><th>Contacto</th><th>Mail · WhatsApp</th><th>Alta</th><th /></tr></thead>
          <tbody>{l.empresas.map((e) => (
            <tr key={e.id} style={{ opacity: e.oculta ? 0.5 : 1 }}>
              <td><b>{e.nombre}</b>{e.cuit ? <><br /><small>CUIT {e.cuit}</small></> : null}</td><td>{nombreTipo(e.tipo)} · {e.departamento}</td><td>{e.contacto}</td>
              <td>{e.mail}<br /><small>{e.whatsapp}</small></td><td>{diaHora(e.created_at)}</td>
              <td><OcultarAdmin tipo="empresa" id={e.id} oculto={e.oculta} /></td>
            </tr>
          ))}</tbody>
        </table></div>
        <h2 style={{ fontSize: 17, color: 'var(--arena)', marginTop: 22 }}>Vacantes</h2>
        <div className="tabla"><table>
          <thead><tr><th>Vacante</th><th>Empresa</th><th>Estado</th><th>Publicada</th><th /></tr></thead>
          <tbody>{l.vacantes.map((v) => (
            <tr key={v.id} style={{ opacity: v.oculta ? 0.5 : 1 }}>
              <td><a className="link" href={`/trabajo/vacantes/${v.id}`} target="_blank" rel="noopener noreferrer">{v.titulo}</a><br /><small>{nombrePuesto(v.puesto)} · {v.departamento}</small></td>
              <td>{v.empresa?.nombre}</td><td>{v.abierta ? 'Abierta' : 'Cerrada'}</td><td>{diaHora(v.created_at)}</td>
              <td><OcultarAdmin tipo="vacante" id={v.id} oculto={v.oculta} /></td>
            </tr>
          ))}</tbody>
        </table></div>
        <h2 style={{ fontSize: 17, color: 'var(--arena)', marginTop: 22 }}>Postulantes</h2>
        <div className="tabla"><table>
          <thead><tr><th>Nombre</th><th>Puesto</th><th>Contacto</th><th>Alta</th><th>CV</th><th /></tr></thead>
          <tbody>{l.postulantes.map((p) => (
            <tr key={p.id} style={{ opacity: p.oculto ? 0.5 : 1 }}>
              <td><b>{p.nombre}</b>{p.visible ? null : <><br /><small>pausado por el postulante</small></>}</td><td>{nombrePuesto(p.puesto)} · {p.departamento}</td>
              <td>{p.mail}<br /><small>{p.whatsapp}</small></td><td>{diaHora(p.created_at)}</td>
              <td>{p.cv_path ? <a className="link" href={`/api/trabajo/cv/${p.id}`} target="_blank" rel="noopener noreferrer">Ver</a> : '—'}</td>
              <td><OcultarAdmin tipo="postulante" id={p.id} oculto={p.oculto} /></td>
            </tr>
          ))}</tbody>
        </table></div>
      </>
    );
  }

  const [cs, ms, vs] = await Promise.all([todosLosCanjes(), todasLasMarcas(), todosLosVisitantes()]);
  const mn = new Map(ms.map((m) => [m.id, m.nombre]));
  const vn = new Map(vs.map((v) => [v.id, v.nombre]));
  return (
    <AdminCanjes
      marcas={ms.map((m) => ({ id: m.id, nombre: m.nombre }))}
      filas={cs.map((c) => ({
        id: c.id, numero: numCanje(c.numero), cuando: diaHora(c.created_at), marcaId: c.marca_id,
        marca: mn.get(c.marca_id) || '', beneficio: c.beneficio, visitante: vn.get(c.visitante_id) || '',
      }))}
    />
  );
}
