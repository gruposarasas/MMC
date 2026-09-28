'use client';
import { useRouter } from 'next/navigation';

export function Salir({ nombre }: { nombre: string }) {
  const router = useRouter();
  return (
    <button
      className="link"
      onClick={async () => {
        await fetch('/api/salir', { method: 'POST' }).catch(() => {});
        router.replace('/');
        router.refresh();
      }}
    >
      No soy {nombre}
    </button>
  );
}
