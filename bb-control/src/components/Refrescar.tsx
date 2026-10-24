'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** Vuelve a pedir la página cada tanto (para ver el avance de algo que corre en el servidor). */
export function Refrescar({ cada }: { cada: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), cada);
    return () => clearInterval(t);
  }, [cada, router]);
  return null;
}
