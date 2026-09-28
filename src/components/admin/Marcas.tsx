'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import recursos from '@/lib/recursos.json';
import { EMBLEMAS, EVENTO_FIN, LINK_PANEL } from '@/lib/config';
import { Emb } from '../Emb';
import { CamposCupon } from '../CamposCupon';
import { toast } from '../Toast';
import { pedir, copiar } from './Comun';

export type MarcaAdmin = {
  id: string;
  nombre: string;
  stand: string;
  beneficio: string;
  condiciones: string;
  creditos: number;
  codigo: string;
  clave: string;
  emblema: string;
  activa: boolean;
  vence: string;
  sucursales: string;
  responsable: string;
  tel_responsable: string;
  enviado_at: string | null;
  logoUrl: string;
  canjes: number;
};

type Form = Omit<MarcaAdmin, 'id' | 'clave' | 'enviado_at' | 'canjes' | 'logoUrl'> & { logo: string };

const fDMY = (f: string) => f.split('-').reverse().join('/');
const soloEvento = (v: string) => !v || v <= EVENTO_FIN;
const codigoAlAzar = (usados: Set<string>) => {
  let c;
  do c = String(1000 + Math.floor(Math.random() * 9000));
  while (usados.has(c));
  return c;
};

const mensajeWA = (m: MarcaAdmin) =>
  `https://wa.me/549${m.tel_responsable.replace(/^549?/, '')}?text=${encodeURIComponent(
    `Hola! Te paso el acceso al panel de ${m.nombre} en el Mundial de Café. Entrá en ${LINK_PANEL} con la clave ${m.clave}. Desde ahí cargás tu logo, el vencimiento y las sucursales, y ves tus canjes.`,
  )}`;

