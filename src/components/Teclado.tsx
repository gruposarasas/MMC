'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import recursos from '@/lib/recursos.json';
import { Emb } from './Emb';

type Marca = { id: string; nombre: string; stand: string; beneficio: string; creditos: number; emblema: string; logoUrl: string };
type Ok = { numero: number; restantes: number; creditos: number; marca: string; beneficio: string; nombre: string };

const pad = (n: number) => String(n).padStart(2, '0');
const fDMY = (f: string) => f.split('-').reverse().join('/');

export function Teclado({ marca, restantesIni, bloqueoIni }: { marca: Marca; restantesIni: number; bloqueoIni: number }) {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [aviso, setAviso] = useState<{ t: string; mal: boolean } | null>(null);
  const [mal, setMal] = useState(false);
  const [bloqueo, setBloqueo] = useState(bloqueoIni);
  const [enviando, setEnviando] = useState(false);
  const [restantes, setRestantes] = useState(restantesIni);
  const [canje, setCanje] = useState<Ok | null>(null);
  const ocupado = useRef(false);
  const pinRef = useRef('');

  useEffect(() => {
    if (bloqueo <= 0) return;
    const t = setInterval(() => setBloqueo((b) => (b <= 1 ? 0 : b - 1)), 1000);
    return () => clearInterval(t);
  }, [bloqueo > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (bloqueo === 0 && aviso?.t === '') setAviso(null);
  }, [bloqueo, aviso]);

  const enviar = useCallback(
    async (codigo: string) => {
      ocupado.current = true;
      setEnviando(true);
      try {
        const r = await fetch('/api/canjear', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ marca: marca.id, codigo }) });
        const j = await r.json().catch(() => ({}));
        pinRef.current = '';
        setPin('');
        if (r.status === 401) {
          router.replace('/');
          return;
        }
        switch (j.estado) {
          case 'ok':
            setAviso(null);
            setRestantes(j.restantes);
            setCanje(j);
            break;
          case 'codigo_incorrecto':
            setMal(true);
            setAviso({ t: `Código incorrecto. Te quedan ${j.quedan} intento${j.quedan > 1 ? 's' : ''}.`, mal: true });
            break;
          case 'bloqueado':
            setMal(true);
            setBloqueo(j.segundos || 60);
            setAviso({ t: '', mal: true });
            break;
          case 'vencida':
            setAviso({ t: `Este beneficio venció el ${fDMY(j.vence)}.`, mal: true });
            break;
          case 'sin_creditos':
            setRestantes(0);
            setAviso({ t: 'Ya usaste todos los créditos de esta cafetería.', mal: true });
            break;
          case 'no_disponible':
            setAviso({ t: 'Este beneficio ya no está disponible.', mal: true });
            break;
          default:
            setAviso({ t: j.error || 'No pudimos validar el código. Probá de nuevo.', mal: true });
        }
      } catch {
        pinRef.current = '';
        setPin('');
        setAviso({ t: 'Sin conexión. Revisá tu internet y probá de nuevo.', mal: true });
      } finally {
        ocupado.current = false;
        setEnviando(false);
      }
    },
    [marca.id, router],
  );

  const tecla = useCallback(
    (k: string) => {
      if (bloqueo > 0 || ocupado.current || canje) return;
      setMal(false);
      if (k === 'borrar') {
        pinRef.current = pinRef.current.slice(0, -1);
        setPin(pinRef.current);
        setAviso(null);
        return;
      }
      if (pinRef.current.length >= 4) return;
      const n = pinRef.current + k;
      pinRef.current = n;
      setPin(n);
      if (n.length === 4) void enviar(n);
    },
    [bloqueo, canje, enviar],
  );

  useEffect(() => {
    const f = (ev: KeyboardEvent) => {
      if (/^[0-9]$/.test(ev.key)) tecla(ev.key);
      else if (ev.key === 'Backspace') tecla('borrar');
    };
    document.addEventListener('keydown', f);
    return () => document.removeEventListener('keydown', f);
  }, [tecla]);

  const bloq = bloqueo > 0;
  const off = bloq || enviando;

  return (
    <>
      <div className="tel">
        <div className="tel-in">
          <Link className="link" href="/billetera">← Volver</Link>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 18 }}>
            <Emb logoUrl={marca.logoUrl} emblema={marca.emblema} nombre={marca.nombre} t={54} />
            <div>
              <div style={{ color: 'var(--arena2)', fontSize: 14, fontWeight: 600 }}>
                {marca.nombre}{marca.stand ? ` · ${marca.stand}` : ''}
              </div>
              <h1 style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.1, margin: 0 }}>{marca.beneficio}</h1>
            </div>
          </div>
          <ol className="pasos">
            <li>Pedí en la caja de {marca.nombre} y avisá que vas a usar tu beneficio.</li>
            <li>El cajero te dice el código de 4 números: escribilo acá.</li>
            <li>Mostrale la pantalla de canje válido.</li>
          </ol>
          <div className={`pin ${mal ? 'mal' : ''}`} role="img" aria-label={`Código de 4 números: ${pin.length} escritos`}>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={pin.length > i ? 'lleno' : ''}>{pin.length > i ? '•' : ''}</span>
            ))}
          </div>
          <p className={`aviso ${aviso?.mal ? 'mal' : ''}`} role="status" aria-live="polite">
            {bloq ? `Demasiados intentos. Esperá ${bloqueo} segundo${bloqueo === 1 ? '' : 's'} y probá de nuevo.` : enviando ? 'Validando…' : aviso ? aviso.t : 'Pedíselo al cajero en el momento de pagar.'}
          </p>
          <div className="teclado">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button key={n} type="button" disabled={off} onClick={() => tecla(String(n))}>{n}</button>
            ))}
            <button type="button" className="t-sec" disabled={off} onClick={() => tecla('borrar')}>Borrar</button>
            <button type="button" disabled={off} onClick={() => tecla('0')}>0</button>
            <Link className="t-sec" href="/billetera" style={{ borderRadius: 14, background: 'rgba(255,255,255,.07)', display: 'grid', placeItems: 'center', textDecoration: 'none', fontSize: 15, fontWeight: 600, color: 'var(--arena2)' }}>
              Cancelar
            </Link>
          </div>
          <p className="ayuda" style={{ textAlign: 'center', marginTop: 14 }}>
            Te quedan {restantes} de {marca.creditos}. Al confirmar se descuenta uno.
          </p>
        </div>
      </div>
      {canje && (
        <PantallaCanje
          c={canje}
          onListo={() => {
            router.push('/billetera');
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function PantallaCanje({ c, onListo }: { c: Ok; onListo: () => void }) {
  const [ahora, setAhora] = useState(() => new Date());
  const listo = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 250);
    listo.current?.focus({ preventScroll: true });
    return () => clearInterval(t);
  }, []);
  return (
    <div className="canje" role="dialog" aria-modal="true" aria-label="Canje válido">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="canje-emb" src={recursos.estrellaSola} alt="" />
      <h2>Canje válido</h2>
      <div className="c-marca">{c.marca}</div>
      <div className="c-benef">{c.beneficio}</div>
      <div className="c-nom">{c.nombre}</div>
      <div className="reloj" aria-label="Hora actual">
        {pad(ahora.getHours())}:{pad(ahora.getMinutes())}:{pad(ahora.getSeconds())}
      </div>
      <div className="c-num">
        Canje N° {String(c.numero).padStart(4, '0')} · {c.restantes ? `te quedan ${c.restantes} de ${c.creditos}` : 'era tu último crédito acá'}
      </div>
      <button ref={listo} className="btn linea" style={{ color: 'var(--crema)', borderColor: 'var(--crema)' }} onClick={onListo}>
        Listo
      </button>
    </div>
  );
}
