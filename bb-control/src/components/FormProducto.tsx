import { guardarProducto } from '@/acciones/costos';
import { FormAccion } from '@/components/FormAccion';
import type { Producto } from '@/lib/costos';
import { aTexto } from '@/lib/formato';

export type Prod = Producto & { id: number; nombre: string; categoria: string; presentacion: string; activo: boolean; notas: string };

export function FormProducto({ p, volver }: { p?: Prod; volver?: string }) {
  return (
    <FormAccion accion={guardarProducto}>
      {volver && <input type="hidden" name="volver" value={volver} />}
      {p && <input type="hidden" name="id" value={p.id} />}
      <label className="campo ancho"><span>Nombre</span><input name="nombre" defaultValue={p?.nombre} required placeholder="Ej.: Café tostado Brasil" /></label>
      <label className="campo"><span>Categoría</span><input name="categoria" defaultValue={p?.categoria} placeholder="Café en grano" /></label>
      <label className="campo"><span>Presentación</span><input name="presentacion" defaultValue={p?.presentacion} placeholder="Bolsa 1 kg" /></label>
      <label className="campo"><span>Precio de venta sin IVA</span><input name="precio" inputMode="decimal" defaultValue={aTexto(p?.precio)} /></label>
      <label className="campo"><span>IVA</span>
        <select name="iva_alicuota" defaultValue={String(p?.iva_alicuota ?? 21)}>
          <option value="21">21 %</option><option value="10.5">10,5 %</option><option value="0">Sin IVA</option>
        </select>
      </label>
      <label className="campo"><span>Costos variables <em>(% del precio)</em></span><input name="variables_pct" inputMode="decimal" defaultValue={aTexto(p?.variables_pct)} placeholder="Ej.: 5 (IIBB + tarjeta)" /></label>
      <label className="campo"><span>Margen objetivo <em>(%)</em></span><input name="margen_objetivo" inputMode="decimal" defaultValue={aTexto(p?.margen_objetivo ?? 40)} /></label>
      <label className="campo ancho"><span>Notas</span><textarea name="notas" defaultValue={p?.notas} /></label>
    </FormAccion>
  );
}
