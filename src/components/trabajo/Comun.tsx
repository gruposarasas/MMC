'use client';
import { useRouter } from 'next/navigation';
import { toast } from '../Toast';

/** POST con JSON o FormData. Muestra el error en un aviso y devuelve la respuesta (o null si falló). */
export async function enviar(url: string, cuerpo?: object | FormData): Promise<Record<string, unknown> | null> {
  const esForm = typeof FormData !== 'undefined' && cuerpo instanceof FormData;
  const r = await fetch(url, {
    method: 'POST',
    headers: esForm || !cuerpo ? undefined : { 'content-type': 'application/json' },
    body: esForm ? (cuerpo as FormData) : cuerpo ? JSON.stringify(cuerpo) : undefined,
  }).catch(() => null);
  const j = r ? await r.json().catch(() => ({})) : {};
  if (!r || !r.ok) {
    toast((j as { error?: string }).error || 'Algo falló. Revisá tu conexión y probá de nuevo.');
    return null;
  }
  return j as Record<string, unknown>;
}

export function Salir({ url, a = '/trabajo' }: { url: string; a?: string }) {
  const router = useRouter();
  return (
    <button className="bt-link" type="button" onClick={async () => { await enviar(url); router.push(a); router.refresh(); }}>
      Salir
    </button>
  );
}

/** Grupo de opciones tildables (chips). */
export function Chips({ nombre, opciones, valor, cambiar, max }: { nombre: string; opciones: [string, string][]; valor: string[]; cambiar: (v: string[]) => void; max?: number }) {
  return (
    <div className="bt-chips" role="group" aria-label={nombre}>
      {opciones.map(([k, t]) => {
        const on = valor.includes(k);
        return (
          <button key={k} type="button" className={on ? 'on' : ''} aria-pressed={on}
            onClick={() => {
              if (on) cambiar(valor.filter((x) => x !== k));
              else if (!max || valor.length < max) cambiar([...valor, k]);
              else toast(`Podés elegir hasta ${max}.`);
            }}>
            {t}
          </button>
        );
      })}
    </div>
  );
}
