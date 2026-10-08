'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { leerFacturaAccion } from '@/acciones/factura';

/** Las fotos grandes se achican en el celular antes de subirlas (la lectura no necesita más). */
async function achicar(f: File): Promise<Blob> {
  if (!f.type.startsWith('image/') || (f.size < 1_500_000 && /^image\/(jpeg|png|webp)$/.test(f.type))) return f;
  try {
    const bmp = await createImageBitmap(f);
    const escala = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * escala);
    c.height = Math.round(bmp.height * escala);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    return (await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.85))) ?? f;
  } catch {
    return f; // si el navegador no puede, se sube tal cual
  }
}

/** Saca una foto (o elige un PDF) de la factura y completa el formulario con lo que se lee. */
export function LectorFactura({ tipo, destino, otra }: { tipo: 'compra' | 'gasto'; destino: string; otra?: boolean }) {
  const router = useRouter();
  const archivo = useRef<HTMLInputElement>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState('');

  async function leer(f: File | undefined) {
    if (!f) return;
    setError('');
    setLeyendo(true);
    try {
      const datos = new FormData();
      datos.set('tipo', tipo);
      const b = await achicar(f);
      datos.set('factura', b, b === f ? f.name : f.name.replace(/\.\w+$/, '') + '.jpg');
      const r = await leerFacturaAccion(null, datos);
      if (r?.lectura) {
        router.push(`${destino}${destino.includes('?') ? '&' : '?'}leida=${r.lectura}`, { scroll: false });
        return;
      }
      setError(r?.error ?? 'No se pudo leer la factura.');
    } catch {
      setError('No se pudo leer la factura. Revisá la conexión y probá de nuevo.');
    }
    setLeyendo(false);
    if (archivo.current) archivo.current.value = '';
  }

  return (
    <div className={`lector${leyendo ? ' leyendo' : ''}`} aria-busy={leyendo}>
      <img src="/img/estrella.png" alt="" />
      <div>
        <b>{leyendo ? 'Leyendo la factura…' : otra ? '¿Otra factura?' : '¿Tenés la factura a mano?'}</b>
        <p>{leyendo ? 'Tarda entre 10 y 30 segundos.' : 'Sacale una foto o subí el PDF y se completa todo solo. Después revisás y guardás.'}</p>
      </div>
      <button type="button" className="btn" disabled={leyendo} onClick={() => archivo.current?.click()}>
        {leyendo ? 'Leyendo…' : 'Leer foto o PDF'}
      </button>
      <input ref={archivo} type="file" accept="image/*,application/pdf" hidden onChange={(e) => leer(e.target.files?.[0])} />
      {error && <p className="err" role="alert">{error}</p>}
    </div>
  );
}
