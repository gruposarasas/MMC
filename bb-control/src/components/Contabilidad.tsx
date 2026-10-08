'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { darAccesoContador, subirArchivoContable } from '@/acciones/contabilidad';
import { useEnvio } from '@/components/FormAccion';

/** Sube un archivo a una obligación del mes (PDF, Excel, CSV, TXT, ZIP o foto). */
export function SubirArchivo({ mes, razon, tipo, titulo }: { mes: string; razon: number; tipo: string; titulo: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; error?: boolean } | null>(null);
  async function subir(f: File | undefined) {
    if (!f) return;
    setSubiendo(true);
    setAviso(null);
    try {
      const datos = new FormData();
      datos.set('mes', mes);
      datos.set('razon_id', String(razon));
      datos.set('tipo', tipo);
      datos.set('archivo', f);
      const r = await subirArchivoContable(null, datos);
      setAviso(r?.error ? { texto: r.error, error: true } : { texto: 'Archivo subido.' });
      if (!r?.error) router.refresh();
    } catch {
      setAviso({ texto: 'No se pudo subir. Revisá la conexión y probá de nuevo.', error: true });
    }
    setSubiendo(false);
    if (input.current) input.current.value = '';
  }
  return (
    <>
      <button type="button" className="btn claro chico" disabled={subiendo} onClick={() => input.current?.click()}>
        {subiendo ? 'Subiendo…' : 'Subir archivo'}
      </button>
      <input
        ref={input}
        type="file"
        hidden
        aria-label={`Archivo de ${titulo}`}
        accept=".pdf,.xls,.xlsx,.csv,.txt,.zip,image/*"
        onChange={(e) => subir(e.target.files?.[0])}
      />
      {aviso && <span className={aviso.error ? 'err' : 'okmsg'} role={aviso.error ? 'alert' : 'status'} style={{ fontSize: 13 }}>{aviso.texto}</span>}
    </>
  );
}

/** Dar acceso al contador, o una clave nueva: la clave se muestra una sola vez, lista para mandar. */
export function AccesoContador({ id, boton, confirmar, children }: { id?: number; boton: string; confirmar?: string; children?: React.ReactNode }) {
  const [estado, onSubmit, pendiente] = useEnvio(darAccesoContador, confirmar);
  const [origen, setOrigen] = useState('');
  const [copiado, setCopiado] = useState(false);
  useEffect(() => setOrigen(window.location.origin), []);
  const texto = estado?.clave
    ? `Te damos acceso a la contabilidad de Bruno Brown en BB-CONTROL.\n\nEntrá en ${origen}/contador\nMail: ${estado.ok}\nClave: ${estado.clave}`
    : '';
  if (estado?.clave) {
    return (
      <div className="clave-box" role="status">
        <span style={{ fontSize: 13 }}>Clave para {estado.ok} (anotala, no se vuelve a mostrar)</span>
        <b>{estado.clave}</b>
        <p style={{ margin: '6px 0 10px', fontSize: 13 }}>Entra en {origen}/contador con su mail y esta clave.</p>
        <div className="acciones">
          <a className="btn vino chico" href={`mailto:${estado.ok}?subject=${encodeURIComponent('Acceso a BB-CONTROL')}&body=${encodeURIComponent(texto)}`}>Mandar por mail</a>
          <button type="button" className="btn claro chico" onClick={() => navigator.clipboard?.writeText(texto).then(() => setCopiado(true))}>
            {copiado ? 'Copiado' : 'Copiar mensaje'}
          </button>
        </div>
      </div>
    );
  }
  return (
    <form className={id ? undefined : 'form'} onSubmit={onSubmit} style={id ? { display: 'inline' } : undefined}>
      {id && <input type="hidden" name="id" value={id} />}
      {children}
      {estado?.error && <p className="err" role="alert">{estado.error}</p>}
      <div className={id ? undefined : 'form-pie'} style={id ? { display: 'inline' } : undefined}>
        <button className={id ? 'ico' : 'btn'} disabled={pendiente}>{pendiente ? 'Generando…' : boton}</button>
      </div>
    </form>
  );
}
