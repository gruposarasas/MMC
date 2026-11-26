import Link from 'next/link';
import { notFound } from 'next/navigation';
import { esAdminVP, tarjetaPorId, consumosDeTarjeta, locales, linkTarjeta } from '@/lib/vistapueblo-servidor';
import { pesos, diaHora, dondeVale, estadoTarjeta, ESTADOS } from '@/lib/vistapueblo';
import { EntrarAdmin } from '@/components/vistapueblo/Comun';
import { TarjetaVP } from '@/components/vistapueblo/Tarjeta';
import { BotonesEnvio } from '@/components/vistapueblo/Emitir';
import { AccionesTarjeta, AnularConsumo } from '@/components/vistapueblo/Admin';

export const dynamic = 'force-dynamic';

export default async function DetalleTarjeta({ params }: { params: Promise<{ id: string }> }) {
  if (!(await esAdminVP())) return <EntrarAdmin />;
  const t = await tarjetaPorId((await params).id);
  if (!t) notFound();
  const [cs, ls] = await Promise.all([consumosDeTarjeta(t.id), locales()]);
  const donde = dondeVale(t.todos_los_locales, t.locales, ls);
  const estado = estadoTarjeta(t);
  return (
    <div className="vp-bo">
      <section className="vp-bo-cuerpo">
        <p><Link className="vp-link" href="/vistapueblo/admin?tab=tarjetas">← Gift cards</Link></p>
        <div className="vp-dos-col">
          <div>
            <h1 className="vp-h1">N° {t.numero} · {t.nombre}</h1>
            <p><span className={`vp-estado ${estado}`}>{ESTADOS[estado]}</span> Saldo <b>{pesos(t.saldo)}</b> de {pesos(t.monto)}</p>
            <dl className="vp-datos claro">
              <div><dt>WhatsApp</dt><dd>{t.whatsapp || '—'}</dd></div>
              <div><dt>Mail</dt><dd>{t.mail || '—'}</dd></div>
              <div><dt>Dónde vale</dt><dd>{donde}</dd></div>
              <div><dt>Código</dt><dd><code>{t.codigo}</code></dd></div>
              <div><dt>Creada</dt><dd>{diaHora(t.created_at)}{t.lote ? ` · ${t.lote}` : ''}</dd></div>
              <div><dt>Enviada</dt><dd>{[t.enviada_wa_at && `WhatsApp ${diaHora(t.enviada_wa_at)}`, t.enviada_mail_at && `Mail ${diaHora(t.enviada_mail_at)}`].filter(Boolean).join(' · ') || 'Todavía no'}</dd></div>
              <div><dt>La abrió el cliente</dt><dd>{t.vista_at ? diaHora(t.vista_at) : 'Todavía no'}</dd></div>
              {t.mensaje && <div><dt>Mensaje</dt><dd>“{t.mensaje}”</dd></div>}
            </dl>
            <BotonesEnvio t={t} donde={donde} link={linkTarjeta(t.token)} />
            <AccionesTarjeta id={t.id} anulada={t.anulada} vence={t.vence} />
          </div>
          <div className="vp-previa">
            <TarjetaVP nombre={t.nombre} monto={t.monto} vence={t.vence} numero={t.numero} />
          </div>
        </div>
        <h2 style={{ marginTop: 26 }}>Consumos</h2>
        {cs.length ? (
          <div className="vp-tabla">
            <table>
              <thead><tr><th>N°</th><th>Día y hora</th><th>Local</th><th>Cajero</th><th className="n">Monto</th><th className="n">Local</th><th className="n">Vistapueblo</th><th /></tr></thead>
              <tbody>{cs.map((c) => (
                <tr key={c.id} className={c.anulado ? 'anulado' : ''}>
                  <td>{c.numero}</td><td>{diaHora(c.created_at)}</td><td>{c.local}</td><td>{c.cajero}</td>
                  <td className="n">{pesos(c.monto)}</td><td className="n">{pesos(c.a_cargo_local)} <small>{c.porcentaje}%</small></td><td className="n">{pesos(c.a_cargo_vp)}</td>
                  <td>{c.anulado ? <small>Anulado{c.anulado_motivo ? `: ${c.anulado_motivo}` : ''}</small> : <AnularConsumo id={c.id} />}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="vp-vacio">Todavía no se usó.</p>}
      </section>
    </div>
  );
}
