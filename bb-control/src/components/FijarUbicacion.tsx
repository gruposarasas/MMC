'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { fijarUbicacion } from '@/acciones/fichaje';

/** Toma la ubicación del teléfono parado en el lugar (como "Fijar la ubicación del local desde acá" de Sara). */
export function FijarUbicacion({ id }: { id: number }) {
  const router = useRouter();
  const [estado, setEstado] = useState<{ ok?: string; error?: string } | null>(null);
  const [buscando, setBuscando] = useState(false);
  const fijar = () => {
    if (!navigator.geolocation) { setEstado({ error: 'Este equipo no informa la ubicación.' }); return; }
    setBuscando(true);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const r = await fijarUbicacion({ id, lat: p.coords.latitude, lng: p.coords.longitude, precision: p.coords.accuracy });
        setEstado(r);
        setBuscando(false);
        if (r.ok) router.refresh();
      },
      (e) => { setEstado({ error: e.code === 1 ? 'Permití el acceso a la ubicación.' : 'No se pudo obtener la ubicación.' }); setBuscando(false); },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };
  return (
    <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <button type="button" className="btn chico claro" onClick={fijar} disabled={buscando}>{buscando ? 'Buscando…' : 'Fijar la ubicación desde acá'}</button>
      {estado?.ok && <span className="okmsg" style={{ fontSize: 13 }}>{estado.ok}</span>}
      {estado?.error && <span className="err" style={{ fontSize: 13 }}>{estado.error}</span>}
    </span>
  );
}