export function AdminMarcas({ marcas }: { marcas: MarcaAdmin[] }) {
  const router = useRouter();
  const [editar, setEditar] = useState<string | null>(null); // id, 'nueva' o null
  const [f, setF] = useState<Form | null>(null);
  const [logoIni, setLogoIni] = useState('');
  const [guardando, setGuardando] = useState(false);
  const usados = new Set(marcas.map((m) => m.codigo));

  function abrir(id: string | null) {
    setEditar(id);
    if (!id) return setF(null);
    const m = id === 'nueva' ? null : marcas.find((x) => x.id === id)!;
    const base: Form = m
      ? { ...m, logo: m.logoUrl }
      : { nombre: '', stand: '', beneficio: '', condiciones: '', creditos: 1, codigo: codigoAlAzar(usados), emblema: 'taza', activa: true, vence: EVENTO_FIN, sucursales: '', responsable: '', tel_responsable: '', logo: '' };
    setF(base);
    setLogoIni(base.logo);
    requestAnimationFrame(() => document.getElementById('fMarca')?.scrollIntoView({ behavior: 'smooth' }));
  }

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault();
    if (!f) return;
    if (!f.nombre.trim() || !f.beneficio.trim()) return toast('Completá la cafetería y el beneficio.');
    if (!/^\d{4}$/.test(f.codigo)) return toast('El código de caja tiene que ser de 4 números.');
    if (marcas.some((m) => m.codigo === f.codigo && m.id !== editar)) return toast('Ese código ya lo usa otra cafetería. Elegí otro.');
    if ((f.vence || EVENTO_FIN) < EVENTO_FIN) return toast('El vencimiento no puede ser antes del final del Mundial (4 de octubre).');
    const logo = f.logo === logoIni ? 'mantener' : f.logo || 'quitar';
    setGuardando(true);
    const nueva = editar === 'nueva';
    const j = await pedir(nueva ? '/api/admin/marcas' : `/api/admin/marcas/${editar}`, nueva ? 'POST' : 'PATCH', { ...f, logo });
    setGuardando(false);
    if (!j) return;
    toast(nueva ? `Marca creada. Su clave de acceso es ${j.clave}.` : 'Cambios guardados. Ya los ven los visitantes.');
    abrir(null);
    router.refresh();
  }

  async function accion(m: MarcaAdmin, a: 'codigo' | 'clave' | 'reabrir' | 'eliminar') {
    if (a === 'clave' && !confirm(`¿Generar una clave nueva para ${m.nombre}? La anterior deja de funcionar.`)) return;
    if (a === 'reabrir' && !confirm(`¿Habilitar a ${m.nombre} para cambiar su cupón? Va a tener que enviarlo de nuevo.`)) return;
    if (a === 'eliminar' && !confirm(`¿Eliminar el cupón de ${m.nombre}? Desaparece de la billetera de todos los visitantes.${m.canjes ? ` Sus ${m.canjes} canjes quedan en el historial.` : ''}`)) return;
    if (a === 'codigo' && !confirm(`¿Cambiar el código de caja de ${m.nombre}? El actual deja de funcionar.`)) return;
    const j = await pedir(`/api/admin/marcas/${m.id}`, 'POST', { accion: a });
    if (!j) return;
    toast(
      a === 'codigo' ? `Nuevo código de ${m.nombre}: ${j.codigo}. Avisale al stand.`
      : a === 'clave' ? `Nueva clave de ${m.nombre}: ${j.clave}`
      : a === 'reabrir' ? `${m.nombre} ya puede cambiar su cupón desde su panel.`
      : `Cupón de ${m.nombre} eliminado.`,
    );
    if (editar === m.id) abrir(null);
    router.refresh();
  }

  const set = (x: Partial<Form>) => setF((y) => (y ? { ...y, ...x } : y));

  return (
    <>
      <div className="fila">
        <div>
          <h1>Beneficios</h1>
          <p className="sub" style={{ marginBottom: 0 }}>Lo que ve cada visitante en su billetera. Cada cafetería tiene su propio beneficio, cantidad de usos y código de caja.</p>
        </div>
        <button className="btn chico" onClick={() => abrir('nueva')}>Crear marca</button>
      </div>

      {f && (
        <form className="form" id="fMarca" onSubmit={guardar}>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, color: 'var(--arena)' }}>{editar === 'nueva' ? 'Nueva marca' : `Editar ${marcas.find((m) => m.id === editar)?.nombre}`}</h2>
          {editar === 'nueva' && <p className="ayuda">Al crearla se genera su clave para entrar a su panel.</p>}
          <div className="grid2">
            <div className="campo"><label htmlFor="mNom">Marca</label><input id="mNom" value={f.nombre} onChange={(e) => set({ nombre: e.target.value })} required maxLength={80} /></div>
            <div className="campo"><label htmlFor="mStand">Stand</label><input id="mStand" value={f.stand} onChange={(e) => set({ stand: e.target.value })} placeholder="Stand 12" maxLength={40} /></div>
            <div className="campo"><label htmlFor="mBen">Beneficio</label><input id="mBen" value={f.beneficio} onChange={(e) => set({ beneficio: e.target.value })} placeholder="2x1 en café" maxLength={34} /><div className="ayuda">Corto: es lo que se ve grande en el cupón.</div></div>
            <div className="campo"><label htmlFor="mCond">Condiciones</label><input id="mCond" value={f.condiciones} onChange={(e) => set({ condiciones: e.target.value })} placeholder="En cualquier café de la carta" maxLength={240} /></div>
            <div className="campo"><label htmlFor="mCred">Veces que lo puede usar cada visitante</label><input id="mCred" type="number" min={1} max={10} value={f.creditos} onChange={(e) => set({ creditos: Number(e.target.value) })} /></div>
            <div className="campo">
              <label htmlFor="mCod">Código de caja (4 números)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input id="mCod" inputMode="numeric" maxLength={4} value={f.codigo} onChange={(e) => set({ codigo: e.target.value.replace(/\D/g, '') })} style={{ letterSpacing: '.3em', fontWeight: 700 }} />
                <button type="button" className="btn chico linea" onClick={() => set({ codigo: codigoAlAzar(usados) })}>Otro</button>
              </div>
              <div className="ayuda">Lo sabe solo el personal del stand.</div>
            </div>
          </div>
          <div className="grid2">
            <div className="campo"><label htmlFor="mResp">Responsable de la marca</label><input id="mResp" value={f.responsable} onChange={(e) => set({ responsable: e.target.value })} placeholder="Nombre de quien carga el cupón" maxLength={80} /></div>
            <div className="campo"><label htmlFor="mTel">WhatsApp del responsable</label><input id="mTel" inputMode="tel" value={f.tel_responsable} onChange={(e) => set({ tel_responsable: e.target.value })} placeholder="261 555 1234" maxLength={20} /><div className="ayuda">Para mandarle su clave de acceso.</div></div>
          </div>
          <CamposCupon v={f} set={set} />
          <div className="campo">
            <label>Figura del cupón (si no hay logo)</label>
            <div className="embs">
              {EMBLEMAS.map((k) => (
                <button key={k} type="button" className={f.emblema === k ? 'on' : ''} aria-label={k} aria-pressed={f.emblema === k} onClick={() => set({ emblema: k })}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={(recursos as Record<string, string>)['ic_' + k]} alt="" />
                </button>
              ))}
            </div>
          </div>
          <label className="check"><input type="checkbox" checked={f.activa} onChange={(e) => set({ activa: e.target.checked })} /><span>Visible en la billetera de los visitantes</span></label>
          <div className="acciones">
            <button className="btn chico" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : editar === 'nueva' ? 'Crear marca' : 'Guardar cambios'}</button>
            <button type="button" className="btn chico linea" onClick={() => abrir(null)}>Cancelar</button>
          </div>
        </form>
      )}

      <div className="tarj tabla" style={{ marginTop: 14 }}>
        <h2 style={{ margin: '0 0 6px', fontSize: 16, color: 'var(--arena)' }}>Accesos de las marcas</h2>
        <table>
          <thead><tr><th>Marca</th><th>Stand</th><th>Clave</th><th>Beneficio</th><th>Cupón</th></tr></thead>
          <tbody>
            {marcas.map((m) => (
              <tr key={m.id}>
                <td><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Emb logoUrl={m.logoUrl} emblema={m.emblema} nombre={m.nombre} t={28} /><span>{m.nombre}</span></div></td>
                <td>{m.stand || '-'}</td>
                <td><b style={{ letterSpacing: '.05em' }}>{m.clave}</b></td>
                <td>{m.beneficio || <span className="pill off">Falta</span>}</td>
                <td>{m.enviado_at ? <span className="pill ok">Enviado</span> : <span className="pill">Pendiente</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="ayuda" style={{ marginTop: 8 }}>Las marcas entran en {LINK_PANEL}</p>
      </div>

      <div className="marcas">
        {marcas.map((m) => (
          <div className="marca" key={m.id}>
            <Emb logoUrl={m.logoUrl} emblema={m.emblema} nombre={m.nombre} t={56} />
            <div>
              <div className="fila"><h3>{m.nombre}</h3><span className={`pill ${m.activa ? 'ok' : 'off'}`}>{m.activa ? 'Visible' : 'Oculta'}</span></div>
              <p>
                {!m.beneficio && <><span className="pill off">Falta cargar el beneficio</span>{' '}</>}
                {m.enviado_at ? <span className="pill ok">Enviado por la marca</span> : <span className="pill">Esperando que la marca lo envíe</span>}
              </p>
              <p>{m.stand}</p>
              <div className="mb">{m.beneficio || <span style={{ color: 'rgba(243,233,220,.45)' }}>Sin beneficio</span>}</div>
              <p>{m.condiciones}</p>
              <p style={{ marginTop: 8 }}>{m.creditos} uso{m.creditos > 1 ? 's' : ''} por visitante · {m.canjes} canje{m.canjes === 1 ? '' : 's'}</p>
              <p>{soloEvento(m.vence) ? 'Vale solo durante el Mundial' : `Vence el ${fDMY(m.vence)}${m.sucursales ? ' · también en ' + m.sucursales : ''}`}</p>
              <div className="acceso">
                <div>
                  <span>Clave de acceso</span>
                  <b>{m.clave}</b>
                  {m.responsable && <small>{m.responsable}{m.tel_responsable ? ' · ' + m.tel_responsable : ''}</small>}
                </div>
                <div className="acceso-b">
                  <button className="link" onClick={() => copiar(`Panel de ${m.nombre} en el Mundial de Café\n${LINK_PANEL}\nClave: ${m.clave}`, 'Acceso copiado: link y clave.')}>Copiar acceso</button>
                  {m.tel_responsable && <a className="link" target="_blank" rel="noopener noreferrer" href={mensajeWA(m)}>Mandar por WhatsApp</a>}
                  <button className="link" onClick={() => accion(m, 'clave')}>Nueva clave</button>
                </div>
              </div>
              <p style={{ marginTop: 6 }}>Código de caja: <span className="codigo">{m.codigo}</span></p>
              <div className="acciones">
                <button className="link" onClick={() => abrir(m.id)}>Editar</button>
                <button className="link" onClick={() => accion(m, 'codigo')}>Cambiar código</button>
                {m.enviado_at && <button className="link" onClick={() => accion(m, 'reabrir')}>Dejar que la marca lo cambie</button>}
                <button className="link" style={{ color: 'var(--mal)' }} onClick={() => accion(m, 'eliminar')}>Eliminar</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
