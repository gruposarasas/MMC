'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Panel lateral para altas y ediciones. Se abre con un parámetro en la URL. */
export function Ventana({ titulo, cerrar, children, ancha }: { titulo: string; cerrar: string; children: React.ReactNode; ancha?: boolean }) {
  const router = useRouter();
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && router.push(cerrar, { scroll: false });
    window.addEventListener('keydown', tecla);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', tecla);
      document.body.style.overflow = '';
    };
  }, [cerrar, router]);
  return (
    <div className="velo" onClick={(e) => e.target === e.currentTarget && router.push(cerrar, { scroll: false })}>
      <div className={`ventana${ancha ? ' ancha' : ''}`} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="ventana-cab">
          <h2>{titulo}</h2>
          <Link className="cerrar" href={cerrar} scroll={false} aria-label="Cerrar">
            ×
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
