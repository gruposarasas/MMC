import { guardarDolar } from '@/acciones/costos';
import { FormAccion } from '@/components/FormAccion';
import type { Dolar } from '@/lib/ajustes';
import { aTexto, fecha } from '@/lib/formato';

export function FormDolar({ dolar }: { dolar: Dolar | null }) {
  return (
    <FormAccion accion={guardarDolar} boton="Guardar" className="form" claseBoton="btn chico">
      <label className="campo">
        <span>Dólar de referencia {dolar && <em>(actualizado el {fecha(dolar.fecha)})</em>}</span>
        <input name="dolar" inputMode="decimal" defaultValue={aTexto(dolar?.valor)} placeholder="Ej.: 1450" required />
      </label>
    </FormAccion>
  );
}
