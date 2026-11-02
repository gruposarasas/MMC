import { resolverSalida } from '@/acciones/fichaje';
import { FormAccion } from './FormAccion';

/** Las tres salidas posibles de una salida sin marcar: confirmar la hora pedida, poner otra o rechazar. */
export function ResolverSalida({ id, pedida }: { id: number; pedida: string | null }) {
  return (
    <div className="resolver-salida">
      {pedida && (
        <FormAccion accion={resolverSalida} boton={`Confirmar ${pedida}`} className="linea-form" claseBoton="btn chico">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="accion" value="confirmar" />
        </FormAccion>
      )}
      <FormAccion accion={resolverSalida} boton="Poner esta hora" className="linea-form" claseBoton="btn chico claro">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="accion" value="corregir" />
        <input type="time" name="hora" required aria-label="Hora de salida" className="hora-chica" />
      </FormAccion>
      <FormAccion accion={resolverSalida} boton="Rechazar" className="linea-form" claseBoton="btn chico claro" confirmar="¿Rechazar? Ese día suma 0 horas.">
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="accion" value="rechazar" />
      </FormAccion>
    </div>
  );
}
