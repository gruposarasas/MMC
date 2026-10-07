import Link from 'next/link';
import { notFound } from 'next/navigation';
import { actualizarLinea, agregarLinea, borrarLinea, borrarProducto, duplicarProducto } from '@/acciones/costos';
import { BotonAccion, FormAccion } from '@/components/FormAccion';
import { FormProducto, type Prod } from '@/components/FormProducto';
import { Ventana } from '@/components/Ventana';
import { calcular, costoLinea, costoUnitarioArs } from '@/lib/costos';
import { datosCostos, estadoMargen } from '@/lib/datosCostos';
import { db } from '@/lib/db';
import { aTexto, dolares, pesos, porcentaje } from '@/lib/formato';
import { type Params, param, url } from '@/lib/url';

export const metadata = { title: 'Producto · BB-CONTROL' };

export default async function ProductoCostos({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Params> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  if (!Number.isInteger(id) || id <= 0) notFound();
  const [[p], { insumos, mapa, receta, dolar }] = await Promise.all([db()<Prod[]>`select * from productos where id = ${id}`, datosCostos()]);
  if (!p) notFound();
  const lineas = receta.filter((r) => r.producto_id === id);
  const c = calcular(p, lineas, mapa, dolar?.valor ?? null);
  const est = estadoMargen(c.margenPct, p.margen_objetivo);
  const base = `/costos/${id}`;
  const cerrar = url(base, sp, { editar: null });

  const Fila = ({ t, v, fuerte }: { t: string; v: React.ReactNode; fuerte?: boolean }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: '1px solid var(--linea2)', fontWeight: fuerte ? 700 : 400 }}>
      <span>{t}</span>
      <span className="num">{v}</span>
    </div>
  );

  return (
    <>
      <p style={{ margin: '0 0 10px' }}><Link href="/costos" className="link">← Costos</Link></p>
      <div className="cabeza">
        <div>
          <div className="eti">{[p.categoria, p.presentacion].filter(Boolean).join(' · ') || 'Producto'}</div>
          <h1>{p.nombre}</h1>
          {p.notas && <p>{p.notas}</p>}
        </div>
        <div className="acciones">
          <Link className="btn" href={url(base, sp, { editar: 1 })} scroll={false}>Editar precio y datos</Link>
          <BotonAccion accion={duplicarProducto} campos={{ id }} className="btn claro">Duplicar</BotonAccion>
          <BotonAccion accion={borrarProducto} campos={{ id }} className="btn claro" confirmar="¿Borrar este producto y su receta?">Borrar</BotonAccion>
        </div>
      </div>

      <div className="tiles">
        <div className="tile oscuro">
          <div className="t">Margen</div>
          <div className="v">{c.directo && p.precio ? porcentaje(c.margenPct) : '—'}</div>
          <div className="s">{c.directo && p.precio ? `${pesos(c.margen)} por unidad · objetivo ${porcentaje(p.margen_objetivo, 0)}` : 'Cargá la receta y el precio'}</div>
        </div>
        <div className="tile"><div className="t">Costo directo</div><div className="v">{pesos(c.directo)}</div><div className="s">{lineas.length} insumos</div></div>
        <div className="tile"><div className="t">Precio de venta</div><div className="v">{pesos(p.precio)}</div><div className="s">Con IVA {pesos(c.precioConIva)}</div></div>
        <div className="tile"><div className="t">Precio sugerido</div><div className="v">{c.sugerido ? pesos(c.sugerido) : '—'}</div><div className="s">{c.sugeridoConIva ? `Con IVA ${pesos(c.sugeridoConIva)}` : 'Revisá margen y variables'}</div></div>
      </div>
      {est === 'mal' && <div className="aviso mal">El margen está más de 10 puntos debajo del objetivo. Revisá el precio o los costos.</div>}
      {c.faltaDolar && <div className="aviso mal">Hay insumos en dólares y falta la cotización. Cargala en <Link href="/costos">Costos</Link>.</div>}

      <div className="grilla-receta">
        <div className="caja">
          <h2>Receta</h2>
          <p className="sub">Cantidad de cada insumo para una unidad de venta. La merma agranda la cantidad (ej.: el café pierde ~16 % al tostarse).</p>
          <div className="tabla-env">
            <table className="t">
              <thead>
                <tr><th>Insumo</th><th>Cantidad · merma %</th><th className="der">Costo unit.</th><th className="der">Subtotal</th><th /></tr>
              </thead>
              <tbody>
                {lineas.map((l) => {
                  const ins = mapa.get(l.insumo_id)!;
                  const u = costoUnitarioArs(ins, dolar?.valor ?? null);
                  const sub = costoLinea(l, u);
                  return (
                    <tr key={l.id}>
                      <td style={{ minWidth: 170 }}><span className="principal">{ins.nombre}</span><div className="chico">{ins.moneda === 'USD' ? `${dolares(ins.costo)} / ${ins.unidad}` : `${pesos(ins.costo)} / ${ins.unidad}`}</div></td>
                      <td>
                        <FormAccion accion={actualizarLinea} className="linea-form" boton="✓" claseBoton="btn chico claro">
                          <input type="hidden" name="id" value={l.id} />
                          <input name="cantidad" inputMode="decimal" defaultValue={aTexto(l.cantidad)} aria-label="Cantidad" style={{ width: 80 }} />
                          <span className="chico">{ins.unidad}</span>
                          <input name="merma_pct" inputMode="decimal" defaultValue={aTexto(l.merma_pct)} aria-label="Merma %" placeholder="0" style={{ width: 54 }} />
                          <span className="chico">%</span>
                        </FormAccion>
                      </td>
                      <td className="der num chico">{Number.isNaN(u) ? '—' : pesos(u)}</td>
                      <td className="der num principal">{Number.isNaN(sub) ? '—' : pesos(sub)}</td>
                      <td><BotonAccion accion={borrarLinea} campos={{ id: l.id }} className="ico mal" titulo="Quitar">×</BotonAccion></td>
                    </tr>
                  );
                })}
                {!lineas.length && <tr><td colSpan={5} className="vacio">Agregá los insumos abajo.</td></tr>}
              </tbody>
              {lineas.length > 0 && (
                <tfoot><tr><td colSpan={3}>Costo directo</td><td className="der num">{pesos(c.directo)}</td><td /></tr></tfoot>
              )}
            </table>
          </div>
          {insumos.length ? (
            <div style={{ marginTop: 14 }}>
              <FormAccion accion={agregarLinea} boton="Agregar" limpiar>
                <input type="hidden" name="producto_id" value={id} />
                <label className="campo"><span>Insumo</span>
                  <select name="insumo_id" required defaultValue="">
                    <option value="" disabled>Elegí…</option>
                    {insumos.map((i) => <option key={i.id} value={i.id}>{i.nombre} ({i.unidad})</option>)}
                  </select>
                </label>
                <label className="campo"><span>Cantidad</span><input name="cantidad" inputMode="decimal" required /></label>
                <label className="campo"><span>Merma % <em>(opcional)</em></span><input name="merma_pct" inputMode="decimal" placeholder="0" /></label>
              </FormAccion>
            </div>
          ) : (
            <div className="aviso" style={{ marginTop: 12 }}>Primero cargá insumos en <Link href="/costos?ver=insumos&nuevo=1">Costos → Insumos</Link>.</div>
          )}
        </div>
        <div className="caja">
          <h2>Resultado por unidad</h2>
          <Fila t="Costo directo (insumos)" v={pesos(c.directo)} />
          <Fila t={`Costos variables (${porcentaje(p.variables_pct, 1)} del precio)`} v={pesos(c.variables)} />
          <Fila t="Costo total" v={pesos(c.total)} fuerte />
          <Fila t="Precio de venta sin IVA" v={pesos(p.precio)} />
          <Fila t="Margen" v={<span className={`chip ${est}`}>{pesos(c.margen)} · {porcentaje(c.margenPct)}</span>} fuerte />
          <Fila t="Markup sobre costo directo" v={c.markup != null ? porcentaje(c.markup, 0) : '—'} />
          <Fila t={`Precio sugerido (margen ${porcentaje(p.margen_objetivo, 0)})`} v={c.sugerido ? `${pesos(c.sugerido)} · c/IVA ${pesos(c.sugeridoConIva)}` : '—'} />
          {dolar && <p className="sub" style={{ marginTop: 10 }}>Dólar de referencia {pesos(dolar.valor)}. Costo directo en dólares: {dolares(c.directo / dolar.valor)}.</p>}
          {p.precio > 0 && c.directo > 0 && (
            <p className="sub" style={{ marginTop: 6 }}>
              De cada {pesos(p.precio, 0)} que se cobran sin IVA: {pesos(c.directo, 0)} son insumos, {pesos(c.variables, 0)} variables y quedan {pesos(c.margen, 0)}.
            </p>
          )}
        </div>
      </div>

      {param(sp, 'editar') && (
        <Ventana titulo="Editar producto" cerrar={cerrar}>
          <FormProducto p={p} volver={cerrar} />
        </Ventana>
      )}
    </>
  );
}
