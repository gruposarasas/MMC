import Link from 'next/link';
import { Titulo } from '@/components/Titulo';
import { borrarInsumo, guardarInsumo } from '@/acciones/costos';
import { BotonAccion, FormAccion } from '@/components/FormAccion';
import { FormDolar } from '@/components/FormDolar';
import { FormProducto, type Prod } from '@/components/FormProducto';
import { Importador } from '@/components/Importador';
import { traerProductosContabilium } from '@/acciones/contabilium';
import { BotonContabilium } from '@/components/Contabilium';
import { credenciales } from '@/lib/contabilium';
import { Ventana } from '@/components/Ventana';
import { calcular, costoUnitarioArs } from '@/lib/costos';
import { datosCostos, estadoMargen } from '@/lib/datosCostos';
import { db } from '@/lib/db';
import { aTexto, dolares, fecha, numero, pesos, porcentaje } from '@/lib/formato';
import { type Params, param, url } from '@/lib/url';

export const metadata = { title: 'Costos · BB-CONTROL' };

const UNIDADES = ['kg', 'g', 'l', 'ml', 'u'];

export default async function Costos({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const ver = param(sp, 'ver') === 'insumos' ? 'insumos' : 'productos';
  const [{ insumos, mapa, receta, dolar }, productos, cred] = await Promise.all([
    datosCostos(),
    db()<Prod[]>`select * from productos order by categoria, nombre`,
    credenciales(),
  ]);
  const cerrar = url('/costos', sp, { nuevo: null, editar: null, importar: null });
  const editar = Number(param(sp, 'editar')) || 0;
  const insumoEdit = editar ? insumos.find((i) => i.id === editar) : null;
  const nuevo = param(sp, 'nuevo');
  const hayUsd = insumos.some((i) => i.moneda === 'USD');

  return (
    <>
      <div className="cabeza">
        <Titulo modulo="costos" titulo="Costos">
          Ingeniería de costos de cada producto: insumos, mermas, costos variables y margen.
        </Titulo>
        <div className="acciones">
          {cred && ver === 'productos' && <BotonContabilium accion={traerProductosContabilium} texto="Traer productos de Contabilium" cargando="Trayendo productos…" />}
          <Link className="btn claro" href={url('/costos', sp, { importar: 1, nuevo: null, editar: null })} scroll={false}>
            {ver === 'insumos' ? 'Importar insumos' : 'Importar productos'}
          </Link>
          <Link className="btn vino" href={url('/costos', sp, { nuevo: 1 })} scroll={false}>
            {ver === 'insumos' ? '+ Nuevo insumo' : '+ Nuevo producto'}
          </Link>
        </div>
      </div>

      <div className="grilla2" style={{ marginBottom: 18 }}>
        <div className="caja">
          <h2>Dólar</h2>
          <p className="sub">Los insumos en dólares se pasan a pesos con esta cotización. Cambiala y se recalcula todo.</p>
          <FormDolar dolar={dolar} />
          {hayUsd && !dolar && <div className="aviso mal" style={{ marginTop: 10 }}>Hay insumos en dólares: cargá la cotización para ver sus costos.</div>}
        </div>
        <div className="caja">
          <h2>Cómo se calcula</h2>
          <p className="sub" style={{ margin: 0 }}>
            <b>Costo directo</b> = suma de insumos × cantidad (agrandada por la merma). <b>Costos variables</b> = % del precio (comisiones, IIBB, tarjeta).
            <b> Margen</b> = precio sin IVA − costo directo − variables. <b>Precio sugerido</b> = el que deja el margen objetivo.
          </p>
        </div>
      </div>

      <nav className="pestanas">
        <Link href="/costos" className={ver === 'productos' ? 'on' : ''}>Productos ({productos.length})</Link>
        <Link href="/costos?ver=insumos" className={ver === 'insumos' ? 'on' : ''}>Insumos ({insumos.length})</Link>
      </nav>

      {ver === 'productos' && (
        <div className="tabla-env">
          <table className="t">
            <thead>
              <tr>
                <th>Producto</th>
                <th className="der">Costo directo</th>
                <th className="der">Precio s/IVA</th>
                <th className="der">Margen</th>
                <th className="der">Markup</th>
                <th className="der">Precio sugerido</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {productos.map((p) => {
                const c = calcular(p, receta.filter((r) => r.producto_id === p.id), mapa, dolar?.valor ?? null);
                const est = estadoMargen(c.margenPct, p.margen_objetivo);
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/costos/${p.id}`} className="principal" style={{ textDecoration: 'none' }}>{p.nombre}</Link>
                      <div className="chico">{[p.categoria, p.presentacion].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="der num">{c.directo ? pesos(c.directo) : <span className="chico">Sin receta</span>}{c.faltaDolar && <div className="chico neg">falta el dólar</div>}</td>
                    <td className="der num">{p.precio ? pesos(p.precio) : '—'}</td>
                    <td className="der">
                      {c.margenPct != null && c.directo ? (
                        <span className={`chip ${est}`}>{porcentaje(c.margenPct)}</span>
                      ) : '—'}
                      {c.directo > 0 && p.precio > 0 && <div className="chico num">{pesos(c.margen, 0)}</div>}
                    </td>
                    <td className="der num">{c.markup != null ? porcentaje(c.markup, 0) : '—'}</td>
                    <td className="der num">{c.sugerido ? pesos(c.sugerido, 0) : '—'}<div className="chico">objetivo {porcentaje(p.margen_objetivo, 0)}</div></td>
                    <td><Link className="ico" href={`/costos/${p.id}`}>Abrir</Link></td>
                  </tr>
                );
              })}
              {!productos.length && <tr><td colSpan={7} className="vacio">Todavía no hay productos. Primero cargá los insumos y después armá cada producto.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {ver === 'insumos' && (
        <div className="tabla-env">
          <table className="t">
            <thead>
              <tr><th>Insumo</th><th>Unidad</th><th className="der">Costo por unidad</th><th className="der">En pesos</th><th>Actualizado</th><th className="der">Usos</th><th /></tr>
            </thead>
            <tbody>
              {insumos.map((i) => {
                const ars = costoUnitarioArs(i, dolar?.valor ?? null);
                return (
                  <tr key={i.id}>
                    <td><span className="principal">{i.nombre}</span>{i.categoria && <div className="chico">{i.categoria}</div>}</td>
                    <td>{i.unidad}</td>
                    <td className="der num">{i.moneda === 'USD' ? dolares(i.costo) : pesos(i.costo)}</td>
                    <td className="der num">{Number.isNaN(ars) ? <span className="chico neg">falta el dólar</span> : pesos(ars)}</td>
                    <td className="chico">{fecha(i.actualizado)}</td>
                    <td className="der num">{i.usos}</td>
                    <td>
                      <div className="iconos">
                        <Link className="ico" href={url('/costos', sp, { editar: i.id })} scroll={false}>Editar</Link>
                        {i.usos === 0 && <BotonAccion accion={borrarInsumo} campos={{ id: i.id }} className="ico mal" confirmar="¿Borrar este insumo?">Borrar</BotonAccion>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!insumos.length && <tr><td colSpan={7} className="vacio">Cargá los insumos: café verde, bolsas, válvulas, etiquetas, mano de obra, flete…</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {ver === 'insumos' && (nuevo || insumoEdit) && (
        <Ventana titulo={insumoEdit ? 'Editar insumo' : 'Nuevo insumo'} cerrar={cerrar}>
          <FormAccion accion={guardarInsumo}>
            <input type="hidden" name="volver" value={cerrar} />
            {insumoEdit && <input type="hidden" name="id" value={insumoEdit.id} />}
            <label className="campo ancho"><span>Nombre</span><input name="nombre" defaultValue={insumoEdit?.nombre} required placeholder="Ej.: Café verde Brasil Santos" /></label>
            <label className="campo"><span>Categoría</span>
              <input name="categoria" list="cats" defaultValue={insumoEdit?.categoria} />
              <datalist id="cats">{['Café', 'Packaging', 'Mano de obra', 'Fletes', 'Otros'].map((c) => <option key={c} value={c} />)}</datalist>
            </label>
            <label className="campo"><span>Unidad</span>
              <select name="unidad" defaultValue={insumoEdit?.unidad ?? 'kg'}>{UNIDADES.map((u) => <option key={u}>{u}</option>)}</select>
            </label>
            <label className="campo"><span>Moneda</span>
              <select name="moneda" defaultValue={insumoEdit?.moneda ?? 'ARS'}><option value="ARS">Pesos</option><option value="USD">Dólares</option></select>
            </label>
            <label className="campo"><span>Costo por unidad <em>(sin IVA)</em></span><input name="costo" inputMode="decimal" defaultValue={aTexto(insumoEdit?.costo)} required /></label>
            <label className="campo ancho"><span>Notas</span><input name="notas" defaultValue={insumoEdit?.notas} /></label>
          </FormAccion>
        </Ventana>
      )}

      {param(sp, 'importar') && (
        <Ventana titulo={ver === 'insumos' ? 'Importar insumos desde Excel' : 'Importar productos desde Excel'} cerrar={cerrar} ancha>
          <Importador tipo={ver === 'insumos' ? 'insumo' : 'producto'} destino={ver === 'insumos' ? '/costos?ver=insumos' : '/costos'} />
        </Ventana>
      )}

      {ver === 'productos' && nuevo && (
        <Ventana titulo="Nuevo producto" cerrar={cerrar}>
          <FormProducto />
        </Ventana>
      )}
      {insumos.length > 0 && ver === 'productos' && productos.length > 0 && (
        <p className="mas">{numero(insumos.length)} insumos cargados · el margen se pinta según el objetivo de cada producto.</p>
      )}
    </>
  );
}
