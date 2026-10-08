'use client';
import { useEffect, useState } from 'react';
import { generarClave } from '@/acciones/equipo';
import { useEnvio } from '@/components/FormAccion';
import { linkWhatsapp } from '@/lib/formato';

export function GenerarClave({ id, tiene, telefono, dni, mensaje }: { id: number; tiene: boolean; telefono: string; dni: string; mensaje: string }) {
  const [estado, onSubmit, pendiente] = useEnvio(generarClave, tiene ? 'Ya tiene una clave. Si generás una nueva, la anterior deja de funcionar. ¿Seguir?' : undefined);
  const [origen, setOrigen] = useState('');
  const [copiado, setCopiado] = useState(false);
  useEffect(() => setOrigen(window.location.origin), []);
  const texto = estado?.clave ? `${mensaje}\n\nEntrá en ${origen}/mi\nUsuario: tu DNI (${dni})\nClave: ${estado.clave}` : '';
  return (
    <form onSubmit={onSubmit}>
      <input type="hidden" name="id" value={id} />
      <p style={{ margin: '0 0 10px', fontSize: 14 }}>
        {tiene ? <span className="chip bien">Ya tiene clave</span> : <span className="chip">Todavía no tiene clave</span>}
      </p>
      {estado?.error && <p className="err">{estado.error}</p>}
      {estado?.clave ? (
        <div className="clave-box" role="status">
          <span style={{ fontSize: 13 }}>Clave nueva (anotala, no se vuelve a mostrar)</span>
          <b>{estado.clave}</b>
          <p>Usuario: su DNI {dni}</p>
          <div className="acciones">
            {telefono && <a className="btn vino chico" href={linkWhatsapp(telefono, texto)} target="_blank" rel="noopener">Mandar por WhatsApp</a>}
            <button
              type="button"
              className="btn claro chico"
              onClick={() => navigator.clipboard?.writeText(texto).then(() => setCopiado(true))}
            >
              {copiado ? 'Copiado' : 'Copiar mensaje'}
            </button>
          </div>
        </div>
      ) : (
        <button className="btn" disabled={pendiente}>{pendiente ? 'Generando…' : tiene ? 'Generar clave nueva' : 'Generar clave'}</button>
      )}
    </form>
  );
}
