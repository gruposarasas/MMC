import { marcaActual, canjesDeMarca } from '@/lib/datos';
import { urlLogo } from '@/lib/config';
import { fDMY, soloEvento, diaHora, fechaCorta, numCanje } from '@/lib/formato';
import { Emb } from '@/components/Emb';
import { EntrarMarca, SalirMarca, FormCupon } from '@/components/PanelMarca';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Panel de tu marca · Mundial de Café' };

export default async function PanelDeMarca() {
  const m = await marcaActual();
  if (!m) return <EntrarMarca />;
  const cs = await canjesDeMarca(m.id);
  const post = cs.filter((c) => c.post_evento).length;
  const logo = urlLogo(m.logo_path);

  return (
    <div className="bo" style={{ gridTemplateColumns: '1fr', maxWidth: 860 }}>
      <section>
        <div className="fila">
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Emb logoUrl={logo} emblema={m.emblema} nombre={m.nombre} t={64} />
            <div>
              <h1>{m.nombre}</h1>
              <p className="sub" style={{ margin: '2px 0 0' }}>{[m.stand, m.beneficio].filter(Boolean).join(' · ')}</p>
            </div>
          </div>
          <SalirMarca />
        </div>
        <div className="stats" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginTop: 18 }}>
          <div className="tarj stat"><b>{cs.length}</b><span>canjes en total</span></div>
          <div className="tarj stat"><b>{cs.length - post}</b><span>durante el Mundial</span></div>
          <div className="tarj stat"><b>{post}</b><span>en tus sucursales, después</span></div>
        </div>
        {m.enviado_at ? (
          <div className="form">
            <div className="fila">
              <h2 style={{ margin: 0, fontSize: 18, color: 'var(--arena)' }}>Tu cupón</h2>
              <span className="pill ok">Enviado el {fechaCorta(m.enviado_at)}</span>
            </div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 14 }}>
              <Emb logoUrl={logo} emblema={m.emblema} nombre={m.nombre} t={64} />
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--arena)' }}>{m.beneficio}</div>
                <p style={{ margin: '2px 0 0', fontSize: 14 }}>{m.condiciones}</p>
              </div>
            </div>
            <p style={{ margin: '14px 0 0' }}>
              {soloEvento(m.vence) ? 'Vale solo durante el Mundial.' : `Vence el ${fDMY(m.vence)}.`}
              {!soloEvento(m.vence) && m.sucursales ? ` Después del Mundial, también en ${m.sucursales}.` : ''}
            </p>
            <p style={{ margin: '10px 0 0' }}>Código de caja: <span className="codigo">{m.codigo}</span></p>
            <p className="ayuda" style={{ marginTop: 12 }}>
              El cupón ya está en la billetera de los visitantes y no se puede modificar desde acá. Si necesitás cambiar algo, pedíselo a la organización del Mundial.
            </p>
          </div>
        ) : (
          <FormCupon inicial={{ beneficio: m.beneficio, condiciones: m.condiciones, logo, vence: m.vence, sucursales: m.sucursales }} codigo={m.codigo} creditos={m.creditos} />
        )}
        <div className="tarj tabla" style={{ marginTop: 14 }}>
          <h2 style={{ margin: '0 0 8px', fontSize: 17, color: 'var(--arena)' }}>Tus canjes</h2>
          <table>
            <thead><tr><th>N°</th><th>Día y hora</th><th>Visitante</th><th>Dónde</th></tr></thead>
            <tbody>
              {cs.length ? cs.map((c) => (
                <tr key={c.id}>
                  <td>{numCanje(c.numero)}</td>
                  <td>{diaHora(c.created_at, true)}</td>
                  <td>{c.visitante}</td>
                  <td>{c.post_evento ? 'Sucursal' : 'Mundial'}</td>
                </tr>
              )) : <tr><td colSpan={4}>Todavía no hay canjes.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
