'use client';
import { useRef } from 'react';
import { EVENTO_FIN } from '@/lib/config';
import { toast } from './Toast';

/** Achica la imagen (por defecto a 260 px como máximo) y la devuelve como data URL (PNG, o JPG para fotos). */
export function achicar(file: File, max = 260, tipo: 'image/png' | 'image/jpeg' = 'image/png'): Promise<string> {
  return new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(im.width * k));
        c.height = Math.max(1, Math.round(im.height * k));
        const x = c.getContext('2d')!;
        if (tipo === 'image/jpeg') { x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
        x.drawImage(im, 0, 0, c.width, c.height);
        ok(tipo === 'image/jpeg' ? c.toDataURL(tipo, 0.85) : c.toDataURL(tipo));
      };
      im.onerror = mal;
      im.src = r.result as string;
    };
    r.onerror = mal;
    r.readAsDataURL(file);
  });
}

export type ValorCupon = { logo: string; vence: string; sucursales: string };

/** Logo, vencimiento y sucursales: lo que completa la marca (y también administración). */
export function CamposCupon({ v, set }: { v: ValorCupon; set: (x: Partial<ValorCupon>) => void }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <div className="grid2">
        <div className="campo">
          <label htmlFor="mLogo">Logo de la marca</label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {v.logo && (
              <>
                <span className="logo-tile" style={{ width: 64, height: 64 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.logo} alt="" />
                </span>
                <button type="button" className="link" onClick={() => set({ logo: '' })}>Quitar</button>
              </>
            )}
            <label className="btn chico linea" style={{ margin: 0, cursor: 'pointer', position: 'relative' }}>
              {v.logo ? 'Cambiar' : 'Subir logo'}
              <input
                ref={input}
                type="file"
                id="mLogo"
                accept="image/png,image/jpeg,image/webp"
                style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
                onChange={async () => {
                  const f = input.current?.files?.[0];
                  if (!f) return;
                  try {
                    set({ logo: await achicar(f) });
                  } catch {
                    toast('No se pudo leer la imagen.');
                  }
                  if (input.current) input.current.value = '';
                }}
              />
            </label>
          </div>
          <div className="ayuda">PNG o JPG. Aparece en el cupón en lugar de la figura.</div>
        </div>
        <div className="campo">
          <label htmlFor="mVence">Vence el</label>
          <input id="mVence" type="date" min={EVENTO_FIN} value={v.vence} onChange={(e) => set({ vence: e.target.value })} />
          <div className="ayuda">Con el 4 de octubre, vale solo durante el Mundial. Con una fecha posterior, también se puede usar en las sucursales.</div>
        </div>
      </div>
      <div className="campo">
        <label htmlFor="mSuc">Dónde se puede usar después del Mundial</label>
        <input id="mSuc" value={v.sucursales} onChange={(e) => set({ sucursales: e.target.value })} placeholder="Nombre de la sucursal y dirección" maxLength={300} />
      </div>
    </>
  );
}
