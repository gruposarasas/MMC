'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import recursos from '@/lib/recursos.json';
import { achicar } from './CamposCupon';
import { FotoBarista } from './Secciones';
import { toast } from './Toast';

async function post(url: string, cuerpo?: object) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined }).catch(() => null);
  const j = r ? await r.json().catch(() => ({})) : {};
  if (!r || !r.ok) { toast(j.error || 'Algo falló. Probá de nuevo.'); return false; }
  return true;
}

export function EntrarBarista() {
  const router = useRouter();
  const [clave, setClave] = useState('');
  const [enviando, setEnviando] = useState(false);
  return (
    <div className="tel" style={{ maxWidth: 460 }}>
      <div className="tel-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src={recursos.logo} alt="Mundial de Café" style={{ width: 160 }} />
        <h1 className="h1" style={{ fontSize: 26 }}>Tu perfil de barista</h1>
        <p className="lead">Entrá con la clave que te dio la organización para subir tu foto y contarle al público quién sos.</p>
        <form onSubmit={async (e) => { e.preventDefault(); setEnviando(true); const ok = await post('/api/barista/entrar', { clave }); setEnviando(false); if (ok) router.refresh(); }}>
          <div className="campo">
            <label htmlFor="bClave">Tu clave</label>
            <input id="bClave" autoCapitalize="characters" autoComplete="off" placeholder="NOMBRE-7Q2X" value={clave} onChange={(e) => setClave(e.target.value)} maxLength={30} />
          </div>
          <button className="btn" type="submit" disabled={enviando || !clave.trim()}>{enviando ? 'Entrando…' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  );
}

export function SalirBarista() {
  const router = useRouter();
  return <button className="link" onClick={async () => { await post('/api/barista/salir'); router.refresh(); }}>Salir</button>;
}

type Perfil = { foto: string; historia: string; hobby: string; experiencia: string; por_que: string };
const CAMPOS: [keyof Perfil, string, string, number][] = [
  ['historia', 'Tu historia', 'Contá quién sos, de dónde venís y cómo llegaste al café.', 700],
  ['experiencia', 'Tu experiencia', 'Dónde trabajaste, competencias, cursos…', 700],
  ['hobby', 'Tu hobby', 'Qué te gusta hacer cuando no estás detrás de la barra.', 200],
  ['por_que', '¿Por qué merecés ganar el Mundial de Café?', 'Convencé al público: el barista más votado gana un premio.', 700],
];

export function FormPerfil({ nombre, inicial }: { nombre: string; inicial: Perfil }) {
  const router = useRouter();
  const [v, setV] = useState(inicial);
  const [enviando, setEnviando] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    const foto = v.foto === inicial.foto ? 'mantener' : v.foto || 'quitar';
    const ok = await post('/api/barista/perfil', { ...v, foto });
    setEnviando(false);
    if (ok) { toast('Perfil guardado. El público ya lo ve en la app.'); router.refresh(); }
  }
  return (
    <form className="form" onSubmit={guardar}>
      <h2 style={{ margin: 0, fontSize: 18, color: 'var(--arena)' }}>Tu perfil</h2>
      <p className="ayuda">Lo ven todos los visitantes en la sección Baristas de la app. Podés cambiarlo cuando quieras.</p>
      <div className="campo">
        <label htmlFor="bFoto">Tu foto</label>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <FotoBarista foto={v.foto} nombre={nombre} t={88} />
          <label className="btn chico linea" style={{ margin: 0, cursor: 'pointer', position: 'relative' }}>
            {v.foto ? 'Cambiar foto' : 'Subir foto'}
            <input
              ref={input}
              type="file"
              id="bFoto"
              accept="image/png,image/jpeg,image/webp"
              style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
              onChange={async () => {
                const f = input.current?.files?.[0];
                if (!f) return;
                try { setV((x) => ({ ...x, foto: '' })); const d = await achicar(f, 800, 'image/jpeg'); setV((x) => ({ ...x, foto: d })); }
                catch { toast('No pudimos leer esa imagen. Probá con otra.'); }
              }}
            />
          </label>
          {v.foto && <button type="button" className="link" onClick={() => setV((x) => ({ ...x, foto: '' }))}>Quitar</button>}
        </div>
      </div>
      {CAMPOS.map(([k, t, ph, max]) => (
        <div className="campo" key={k}>
          <label htmlFor={`b-${k}`}>{t}</label>
          <textarea id={`b-${k}`} className="area" rows={k === 'hobby' ? 2 : 4} maxLength={max} placeholder={ph} value={v[k]} onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value }))} />
          <div className="ayuda" style={{ textAlign: 'right' }}>{v[k].length}/{max}</div>
        </div>
      ))}
      <button className="btn" type="submit" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar perfil'}</button>
    </form>
  );
}
