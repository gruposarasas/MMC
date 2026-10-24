import Link from 'next/link';
import { guardarCriterios } from '@/acciones/clientes';
import { FormAccion } from '@/components/FormAccion';
import { TabsClientes } from '@/components/TabsClientes';
import { Titulo } from '@/components/Titulo';
import { criterios, MESES_VENTAS } from '@/lib/clientes';
import { db } from '@/lib/db';
import { aTexto, mesActual, numero, pesos, sumarMeses } from '@/lib/formato';
import { esCafe } from '@/lib/kilos';
import { CRITERIOS_DEFECTO, INDICADORES, type Indicador } from '@/lib/semaforo';

export const metadata = { title: 'Criterios del semáforo · BB-CONTROL' };

const UNIDAD: Record<Indicador, string> = { margen: '%', recupero: 'meses', kgMaquina: 'kg', plazo: 'días', descuento: '%' };

export default async function Criterios() {
  const [{ cr, origen }, productos, rubros] = await Promise.all([
    criterios(),
    db()<{ id: number; nombre: string; presentacion: string; precio: number }[]>`
      select id, nombre, presentacion, precio from productos where activo order by lower(nombre), presentacion`,
    // Rubros de los productos vendidos en los últimos meses (de Contabilium), para elegir cuáles son café.
    db()<{ rubro: string; kilos: number; neto: number; ejemplo: string }[]>`
      select i.rubro, sum(i.kilos) kilos, sum(i.neto) neto, max(i.concepto) ejemplo
      from venta_items i join ventas v on v.id = i.venta_id
      where v.fecha >= ${`${sumarMeses(mesActual(), -MESES_VENTAS)}-01`} and i.rubro <> ''
      group by 1 order by 3 desc`,
  ]);
  const d = CRITERIOS_DEFECTO;

  return (
    <>
      <div className="cabeza">
        <Titulo modulo="clientes" titulo="Criterios del semáforo">
          Con qué precio y costo del café se hace la cuenta, cuánto cuesta la plata y qué es verde o rojo en cada variable.
        </Titulo>
      </div>
      <TabsClientes actual="/clientes/criterios" />

      <div className="caja">
        <FormAccion accion={guardarCriterios} boton="Guardar criterios">
          <div className="ancho">
            <h2>Precio y costo del kilo de café</h2>
            <p className="sub" style={{ margin: 0 }}>
              Lo más fácil es elegir el producto de <Link className="link" href="/costos">Costos</Link> que más venden a cafeterías: su costo sigue al dólar del día.
              Un cliente con precio especial lo carga en su ficha.
            </p>
          </div>
          <label className="campo">
            <span>Producto de referencia</span>
            <select name="productoId" defaultValue={cr.productoId ?? ''}>
              <option value="">Ninguno: lo pongo a mano</option>
              {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.presentacion ? ` (${p.presentacion})` : ''} · {pesos(p.precio, 0)}</option>)}
            </select>
          </label>
          <label className="campo">
            <span>Kilos de esa presentación</span>
            <input name="kgPorUnidad" inputMode="decimal" defaultValue={aTexto(cr.kgPorUnidad)} />
            <span className="ayuda">Ej.: 1 para la bolsa de 1 kg, 0,25 para la de ¼.</span>
          </label>
          <label className="campo">
            <span>Precio por kg a mano <em>(sin IVA)</em></span>
            <input name="precioKg" inputMode="decimal" defaultValue={cr.productoId ? '' : aTexto(cr.precioKg)} placeholder="Si no elegís producto" />
          </label>
          <label className="campo">
            <span>Costo por kg a mano</span>
            <input name="costoKg" inputMode="decimal" defaultValue={cr.productoId ? '' : aTexto(cr.costoKg)} placeholder="Si no elegís producto" />
          </label>
          <p className="ancho cot-bna" style={{ margin: 0 }}>
            {cr.precioKg && cr.costoKg ? (
              <>Hoy: <b>{pesos(cr.precioKg, 0)}</b> el kilo de lista y <b>{pesos(cr.costoKg, 0)}</b> de costo ({Math.round((1 - cr.costoKg / cr.precioKg) * 100)} % de margen del café){origen ? `, según ${origen}` : ', cargados a mano'}.</>
            ) : 'Todavía no hay precio y costo del kilo: sin eso el semáforo no se puede calcular.'}
          </p>

          {rubros.length > 0 && (
            <div className="ancho" style={{ marginTop: 10 }}>
              <h2>Qué es café</h2>
              <p className="sub">
                Para los clientes con "kilos según ventas", se suman los kilos de los productos de estos rubros que les facturaste
                (los kilos salen del nombre: "1 kg", "250 g"). Si no tildás ninguno, cuentan los rubros que dicen "café".
              </p>
              <div className="lista-rubros">
                {rubros.map((r) => (
                  <label key={r.rubro} className="casilla">
                    <input type="checkbox" name="rubro_cafe" value={r.rubro} defaultChecked={cr.rubrosCafe?.length ? cr.rubrosCafe.includes(r.rubro) : esCafe(r.rubro, '', null)} />
                    <span>{r.rubro}<small> · {r.kilos ? `${numero(r.kilos)} kg` : 'sin kilos en el nombre'} · {pesos(r.neto, 0)} · ej.: {r.ejemplo}</small></span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="ancho" style={{ marginTop: 10 }}>
            <h2>Lo que cuesta tener al cliente</h2>
          </div>
          <label className="campo">
            <span>Tasa en pesos por mes %</span>
            <input name="tasaMensual" inputMode="decimal" defaultValue={aTexto(cr.tasaMensual)} />
            <span className="ayuda">Lo que cuesta esperar el pago: un cliente a 30 días cuesta esta tasa sobre lo que paga.</span>
          </label>
          <label className="campo">
            <span>Costo del capital en máquinas % anual</span>
            <input name="tasaMaquinasAnual" inputMode="decimal" defaultValue={aTexto(cr.tasaMaquinasAnual)} />
            <span className="ayuda">En dólares, porque el valor de las máquinas ya sigue al dólar. Lo que rendiría esa plata en otra cosa.</span>
          </label>
          <label className="campo">
            <span>Vida útil de las máquinas (meses)</span>
            <input name="vidaUtilMeses" type="number" min={1} defaultValue={cr.vidaUtilMeses} />
            <span className="ayuda">La inversión se amortiza en estos meses. {d.vidaUtilMeses} = {d.vidaUtilMeses / 12} años.</span>
          </label>
          <label className="campo">
            <span>Service por equipo y por mes $</span>
            <input name="serviceMaquinaMes" inputMode="decimal" defaultValue={aTexto(cr.serviceMaquinaMes)} />
            <span className="ayuda">Mantenimiento, repuestos y visitas. 0 si no lo querés contar.</span>
          </label>

          <div className="ancho" style={{ marginTop: 10 }}>
            <h2>Verde, rojo y peso de cada variable</h2>
            <p className="sub">
              En el valor verde (o mejor) la variable da 100 puntos; en el rojo (o peor), 0; en el medio, proporcional.
              El semáforo es el promedio según el peso: verde desde 67 puntos, amarillo desde 40. Si el cliente da pérdida, rojo igual.
            </p>
            <div className="tabla-env">
              <table className="t tabla-criterios">
                <thead><tr><th>Variable</th><th className="der">Verde</th><th className="der">Rojo</th><th className="der">Peso %</th></tr></thead>
                <tbody>
                  {(Object.keys(INDICADORES) as Indicador[]).map((k) => (
                    <tr key={k}>
                      <td>
                        {INDICADORES[k].nombre}
                        <div className="chico">{INDICADORES[k].ayuda}. {INDICADORES[k].mejorAlto ? 'Más es mejor' : 'Menos es mejor'} ({UNIDAD[k]}).</div>
                      </td>
                      <td className="der"><input name={`${k}_verde`} inputMode="decimal" defaultValue={aTexto(cr.umbrales[k][0])} aria-label={`${INDICADORES[k].nombre}: verde`} /></td>
                      <td className="der"><input name={`${k}_rojo`} inputMode="decimal" defaultValue={aTexto(cr.umbrales[k][1])} aria-label={`${INDICADORES[k].nombre}: rojo`} /></td>
                      <td className="der"><input name={`${k}_peso`} inputMode="decimal" defaultValue={aTexto(cr.pesos[k])} aria-label={`${INDICADORES[k].nombre}: peso`} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="chico" style={{ margin: '8px 0 0' }}>
              Los pesos no tienen que sumar 100: se promedian. "Kilos por máquina" no cuenta en los clientes sin máquinas de café.
              De fábrica: margen {d.umbrales.margen.join(' / ')} %, recupero {d.umbrales.recupero.join(' / ')} meses, {d.umbrales.kgMaquina.join(' / ')} kg por máquina,
              plazo {d.umbrales.plazo.join(' / ')} días y descuento {d.umbrales.descuento.join(' / ')} %.
            </p>
          </div>
        </FormAccion>
      </div>
    </>
  );
}
