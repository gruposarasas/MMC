import Link from 'next/link';
import { borrarProveedor, guardarProveedor, unirProveedores } from '@/acciones/proveedores';
import { BotonAccion, FormAccion } from '@/components/FormAccion';
import { Importador } from '@/components/Importador';
import { Tile } from '@/components/Tile';
import { Titulo } from '@/components/Titulo';
import { Ventana } from '@/components/Ventana';
import { db } from '@/lib/db';
import { fecha, hoy, numero, pesos } from '@/lib/formato';
import { claveNombre, formatoCuit } from '@/lib/proveedores';
import { type Params, param, url } from '@/lib/url';

export const metadata = { title: 'Proveedores · BB-CONTROL' };

type Prov = {
  id: number; nombre: string; cuit: string; rubro_id: number | null; rubro: string | null; contacto: string; telefono: string; email: string; cbu: string;
  notas: string; alias: string[]; activo: boolean; compras: number; gastos: number; anio: number; ultima: string | null;
};

export default async function Proveedores({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const q = param(sp, 'q');
  const ver = param(sp, 'ver'); // '', 'sin-cuit' o 'inactivos'
  const porTotal = param(sp, 'orden') === 'total';
  const anio = hoy().slice(0, 4);
  const sql = db();
  const [todos, rubros] = await Promise.all([
    sql<Prov[]>`
      select p.*, r.nombre rubro, x.compras, x.gastos, x.anio, x.ultima
      from proveedores p
      left join rubros r on r.id = p.rubro_id
      left join lateral (
        select count(*) filter (where tipo = 'compra')::int compras, count(*) filter (where tipo = 'gasto')::int gastos,
               coalesce(sum(total_ars) filter (where fecha >= ${`${anio}-01-01`}), 0) anio, max(fecha) ultima
        from egresos where proveedor_id = p.id
      ) x on true
      order by lower(p.nombre)`,
    sql<{ id: number; nombre: string; tipo: string; activo: boolean }[]>`select id, nombre, tipo, activo from rubros order by tipo, orden, nombre`,
  ]);

  const k = claveNombre(q);
  const digitos = q.replace(/\D/g, '');
  const lista = todos
    .filter((p) => (ver === 'inactivos' ? !p.activo : p.activo))
    .filter((p) => ver !== 'sin-cuit' || !p.cuit)
    .filter((p) => !q || [p.nombre, p.contacto, ...p.alias].some((x) => claveNombre(x).includes(k)) || (digitos.length >= 3 && p.cuit.includes(digitos)))
    .sort((a, b) => (porTotal ? b.anio - a.anio : 0));
  const activos = todos.filter((p) => p.activo);
  const sinCuit = activos.filter((p) => !p.cuit).length;
  const totalAnio = todos.reduce((a, p) => a + Number(p.anio), 0);
  const conCompras = activos.filter((p) => p.anio).length;

  const cerrar = url('/proveedores', sp, { nuevo: null, editar: null, importar: null });
  const editar = Number(param(sp, 'editar')) || 0;
  const ed = editar ? todos.find((p) => p.id === editar) : null;
  const abierto = param(sp, 'nuevo') || ed;
  const rubrosDe = (tipo: string) => rubros.filter((r) => r.tipo === tipo && (r.activo || r.id === ed?.rubro_id));

  return (
    <>
      <div className="cabeza">
        <Titulo modulo="proveedores" titulo="Proveedores">
          La lista de proveedores de compras y gastos. Corregí un nombre acá y cambia en todos sus comprobantes.
        </Titulo>
        <div className="acciones">
          <Link className="btn claro" href={url('/proveedores', sp, { importar: 1, nuevo: null, editar: null })} scroll={false}>Importar Excel</Link>
          <Link className="btn vino" href={url('/proveedores', sp, { nuevo: 1, editar: null, importar: null })} scroll={false}>+ Nuevo proveedor</Link>
        </div>
      </div>

      <div className="tiles">
        <Tile titulo="Proveedores activos" valor={numero(activos.length)} oscuro sub={`${numero(todos.length - activos.length)} inactivos`} />
        <Tile titulo={`Compras y gastos ${anio}`} valor={pesos(totalAnio, 0)} sub={`${numero(conCompras)} proveedores con comprobantes este año`} />
        <Tile titulo="Sin CUIT" valor={numero(sinCuit)} sub={sinCuit ? 'Completalo para reconocerlos en las facturas' : 'Todos tienen CUIT'}>
          {sinCuit > 0 && ver !== 'sin-cuit' && <Link className="link" style={{ fontSize: 13 }} href={url('/proveedores', sp, { ver: 'sin-cuit' })}>Ver cuáles</Link>}
        </Tile>
      </div>

      <div className="filtros">
        <form className="filtros" style={{ margin: 0 }} action="/proveedores">
          {ver && <input type="hidden" name="ver" value={ver} />}
          {porTotal && <input type="hidden" name="orden" value="total" />}
          <input type="search" name="q" defaultValue={q} placeholder="Buscar nombre, CUIT o contacto" aria-label="Buscar proveedor" />
        </form>
        <div className="pildoras">
          <Link className={!ver ? 'on' : ''} href={url('/proveedores', sp, { ver: null })}>Activos</Link>
          <Link className={ver === 'sin-cuit' ? 'on' : ''} href={url('/proveedores', sp, { ver: 'sin-cuit' })}>Sin CUIT</Link>
          <Link className={ver === 'inactivos' ? 'on' : ''} href={url('/proveedores', sp, { ver: 'inactivos' })}>Inactivos</Link>
        </div>
        <div className="pildoras">
          <Link className={!porTotal ? 'on' : ''} href={url('/proveedores', sp, { orden: null })}>A-Z</Link>
          <Link className={porTotal ? 'on' : ''} href={url('/proveedores', sp, { orden: 'total' })}>Más comprado</Link>
        </div>
      </div>

      <div className="tabla-env">
        <table className="t">
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Rubro habitual</th>
              <th>Contacto</th>
              <th className="der">{anio}</th>
              <th>Comprobantes</th>
              <th><span className="sr">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => {
              const tipo = p.gastos > p.compras ? 'gastos' : 'compras';
              const n = p.compras + p.gastos;
              return (
                <tr key={p.id}>
                  <td className="corta" title={p.alias.length ? `También: ${p.alias.join(', ')}` : undefined}>
                    <span className="principal">{p.nombre}</span>
                    <div className="chico num">{p.cuit ? `CUIT ${formatoCuit(p.cuit)}` : 'Sin CUIT'}</div>
                  </td>
                  <td className="chico">{p.rubro ?? '—'}</td>
                  <td className="chico corta">
                    {[p.contacto, p.telefono, p.email].filter(Boolean).join(' · ') || (p.cbu ? '' : '—')}
                    {p.cbu && <div>CBU/alias: {p.cbu}</div>}
                  </td>
                  <td className="der num">{p.anio ? pesos(p.anio, 0) : '—'}</td>
                  <td className="chico">
                    {n ? (
                      <Link className="link" href={`/${tipo}?prov=${p.id}&p=${p.ultima!.slice(0, 4)}`}>
                        {numero(n)} {n === 1 ? 'comprobante' : 'comprobantes'}
                      </Link>
                    ) : 'Ninguno'}
                    {p.ultima && <div>Último: {fecha(p.ultima)}</div>}
                  </td>
                  <td>
                    <div className="iconos">
                      <Link className="ico" href={url('/proveedores', sp, { editar: p.id, nuevo: null, importar: null })} scroll={false}>Editar</Link>
                      {!n && <BotonAccion accion={borrarProveedor} campos={{ id: p.id }} confirmar={`¿Borrar a ${p.nombre} de la lista?`} className="ico mal">Borrar</BotonAccion>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!lista.length && (
              <tr>
                <td colSpan={6} className="vacio">
                  {todos.length ? 'No hay proveedores con esos filtros.' : 'Todavía no hay proveedores. Importalos desde un Excel o agregalos uno por uno.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {param(sp, 'importar') && (
        <Ventana titulo="Importar proveedores desde Excel" cerrar={cerrar} ancha>
          <Importador tipo="proveedor" destino="/proveedores" />
        </Ventana>
      )}

      {abierto && (
        <Ventana titulo={ed ? `Editar ${ed.nombre}` : 'Nuevo proveedor'} cerrar={cerrar}>
          <FormAccion accion={guardarProveedor} key={ed?.id ?? 'nuevo'}>
            <input type="hidden" name="volver" value={cerrar} />
            {ed && <input type="hidden" name="id" value={ed.id} />}
            <label className="campo ancho">
              <span>Nombre o razón social</span>
              <input name="nombre" defaultValue={ed?.nombre} required maxLength={120} autoComplete="off" />
              {ed && (ed.compras + ed.gastos > 0) && <span className="ayuda">Si lo cambiás, cambia en sus {numero(ed.compras + ed.gastos)} comprobantes.</span>}
            </label>
            <label className="campo">
              <span>CUIT <em>(opcional)</em></span>
              <input name="cuit" defaultValue={ed ? formatoCuit(ed.cuit) : ''} inputMode="numeric" placeholder="30-12345678-9" autoComplete="off" />
            </label>
            <label className="campo">
              <span>Rubro habitual</span>
              <select name="rubro_id" defaultValue={ed?.rubro_id ?? ''}>
                <option value="">Ninguno</option>
                <optgroup label="Compras">{rubrosDe('compra').map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</optgroup>
                <optgroup label="Gastos">{rubrosDe('gasto').map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</optgroup>
              </select>
              <span className="ayuda">Se elige solo al cargar una factura de este proveedor.</span>
            </label>
            <label className="campo">
              <span>Contacto <em>(opcional)</em></span>
              <input name="contacto" defaultValue={ed?.contacto} />
            </label>
            <label className="campo">
              <span>Teléfono <em>(opcional)</em></span>
              <input name="telefono" type="tel" defaultValue={ed?.telefono} />
            </label>
            <label className="campo">
              <span>Mail <em>(opcional)</em></span>
              <input name="email" type="email" defaultValue={ed?.email} />
            </label>
            <label className="campo">
              <span>CBU o alias <em>(opcional)</em></span>
              <input name="cbu" defaultValue={ed?.cbu} autoComplete="off" />
            </label>
            <label className="campo ancho">
              <span>Notas</span>
              <textarea name="notas" defaultValue={ed?.notas} />
            </label>
            {ed && (
              <label className="casilla ancho">
                <input type="checkbox" name="activo" defaultChecked={ed.activo} /> Activo (los inactivos no aparecen al cargar facturas)
              </label>
            )}
            {ed && ed.alias.length > 0 && <p className="sub ancho" style={{ margin: 0 }}>También se reconoce como: {ed.alias.join(', ')}.</p>}
          </FormAccion>

          {ed && todos.length > 1 && (
            <div className="caja" style={{ marginTop: 22 }}>
              <h2>¿Está repetido?</h2>
              <p className="sub">Unilo con el que queda: sus {numero(ed.compras + ed.gastos)} comprobantes pasan al otro y este se borra de la lista.</p>
              <FormAccion accion={unirProveedores} boton="Unir" claseBoton="btn claro" confirmar={`Los comprobantes de ${ed.nombre} pasan al proveedor elegido y ${ed.nombre} se borra. ¿Seguro?`}>
                <input type="hidden" name="id" value={ed.id} />
                <input type="hidden" name="volver" value={url('/proveedores', sp, { editar: null })} />
                <label className="campo ancho">
                  <span>Unir con</span>
                  <select name="destino" required defaultValue="">
                    <option value="" disabled>Elegí el proveedor que queda…</option>
                    {todos.filter((p) => p.id !== ed.id).map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}{p.cuit ? ` · ${formatoCuit(p.cuit)}` : ''}</option>
                    ))}
                  </select>
                </label>
              </FormAccion>
            </div>
          )}
        </Ventana>
      )}
    </>
  );
}
