'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { fichar } from '@/acciones/fichaje';
import { distanciaM } from '@/lib/geo';
import { Escaner } from './Escaner';

type Lugar = { id: number; nombre: string; lat: number; lng: number; radio: number };
type Paso = { ok: boolean | null; msg: string };
type Posicion = { lat: number; lng: number; precision: number; t: number };

const PRECISION_MAX = 150;
const VIGENCIA_GPS_MS = 3 * 60_000;

// Los dos pasos del fichaje (como en la app de Sara): ubicación y QR. El servidor vuelve a validar todo con su hora.
export function Fichar({ tipo, lugares }: { tipo: 'entrada' | 'salida'; lugares: Lugar[] }) {
  const router = useRouter();
  const [geo, setGeo] = useState<Paso>({ ok: null, msg: 'Tenés que estar en el lugar de trabajo.' });
  const [qr, setQr] = useState<Paso>({ ok: null, msg: 'El código cambia cada 5 segundos: no sirve una foto ni uno reenviado.' });
  const [buscando, setBuscando] = useState(false);
  const [escaneando, setEscaneando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState<string | null>(null);
  const posicion = useRef<Posicion | null>(null);

  const ubicar = () => new Promise<Posicion>((resolver, rechazar) => {
    if (!navigator.geolocation) { rechazar(new Error('Este teléfono no informa la ubicación.')); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolver({ lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy, t: Date.now() }),
      (e) => rechazar(new Error(e.code === 1 ? 'Permití el acceso a la ubicación para fichar. Solo se usa en este momento.' : 'No se pudo obtener tu ubicación. Activá el GPS y volvé a intentar.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });

  const verificar = async () => {
    setBuscando(true);
    try {
      const p = await ubicar();
      posicion.current = p;
      if (p.precision > PRECISION_MAX) {
        setGeo({ ok: false, msg: `La señal de ubicación es imprecisa (± ${Math.round(p.precision)} m). Activá el GPS y volvé a intentar.` });
        return;
      }
      const cerca = lugares.map((l) => ({ l, d: distanciaM(p.lat, p.lng, l.lat, l.lng) })).sort((a, b) => a.d - b.d)[0];
      if (!cerca) setGeo({ ok: false, msg: 'Todavía no hay lugares con la ubicación cargada. Avisale a administración.' });
      else if (cerca.d <= cerca.l.radio) setGeo({ ok: true, msg: `Estás en ${cerca.l.nombre} (a ${cerca.d} m).` });
      else setGeo({ ok: false, msg: cerca.d > 1000 ? `Estás a ${(cerca.d / 1000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} km de ${cerca.l.nombre}.` : `Estás a ${cerca.d} m de ${cerca.l.nombre}. Acercate para fichar.` });
    } catch (e) {
      setGeo({ ok: false, msg: (e as Error).message });
    } finally {
      setBuscando(false);
    }
  };

  const registrar = async (codigo: string) => {
    setEscaneando(false);
    setEnviando(true);
    setQr({ ok: null, msg: 'Código leído. Registrando…' });
    try {
      let p = posicion.current;
      if (!p || Date.now() - p.t > VIGENCIA_GPS_MS) { p = await ubicar(); posicion.current = p; }
      const r = await fichar({ qr: codigo, lat: p.lat, lng: p.lng, precision: p.precision, tipo });
      if ('error' in r) { setQr({ ok: false, msg: r.error }); return; }
      setQr({ ok: true, msg: 'Código válido.' });
      setListo(r.ok);
      setTimeout(() => router.refresh(), 2500);
    } catch (e) {
      setQr({ ok: false, msg: (e as Error).message || 'Sin conexión. Probá de nuevo.' });
    } finally {
      setEnviando(false);
    }
  };

  const paso = (n: number, p: Paso, titulo: string) => (
    <div className={`paso ${p.ok === true ? 'ok' : p.ok === false ? 'mal' : ''}`}>
      <div className="c">{p.ok === true ? '✓' : p.ok === false ? '!' : n}</div>
      <div><b>{titulo}</b><div className="chico" role={p.ok === false ? 'alert' : undefined}>{p.msg}</div></div>
    </div>
  );

  if (listo) {
    return (
      <div className="caja fichado-ok" role="status">
        <div className="paso ok"><div className="c">✓</div></div>
        <h2>{listo}</h2>
      </div>
    );
  }
  return (
    <>
      <div className="caja pasos-fichar">
        {paso(1, geo, 'Estás en el lugar')}
        {paso(2, qr, 'QR de la pantalla')}
      </div>
      <div style={{ display: 'grid', gap: 10 }}>
        {!geo.ok && <button className="btn vino ancho" onClick={verificar} disabled={buscando}>{buscando ? 'Buscando tu ubicación…' : '1. Verificar ubicación'}</button>}
        {geo.ok && (
          <button className="btn vino ancho" onClick={() => setEscaneando(true)} disabled={enviando}>
            {enviando ? 'Registrando…' : `2. Escanear el QR y marcar la ${tipo}`}
          </button>
        )}
      </div>
      {escaneando && <Escaner onLeido={registrar} onCerrar={() => setEscaneando(false)} />}
    </>
  );
}
