'use client';
import { startTransition, useActionState, useEffect, useRef } from 'react';
import type { Estado } from '@/lib/form';

type Accion = (prev: Estado, f: FormData) => Promise<Estado>;

/**
 * Envía el formulario a una server action sin el reseteo automático de React 19
 * (que borra lo escrito aunque la acción devuelva un error).
 */
export function useEnvio(accion: Accion, confirmar?: string) {
  const [estado, enviar, pendiente] = useActionState(accion, null);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (confirmar && !window.confirm(confirmar)) return;
    const datos = new FormData(e.currentTarget);
    startTransition(() => enviar(datos));
  };
  return [estado, onSubmit, pendiente] as const;
}

type Props = {
  accion: Accion;
  children: React.ReactNode;
  boton?: string;
  className?: string;
  claseBoton?: string;
  confirmar?: string;
  limpiar?: boolean; // vacía el formulario después de guardar bien
  pie?: React.ReactNode;
  mostrar?: (e: NonNullable<Estado>) => React.ReactNode;
};

export function FormAccion({ accion, children, boton = 'Guardar', className = 'form', claseBoton = 'btn', confirmar, limpiar, pie, mostrar }: Props) {
  const [estado, onSubmit, pendiente] = useEnvio(accion, confirmar);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (limpiar && estado?.ok) ref.current?.reset();
  }, [estado, limpiar]);
  return (
    <form ref={ref} className={className} onSubmit={onSubmit}>
      {children}
      {estado?.error && <p className="err" role="alert">{estado.error}</p>}
      {estado?.ok && !mostrar && <p className="okmsg" role="status">{estado.ok}</p>}
      {estado && mostrar?.(estado)}
      <div className="form-pie">
        {pie}
        <button className={claseBoton} disabled={pendiente}>
          {pendiente ? 'Guardando…' : boton}
        </button>
      </div>
    </form>
  );
}

/** Botón chico que ejecuta una acción (borrar, aprobar…) con confirmación opcional. */
export function BotonAccion({
  accion,
  campos,
  children,
  confirmar,
  className = 'ico',
  titulo,
}: {
  accion: (f: FormData) => Promise<void>;
  campos: Record<string, string | number>;
  children: React.ReactNode;
  confirmar?: string;
  className?: string;
  titulo?: string;
}) {
  return (
    <form
      action={accion}
      style={{ display: 'inline' }}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      {Object.entries(campos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <button className={className} title={titulo} aria-label={titulo}>
        {children}
      </button>
    </form>
  );
}
