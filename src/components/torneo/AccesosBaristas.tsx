'use client';
import { useState } from 'react';
import { LINK_BARISTA, URL_PUBLICA } from '@/lib/config';
import type { AccesoJurado } from '@/lib/jurados';
import type { AccesoBarista } from '@/lib/votos';
import { FotoBarista } from '../Secciones';
import { toast } from '../Toast';

const texto = (b: AccesoBarista) =>
  `¡Hola ${b.nombre.split(' ')[0]}! Te paso el acceso a tu perfil de barista del Mundial de Café: entrá en ${LINK_BARISTA} con la clave ${b.clave}. Subí tu foto y contale al público tu historia, tu experiencia, tu hobby y por qué merecés ganar: el barista más votado por el público gana un premio.`;
const wa = (b: AccesoBarista) => `https://wa.me/549${b.tel.replace(/^549?/, '')}?text=${encodeURIComponent(texto(b))}`;

/** Accesos de los baristas a su perfil (/baristas): clave, WhatsApp y estado del perfil. */
export function AccesosBaristas({ inicial, jurados }: { inicial: AccesoBarista[]; jurados: AccesoJurado[] }) {
  const [bs, setBs] = useState(inicial);
  const [js, setJs] = useState(jurados);
  async function act(c: Record<string, unknown>, ok?: string) {
    const r = await fetch('/api/admin/accesos-baristas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(c) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) return toast(j.error || 'Algo falló. Probá de nuevo.');
    setBs(j.accesos);
    setJs(j.jurados);
    if (ok) toast(ok);
  }
  const copiar = async (t: string) => {
    try { await navigator.clipboard.writeText(t); toast('Acceso copiado: link y clave.'); } catch { prompt('Copiá el acceso:', t); }
  };
  const bloqueJurados = (
    <div className="tarj tabla" style={{ marginTop: 22 }}>
      <h2 style={{ margin: 0, fontSize: 17, color: 'var(--arena)' }}>Jurados</h2>
      <p className="ayuda">
        Cada jurado entra en <b>{URL_PUBLICA}/jurado</b> con su clave y carga su planilla de cada barista en la ronda en curso. Cuando los 3 completan la de un barista, su puntaje se calcula solo y el barista ve la devolución en su perfil, firmada como Jurado 1, 2 y 3 (sin nombres).
      </p>
      <table>
        <thead><tr><th>Jurado</th><th>Clave</th><th>Acceso</th></tr></thead>
        <tbody>
          {js.map((j) => (
            <tr key={j.n}>
              <td><b>Jurado {j.n}</b></td>
              <td style={{ fontWeight: 700, letterSpacing: '.04em' }}>{j.clave || '—'}</td>
              <td>
                <div className="acciones" style={{ marginTop: 0 }}>
                  {j.clave && <button className="link" onClick={() => copiar(`Jurado ${j.n} · Torneo de Baristas del Mundial de Café\n${URL_PUBLICA}/jurado\nClave: ${j.clave}`)}>Copiar acceso</button>}
                  <button className="link" onClick={() => (!j.clave || confirm(`¿Generar una clave nueva para el Jurado ${j.n}? La anterior deja de andar.`)) && act({ accion: 'jurado', n: j.n }, 'Clave del jurado generada.')}>{j.clave ? 'Nueva clave' : 'Generar clave'}</button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const faltan = bs.filter((b) => !b.clave).length;
  const completos = bs.filter((b) => b.completo).length;
  return (
    <>
    {bloqueJurados}
    <div className="tarj tabla" style={{ marginTop: 22 }}>
      <div className="fila">
        <h2 style={{ margin: 0, fontSize: 17, color: 'var(--arena)' }}>Perfiles de los baristas · {completos} de {bs.length} completos</h2>
        {faltan > 0 && <button className="btn chico" onClick={() => act({ accion: 'claves' }, 'Claves generadas.')}>Generar las {faltan} claves que faltan</button>}
      </div>
      <p className="ayuda">
        Cada barista entra en <b>{LINK_BARISTA}</b> con su clave, sube su foto y cuenta su historia, su experiencia, su hobby y por qué merece ganar. El público lo ve en la app y le manda mensajes de aliento.
      </p>
      <table>
        <thead><tr><th>Barista</th><th>Perfil</th><th>Clave</th><th>WhatsApp</th><th>Acceso</th></tr></thead>
        <tbody>
          {bs.map((b) => (
            <tr key={b.id}>
              <td><div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><FotoBarista foto={b.foto} nombre={b.nombre} t={34} /><b>{b.nombre}</b></div></td>
              <td>{b.completo ? <span className="pill ok">Completo</span> : b.perfil_at ? <span className="pill">A medias</span> : <span className="pill off">Sin completar</span>}</td>
              <td style={{ whiteSpace: 'nowrap', fontWeight: 700, letterSpacing: '.04em' }}>{b.clave || '—'}</td>
              <td>
                <button className="link" onClick={() => { const t = prompt(`WhatsApp de ${b.nombre} (con código de área, sin 0 ni 15)`, b.tel); if (t != null) act({ accion: 'tel', id: b.id, tel: t }, 'Guardado.'); }}>
                  {b.tel || 'Cargar'}
                </button>
              </td>
              <td>
                {b.clave && (
                  <div className="acciones" style={{ marginTop: 0 }}>
                    <button className="link" onClick={() => copiar(`Perfil de ${b.nombre} en el Mundial de Café\n${LINK_BARISTA}\nClave: ${b.clave}`)}>Copiar acceso</button>
                    {b.tel && <a className="link" target="_blank" rel="noopener noreferrer" href={wa(b)}>Mandar por WhatsApp</a>}
                    <button className="link" onClick={() => confirm(`¿Generar una clave nueva para ${b.nombre}? La anterior deja de andar.`) && act({ accion: 'clave', id: b.id }, 'Clave nueva generada.')}>Nueva clave</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    </>
  );
}
