import Link from 'next/link';
import { borrarActivo } from '@/acciones/activos';
import { type ActivoForm, FormActivo } from '@/components/Activos';
import { BotonAccion } from '@/components/FormAccion';
import { Importador } from '@/components/Importador';
import { TabsActivos } from '@/components/TabsActivos';
import { Tile } from '@/components/Tile';
import { Titulo } from '@/components/Titulo';
import { Ventana } from '@/components/Ventana';
import { CATEGORIAS_ACTIVO, costoActivo, ESTADOS_ACTIVO, type Importacion, SINGULAR } from '@/lib/activos';
import { leerDolar } from '@/lib/ajustes';
import { db } from '@/lib/db';
import { dolares, fecha, numero, pesos } from '@/lib/formato';
import { type Params, param, url } from '@/lib/url';

export const metadata = { title: 'Activos · BB-CONTROL' };

type Activo = ActivoForm & { importacion: string | null };

export default async function Activos({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const cat = param(sp, 'cat');
  const estado = param(sp, 'estado');
  const cliente = param(sp, 'cliente');
  const q = param(sp, 'q').toLowerCase();
  const sql = db();
  const [todos, importaciones, clientesVentas, dolarAj] = await Promise.all([
    sql<Activo[]>`select a.*, i.nombre importacion from activos a left join activo_importaciones i on i.id = a.importacion_id
                  order by a.categoria, lower(a.cliente), a.descripcion`,
    sql<Importacion[]>`select * from activo_importaciones order by fecha desc nulls last, id desc`,
    sql<{ cliente: string }[]>`select cliente from ventas where cliente <> '' group by 1 order by max(fecha) desc limit 400`,
    leerDolar(),
  ]);
  const dolar = dolarAj?.valor ?? null;
  const lotes = new Map(importaciones.map((l) => [l.id, l]));
  const conCosto = todos.map((a) => {
    const c = costoActivo(a, a.importacion_id ? lotes.get(a.importacion_id) : null, dolar);
    const valor = a.valor_estimado == null ? null : Number(a.valor_estimado) * (a.moneda === 'USD' ? (dolar ?? 0) : 1);
    return { ...a, costo: c, valor };
  });
  const vigentes = conCosto.filter((a) => a.estado !== 'baja');
  const lista = conCosto
    .filter((a) => (estado ? a.estado === estado : a.estado !== 'baja'))
    .filter((a) => !cat || a.categoria === cat)
    .filter((a) => !cliente || a.cliente.toLowerCase() === cliente.toLowerCase())
    .filter((a) => !q || [a.descripcion, a.marca, a.modelo, a.numero, a.cliente, a.ubicacion].some((x) => x.toLowerCase().includes(q)));
  const valorTotal = vigentes.reduce((s, a) => s + (a.valor ?? 0), 0);
  const costoTotal = vigentes.reduce((s, a) => s + a.costo.total, 0);
  const enClientes = vigentes.filter((a) => a.estado === 'cliente');
  const porCliente = [...enClientes.reduce((m, a) => {
    const k = a.cliente.trim();
    const x = m.get(k.toLowerCase()) ?? { nombre: k, n: 0, valor: 0, maquinas: 0 };
    x.n++;
    x.valor += a.valor ?? 0;
    if (a.categoria === 'maquina') x.maquinas++;
    return m.set(k.toLowerCase(), x);
  }, new Map<string, { nombre: string; n: number; valor: number; maquinas: number }>()).values()].sort((a, b) => b.n - a.n || b.valor - a.valor);
  const sinValor = vigentes.filter((a) => a.valor_estimado == null).length;
  const sinCosto = vigentes.filter((a) => !a.costo.completo).length;

  const cerrar = url('/activos', sp, { nuevo: null, editar: null, importar: null });
  const idEdit = Number(param(sp, 'editar')) || 0;
  const editando = idEdit ? todos.find((a) => a.id === idEdit) ?? null : null;
  const clientes = [...new Set([...todos.map((a) => a.cliente).filter(Boolean), ...clientesVentas.map((c) => c.cliente)])];
  const fmt = (n: number | null, m: string) => (n == null ? '—' : m === 'USD' ? dolares(n) : pesos(n, 0));

  return (
    <>
      <div className="cabeza">
        <Titulo modulo="activos" titulo="Activos">
          Máquinas instaladas en clientes, molinillos, tostadoras, vehículos y demás equipos, con su costo (mercadería + gastos de importación) y lo que valen hoy.
        </Titulo>
        <div className="acciones">
          <Link className="btn claro" href={url('/activos', sp, { importar: 1, nuevo: null, editar: null })} scroll={false}>Importar Excel</Link>
          <Link className="btn vino" href={url('/activos', sp, { nuevo: 1, editar: null, importar: null })} scroll={false}>+ Nuevo activo</Link>
        </div>
      </div>
      <TabsActivos actual="/activos" />

      <div className="tiles">
        <Tile titulo="Valor estimado" valor={pesos(valorTotal, 0)} oscuro sub={dolar ? `${dolares(valorTotal / dolar)} al dólar de hoy` : sinValor ? `${sinValor} sin valor cargado` : undefined} />
        <Tile titulo="Costo" valor={pesos(costoTotal, 0)} sub={sinCosto ? `${sinCosto} sin costo cargado` : 'Mercadería + importación'} />
        <Tile titulo="En clientes" valor={numero(enClientes.length)} sub={`${porCliente.length} clientes · ${enClientes.filter((a) => a.categoria === 'maquina').length} máquinas`} />
        <Tile titulo="Activos" valor={numero(vigentes.length)} sub={(Object.keys(CATEGORIAS_ACTIVO) as (keyof typeof CATEGORIAS_ACTIVO)[]).map((k) => {
          const n = vigentes.filter((a) => a.categoria === k).length;
          return n ? `${n} ${(n === 1 ? SINGULAR[k] : CATEGORIAS_ACTIVO[k]).toLowerCase()}` : '';
        }).filter(Boolean).join(' · ') || 'Todavía no hay'} />
      </div>
      {!dolar && todos.some((a) => a.moneda === 'USD') && <div className="aviso">Hay valores en dólares: cargá el dólar de referencia en Costos para verlos en pesos.</div>}

      <div className="filtros">
        <form className="filtros" style={{ margin: 0 }} action="/activos">
          {cat && <input type="hidden" name="cat" value={cat} />}
          {estado && <input type="hidden" name="estado" value={estado} />}
          <input type="search" name="q" defaultValue={param(sp, 'q')} placeholder="Buscar serie, marca, cliente…" aria-label="Buscar activo" />
        </form>
        <div className="pildoras">
          <Link className={!cat ? 'on' : ''} href={url('/activos', sp, { cat: null })}>Todos</Link>
          {(Object.keys(CATEGORIAS_ACTIVO) as (keyof typeof CATEGORIAS_ACTIVO)[]).map((k) => {
            const n = vigentes.filter((a) => a.categoria === k).length;
            return n || cat === k ? <Link key={k} className={cat === k ? 'on' : ''} href={url('/activos', sp, { cat: k })}>{CATEGORIAS_ACTIVO[k]}<span className="num">{n}</span></Link> : null;
          })}
        </div>
        <div className="pildoras">
          {(Object.keys(ESTADOS_ACTIVO) as (keyof typeof ESTADOS_ACTIVO)[]).map((k) => (
            <Link key={k} className={estado === k ? 'on' : ''} href={url('/activos', sp, { estado: estado === k ? null : k })}>{ESTADOS_ACTIVO[k]}</Link>
          ))}
        </div>
        {cliente && <div className="pildoras"><Link className="on" href={url('/activos', sp, { cliente: null })}>{cliente} ×</Link></div>}
      </div>

      <div className="grilla-activos">
        <div className="tabla-env">
          <table className="t">
            <thead><tr><th>Equipo</th><th>Dónde</th><th className="der">Costo</th><th className="der">Valor estimado</th><th><span className="sr">Acciones</span></th></tr></thead>
            <tbody>
              {lista.map((a) => (
                <tr key={a.id}>
                  <td className="corta">
                    <span className="principal">{a.descripcion}</span>
                    <div className="chico">{[SINGULAR[a.categoria], [a.marca, a.modelo].filter(Boolean).join(' '), a.numero && `N° ${a.numero}`].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="corta">
                    {a.estado === 'cliente' ? (
                      <Link href={url('/activos', sp, { cliente: a.cliente })} style={{ textDecoration: 'none' }}>{a.cliente}</Link>
                    ) : <span className={`chip${a.estado === 'reparacion' ? ' alerta' : ''}`}>{ESTADOS_ACTIVO[a.estado]}</span>}
                    <div className="chico">{[a.estado !== 'cliente' && a.cliente, a.ubicacion, a.instalada && `desde ${fecha(a.instalada)}`].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td className="der num">
                    {a.costo.completo ? pesos(a.costo.total, 0) : '—'}
                    {a.costo.completo && a.importacion && <div className="chico" title={a.importacion}>incl. {pesos(a.costo.gastos, 0)} de importación</div>}
                  </td>
                  <td className="der num principal">
                    {fmt(a.valor_estimado, a.moneda)}
                    {a.moneda === 'USD' && a.valor != null && dolar ? <div className="chico">{pesos(a.valor, 0)}</div> : null}
                  </td>
                  <td>
                    <div className="iconos">
                      <Link className="ico" href={url('/activos', sp, { editar: a.id, nuevo: null })} scroll={false}>Editar</Link>
                      <BotonAccion accion={borrarActivo} campos={{ id: a.id }} className="ico mal" confirmar={`¿Borrar ${a.descripcion}${a.numero ? ` (N° ${a.numero})` : ''}?`}>Borrar</BotonAccion>
                    </div>
                  </td>
                </tr>
              ))}
              {!lista.length && <tr><td colSpan={5} className="vacio">{todos.length ? 'No hay activos con esos filtros.' : 'Todavía no hay activos. Cargalos uno por uno o importá un Excel.'}</td></tr>}
            </tbody>
          </table>
        </div>
        {porCliente.length > 0 && (
          <div className="caja" style={{ marginBottom: 0 }}>
            <h2>Por cliente</h2>
            <p className="sub">Equipos instalados en cada uno.</p>
            <div className="lista-mi">
              {porCliente.slice(0, 15).map((c) => (
                <div key={c.nombre}>
                  <Link href={url('/activos', sp, { cliente: c.nombre })} style={{ textDecoration: 'none' }}>
                    {c.nombre}<small>{c.maquinas ? ` · ${c.maquinas} ${c.maquinas === 1 ? 'máquina' : 'máquinas'}` : ''}{c.n > c.maquinas ? ` · ${c.n - c.maquinas} otros` : ''}</small>
                  </Link>
                  <span className="num" style={{ fontSize: 13 }}>{c.valor ? pesos(c.valor, 0) : '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {param(sp, 'importar') && (
        <Ventana titulo="Importar activos desde Excel" cerrar={cerrar} ancha>
          <Importador tipo="activo" destino="/activos" />
        </Ventana>
      )}
      {(param(sp, 'nuevo') || editando) && (
        <Ventana titulo={editando ? `Editar ${editando.descripcion}` : 'Nuevo activo'} cerrar={cerrar} ancha>
          <FormActivo key={editando?.id ?? 'nuevo'} a={editando} importaciones={importaciones} clientes={clientes} dolar={dolar} volver={cerrar} categoriaInicial={cat} />
        </Ventana>
      )}
    </>
  );
}
