import { guardarCliente } from '@/acciones/clientes';
import { FormAccion } from '@/components/FormAccion';
import { aTexto } from '@/lib/formato';
import { formatoCuit } from '@/lib/proveedores';
import type { ClienteBase } from '@/lib/semaforo';

const FORMAS = ['Transferencia', 'Efectivo', 'Echeq', 'Cheque', 'Cuenta corriente', 'Mercado Pago', 'Tarjeta'];

/** Datos de un cliente para el semáforo. */
export function FormCliente({ c, volver }: { c: ClienteBase | null; volver?: string }) {
  return (
    <FormAccion accion={guardarCliente}>
      {volver && <input type="hidden" name="volver" value={volver} />}
      {c && <input type="hidden" name="id" value={c.id} />}
      <label className="campo ancho">
        <span>Cliente</span>
        <input name="nombre" defaultValue={c?.nombre} required placeholder="Ej.: Entre Dos" />
        <span className="ayuda">Las máquinas de Activos cuyo cliente empieza con este nombre ("Entre Dos Palmares", "Entre Dos Centro") cuentan para este cliente.</span>
      </label>
      <label className="campo ancho">
        <span>Otros nombres <em>(razón social o como figura en Ventas o Activos, separados por coma)</em></span>
        <input name="alias" defaultValue={c?.alias.join(', ')} placeholder="Ej.: Entre Dos SRL, ED Café" />
      </label>
      <label className="campo"><span>CUIT <em>(opcional)</em></span><input name="cuit" defaultValue={c ? formatoCuit(c.cuit) : ''} inputMode="numeric" /></label>
      <label className="campo"><span>Locales</span><input name="locales" type="number" min={1} defaultValue={c?.locales ?? 1} /></label>
      <label className="campo"><span>Kilos de café por mes</span><input name="kilos_mes" inputMode="decimal" defaultValue={aTexto(c?.kilos_mes)} placeholder="Ej.: 60" /></label>
      <label className="casilla" style={{ alignSelf: 'end', paddingBottom: 10 }}>
        <input type="checkbox" name="kilos_desde_ventas" defaultChecked={c?.kilos_desde_ventas} /> Estimar los kilos con lo facturado en Ventas
      </label>
      <label className="campo"><span>Descuento %</span><input name="descuento_pct" inputMode="decimal" defaultValue={aTexto(c?.descuento_pct) || '0'} /></label>
      <label className="campo">
        <span>Forma de pago</span>
        <input name="forma_pago" list="formas-pago" defaultValue={c?.forma_pago ?? 'Transferencia'} />
        <datalist id="formas-pago">{FORMAS.map((x) => <option key={x} value={x} />)}</datalist>
      </label>
      <label className="campo"><span>Plazo de pago (días)</span><input name="plazo_dias" type="number" min={0} max={365} defaultValue={c?.plazo_dias ?? 0} /></label>
      <label className="campo"><span>Comisión del cobro % <em>(tarjeta, Mercado Pago)</em></span><input name="comision_pct" inputMode="decimal" defaultValue={aTexto(c?.comision_pct) || '0'} /></label>
      <label className="campo"><span>Precio especial por kg <em>(sin IVA, opcional)</em></span><input name="precio_kg" inputMode="decimal" defaultValue={aTexto(c?.precio_kg)} placeholder="Vacío = el general" /></label>
      <label className="campo ancho"><span>Notas</span><input name="notas" defaultValue={c?.notas} /></label>
      {c && <label className="casilla ancho"><input type="checkbox" name="activo" defaultChecked={c.activo} /> Activo (entra en el semáforo)</label>}
    </FormAccion>
  );
}
