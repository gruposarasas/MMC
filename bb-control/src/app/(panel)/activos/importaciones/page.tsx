import Link from 'next/link';
import { borrarImportacionActivos } from '@/acciones/activos';
import { FormImportacion } from '@/components/Activos';
import { BotonAccion } from '@/components/FormAccion';
import { TabsActivos } from '@/components/TabsActivos';
import { Tile } from '@/components/Tile';
import { Titulo } from '@/components/Titulo';
import { Ventana } from '@/components/Ventana';
import { costoActivo, GASTOS_IMPORTACION, gastosImportacion, type Importacion, SINGULAR } from '@/lib/activos';
import { leerDolar } from '@/lib/ajustes';
import { db } from '@/lib/db';
import { dolares, fecha, numero, pesos } from '@/lib/formato';
import { type Params, param, url } from '@/lib/url';

export const metadata = { title: 'Importaciones de equipos · BB-CONTROL' };

type Lote = Importacion & { fecha: string | null; origen: string; notas: string };
type Activo = { id: number; categoria: keyof typeof SINGULAR; descripcion: string; numero: string; cliente: string; importacion_id: number; moneda: 'ARS' | 'USD'; costo_mercaderia: number | null; costo_otros: number };

// El costo de cada equipo importado: mercadería por unidad + (transporte + gastos de importación + despachante + otros) ÷ unidades.
export default async function Importaciones({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const sql = db();
  const [lotes, activos, dolarAj] = await Promise.all([
    sql<Lote[]>`select * from activo_importaciones order by fecha desc nulls last, id desc`,
    sql<Activo[]>`select id, categoria, descripcion, numero, cliente, importacion_id, moneda, costo_mercaderia, costo_otros from activos where importacion_id is not null order by descripcion`,
    leerDolar(),
  ]);
  const dolar = dolarAj?.valor ?? null;
  const cerrar = url('/activos/importaciones', sp, { nuevo: null, editar: null });
  const idEdit = Number(param(sp, 'editar')) || 0;
  const editando = idEdit ? lotes.find((l) => l.id === idEdit) ?? null : null;
  const totalGastos = lotes.reduce((a, l) => a + gastosImportacion(l).total, 0);
  const unidades = lotes.reduce((a, l) => a + Number(l.unidades), 0);
  const fmt = (n: number, m: string) => (m === 'USD' ? dolares(n) : pesos(n));

  return (
    <>
      <div className="cabeza">
        <Titulo modulo="activos" titulo="Importaciones y costos">
          Cargá cada importación con la mercadería, las unidades y sus gastos (transporte, gastos de importación, despachante). El costo de cada equipo es su mercadería más los gastos divididos por las unidades importadas.
        </Titulo>
        <div className="acciones">
          <Link className="btn vino" href={url('/activos/importaciones', sp, { nuevo: 1, editar: null })} scroll={false}>+ Importación</Link>
        </div>
      </div>
      <TabsActivos actual="/activos/importaciones" />

      <div className="tiles">
        <Tile titulo="Importaciones" valor={numero(lotes.length)} oscuro sub={`${numero(unidades)} unidades en total`} />
        <Tile titulo="Gastos de importación" valor={pesos(totalGastos, 0)} sub="Transporte, aduana, despachante y otros" />
        <Tile titulo="Equipos con costo de importación" valor={numero(activos.length)} />
      </div>

      {lotes.map((l) => {
        const g = gastosImportacion(l);
        const delLote = activos.filter((a) => a.importacion_id === l.id);
        return (
          <div className="caja" key={l.id}>
            <div className="caja-cab">
              <div>
                <h2>{l.nombre}</h2>
                <p className="sub" style={{ margin: 0 }}>{[l.fecha && fecha(l.fecha), l.origen, l.moneda === 'USD' && `dólar ${numero(l.cotizacion, 2)}`, `${l.unidades} unidades`].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="iconos">
                <Link className="ico" href={url('/activos/importaciones', sp, { editar: l.id, nuevo: null })} scroll={false}>Editar</Link>
                <BotonAccion accion={borrarImportacionActivos} campos={{ id: l.id }} className="ico mal" confirmar={`¿Borrar ${l.nombre}? Sus equipos quedan sin costo de importación.`}>Borrar</BotonAccion>
              </div>
            </div>
            <div className="grilla2">
              <div className="tabla-env">
                <table className="t">
                  <tbody>
                    <tr><td>Mercadería</td><td className="der num">{fmt(l.mercaderia, l.moneda)}</td><td className="der num chico">{pesos(g.mercaderiaPesos, 0)}</td></tr>
                    {g.detalle.filter((d) => d.monto).map((d) => (
                      <tr key={d.concepto}><td>{GASTOS_IMPORTACION[d.concepto]}</td><td className="der num">{fmt(d.monto, d.moneda)}</td><td className="der num chico">{pesos(d.pesos, 0)}</td></tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr><td>Gastos ÷ {l.unidades} unidades</td><td /><td className="der num">{pesos(g.porUnidad)}</td></tr>
                    <tr><td>Costo por unidad (promedio)</td><td className="der num">{l.moneda === 'USD' ? dolares(g.costoUnidadPesos / Number(l.cotizacion)) : ''}</td><td className="der num">{pesos(g.costoUnidadPesos)}</td></tr>
                  </tfoot>
                </table>
              </div>
              <div>
                <b style={{ fontSize: 14 }}>Equipos de esta importación ({delLote.length} de {l.unidades})</b>
                {delLote.length ? (
                  <div className="lista-mi">
                    {delLote.map((a) => {
                      const c = costoActivo(a, l, dolar);
                      return (
                        <div key={a.id}>
                          <Link href={`/activos?editar=${a.id}`} style={{ textDecoration: 'none' }}>
                            {a.descripcion}<small>{[SINGULAR[a.categoria], a.numero && `N° ${a.numero}`, a.cliente].filter(Boolean).join(' · ')}</small>
                          </Link>
                          <span className="num" style={{ fontSize: 13 }}>{pesos(c.total, 0)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="sub" style={{ marginTop: 6 }}>Ninguno todavía: al cargar o editar un activo, elegí esta importación.</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
      {!lotes.length && <p className="vacio">No hay importaciones cargadas.</p>}

      {(param(sp, 'nuevo') || editando) && (
        <Ventana titulo={editando ? `Editar ${editando.nombre}` : 'Importación nueva'} cerrar={cerrar} ancha>
          <FormImportacion key={editando?.id ?? 'nueva'} l={editando} dolar={dolar} volver={cerrar} />
        </Ventana>
      )}
    </>
  );
}
