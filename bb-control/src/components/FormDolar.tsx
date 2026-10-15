'use client';
import { useState } from 'react';
import { guardarDolar } from '@/acciones/costos';
import { FormAccion } from '@/components/FormAccion';
import type { Dolar } from '@/lib/ajustes';
import { aTexto, fecha, pesos } from '@/lib/formato';

/** Dólar de referencia: el de venta del BNA (se actualiza solo) o uno fijo cargado a mano. */
export function FormDolar({ dolar }: { dolar: Dolar | null }) {
  const [auto, setAuto] = useState(dolar?.auto !== false);
  const hora = dolar?.actualizado
    ? new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Mendoza', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(dolar.actualizado))
    : '';
  return (
    <FormAccion accion={guardarDolar} boton={auto ? 'Actualizar ahora' : 'Guardar'} className="form" claseBoton="btn chico">
      <label className="casilla ancho">
        <input type="checkbox" name="auto" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Dólar BNA automático (venta billete, se actualiza solo)
      </label>
      {auto ? (
        <p className="sub ancho" style={{ margin: 0 }}>
          {dolar?.fuente === 'BNA'
            ? <>Hoy: <b>{pesos(dolar.valor)}</b>{dolar.compra ? ` (compra ${pesos(dolar.compra)})` : ''} · del {fecha(dolar.fecha)}{hora && `, actualizado ${hora}`}.</>
            : 'Tocá "Actualizar ahora" para traerlo por primera vez.'}
        </p>
      ) : (
        <label className="campo">
          <span>Dólar fijo {dolar && <em>(actualizado el {fecha(dolar.fecha)})</em>}</span>
          <input name="dolar" inputMode="decimal" defaultValue={aTexto(dolar?.valor)} placeholder="Ej.: 1450" required />
        </label>
      )}
    </FormAccion>
  );
}
