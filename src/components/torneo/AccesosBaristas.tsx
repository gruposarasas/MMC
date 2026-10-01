'use client';
import { useState } from 'react';
import { LINK_BARISTA } from '@/lib/config';
import type { AccesoBarista } from '@/lib/votos';
import { FotoBarista } from '../Secciones';
import { toast } from '../Toast';

const texto = (b: AccesoBarista) =>
  `¡Hola ${b.nombre.split(' ')[0]}! Te paso el acceso a tu perfil de barista del Mundial de Café: entrá en ${LINK_BARISTA} con la clave ${b.clave}. Subí tu foto y contale al público tu historia, tu experiencia, tu hobby y por qué merecés ganar: el barista más votado por el público gana un premio.`;
const wa = (b: AccesoBarista) => `https://wa.me/549${b.tel.replace(/^549?/, '')}?text=${encodeURIComponent(texto(b))}`;

/** Accesos de los baristas a su perfil (/barista): clave, WhatsApp y estado del perfil. */
export function AccesosBaristas({ inicial }: { inicial: AccesoBarista[] }) {
  const [bs, setBs] = useState(inicial);
  async function act(c: Record<string, unknown>, ok?: string) {
    const r = await fetch('/api/admin/accesos-baristas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(c) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) return toast(j.error || 'Algo falló. Probá de nuevo.');
    setBs(j.accesos);
    if (ok) toast(ok);
  }
  const copiar = async (t: string) => {
    try { await navigator.clipboard.writeText(t); toast('Acceso copiado: link y clave.'); } catch { prompt('Copiá el acceso:', t); }
  };
  const faltan = bs.filter((b) => !b.clave).length;
  const completos = bs.filter((b) => b.completo).length;
  return (
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
  );
}
