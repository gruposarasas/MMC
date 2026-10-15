import Link from 'next/link';
import { crearClienteDesde } from '@/acciones/clientes';
import { FormCliente } from '@/components/FormCliente';
import { BotonAccion } from '@/components/FormAccion';
import { Importador } from '@/components/Importador';
import { Luz } from '@/components/Luz';
import { TabsClientes } from '@/components/TabsClientes';
import { Tile } from '@/components/Tile';
import { Titulo } from '@/components/Titulo';
import { Ventana } from '@/components/Ventana';
import { datosSemaforo } from '@/lib/clientes';
import { numero, pesos, porcentaje } from '@/lib/formato';
import { type Color, colorDe, INDICADORES, type Indicador, meses } from '@/lib/semaforo';
import { type Params, param, url } from '@/lib/url';

export const metadata = { title: 'Clientes · BB-CONTROL' };

const ORDEN: Record<Color, number> = { rojo: 0, amarillo: 1, verde: 2, gris: 3 };

export default async function Clientes({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const luz = param(sp, 'luz') as Color | '';
  const q = param(sp, 'q').toLowerCase();
  const { cr, origen, filas, sinCliente } = await datosSemaforo();
  const activos = filas.filter((f) => f.c.activo);
  const cuenta = (c: Color) => activos.filter((f) => f.r.color === c);
  const lista = (param(sp, 'ver') === 'inactivos' ? filas.filter((f) => !f.c.activo) : activos)
    .filter((f) => !luz || f.r.color === luz)
    .filter((f) => !q || [f.c.nombre, ...f.c.alias].some((x) => x.toLowerCase().includes(q)))
    .sort((a, b) => ORDEN[a.r.color] - ORDEN[b.r.color] || a.r.score - b.r.score || a.r.resultado - b.r.resultado);
  const total = (k: 'resultado' | 'kilos' | 'inversion' | 'neto') => activos.reduce((s, f) => s + f.r[k], 0);
  const porNombre = [...sinCliente.reduce((m, x) => m.set(x.cliente.trim(), [...(m.get(x.cliente.trim()) ?? []), x]), new Map<string, typeof sinCliente>()).entries()];
  const cerrar = url('/clientes', sp, { nuevo: null, importar: null });
  const sinPrecio = !cr.precioKg || !cr.costoKg;

  return (
    <>
      <div className="cabeza">
        <Titulo modulo="clientes" titulo="Semáforo de clientes">
          Lo que deja cada cliente por mes: lo que compra, con su descuento y su plazo de pago, menos el café y las máquinas que tiene instaladas.
        </Titulo>
        <div className="acciones">
          <Link className="btn claro" href={url('/clientes', sp, { importar: 1, nuevo: null })} scroll={false}>Importar Excel</Link>
          <Link className="btn vino" href={url('/clientes', sp, { nuevo: 1, importar: null })} scroll={false}>+ Nuevo cliente</Link>
        </div>
      </div>
      <TabsClientes actual="/clientes" />
      {sinPrecio && (
        <div className="aviso mal">
          Falta el precio o el costo del kilo de café. <Link href="/clientes/criterios">Cargalos en Criterios</Link> (o elegí el producto de Costos que venden).
        </div>
      )}

      <div className="tiles">
        {(['verde', 'amarillo', 'rojo'] as const).map((c) => (
          <Link key={c} href={url('/clientes', sp, { luz: luz === c ? null : c })} className="tile" style={{ textDecoration: 'none', outline: luz === c ? '2px solid var(--vino)' : undefined }}>
            <div className="t"><Luz color={c} /></div>
            <div className="v">{numero(cuenta(c).length)}</div>
            <div className="s">{numero(cuenta(c).reduce((s, f) => s + f.r.kilos, 0))} kg/mes · {pesos(cuenta(c).reduce((s, f) => s + f.r.resultado, 0), 0)}/mes</div>
          </Link>
        ))}
        <Tile titulo="Resultado por mes" valor={pesos(total('resultado'), 0)} oscuro sub={total('neto') ? `${porcentaje((total('resultado') / total('neto')) * 100, 1)} de lo facturado · ${numero(total('kilos'))} kg` : undefined} />
        <Tile titulo="Máquinas en clientes" valor={pesos(total('inversion'), 0)} sub={`${numero(activos.reduce((s, f) => s + f.maquinas.length, 0))} equipos · costo de reposición hoy`} />
      </div>

      <div className="filtros">
        <form className="filtros" style={{ margin: 0 }} action="/clientes">
          {luz && <input type="hidden" name="luz" value={luz} />}
          <input type="search" name="q" defaultValue={param(sp, 'q')} placeholder="Buscar cliente" aria-label="Buscar cliente" />
        </form>
        <div className="pildoras">
          <Link className={!luz ? 'on' : ''} href={url('/clientes', sp, { luz: null })}>Todos</Link>
          {cuenta('gris').length > 0 && <Link className={luz === 'gris' ? 'on' : ''} href={url('/clientes', sp, { luz: 'gris' })}>Faltan datos ({cuenta('gris').length})</Link>}
          <Link className={param(sp, 'ver') === 'inactivos' ? 'on' : ''} href={url('/clientes', sp, { ver: param(sp, 'ver') ? null : 'inactivos' })}>Inactivos</Link>
        </div>
      </div>

      <div className="tabla-env">
        <table className="t">
          <thead>
            <tr>
              <th>Semáforo</th>
              <th>Cliente</th>
              <th className="der">Kilos/mes</th>
              <th className="der">Máquinas</th>
              <th className="der">Desc.</th>
              <th>Pago</th>
              <th className="der">Resultado/mes</th>
              <th className="der">Margen</th>
              <th className="der">Recupero</th>
              <th>Variables</th>
            </tr>
          </thead>
          <tbody>
            {lista.map(({ c, maquinas, r }) => (
              <tr key={c.id}>
                <td><Luz color={r.color} puntos={r.score} titulo={r.faltan.length ? `Falta ${r.faltan.join(' y ')}` : r.pierde ? 'Pierde plata: rojo aunque el promedio dé más' : undefined} /></td>
                <td className="corta">
                  <Link className="principal" href={`/clientes/${c.id}`} style={{ textDecoration: 'none' }}>{c.nombre}</Link>
                  <div className="chico">{c.locales > 1 ? `${c.locales} locales` : '1 local'}{c.kilos_desde_ventas ? ' · kilos según ventas' : ''}</div>
                  {!r.faltan.length && (
                    <div className={`celu-resumen${r.resultado < 0 ? ' negativo' : ''}`}>
                      {pesos(r.resultado, 0)}/mes · {numero(r.kilos, r.kilos < 10 ? 1 : 0)} kg{maquinas.length ? ` · ${maquinas.length} ${maquinas.length === 1 ? 'equipo' : 'equipos'}` : ''}
                    </div>
                  )}
                </td>
                <td className="der num">{r.kilos ? numero(r.kilos, r.kilos < 10 ? 1 : 0) : '—'}</td>
                <td className="der num">
                  {maquinas.length ? <>{maquinas.length}<div className="chico">{pesos(r.inversion, 0)}</div></> : '—'}
                </td>
                <td className="der num">{Number(c.descuento_pct) ? porcentaje(Number(c.descuento_pct), 0) : '—'}</td>
                <td className="chico">{c.forma_pago}{c.plazo_dias ? ` · ${c.plazo_dias} días` : ' · contado'}</td>
                <td className={`der num principal${r.resultado < 0 ? ' negativo' : ''}`}>{r.faltan.length ? '—' : pesos(r.resultado, 0)}</td>
                <td className="der num">{r.valores.margen == null || r.faltan.length ? '—' : porcentaje(r.valores.margen, 0)}</td>
                <td className="der num chico">{r.faltan.length ? '—' : meses(r.valores.recupero)}</td>
                <td>
                  <span className="puntitos">
                    {(Object.keys(INDICADORES) as Indicador[]).map((k) => r.puntos[k] == null ? null : (
                      <i key={k} className={r.faltan.length ? '' : colorDe(r.puntos[k])} title={`${INDICADORES[k].nombre}: ${r.puntos[k]} puntos`} />
                    ))}
                  </span>
                </td>
              </tr>
            ))}
            {!lista.length && (
              <tr><td colSpan={10} className="vacio">{filas.length ? 'No hay clientes con ese filtro.' : 'Todavía no hay clientes. Cargalos uno por uno, importá un Excel o crealos desde sus máquinas (abajo).'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mas">
        Puntaje de 0 a 100: promedio de margen neto ({cr.pesos.margen} %), recupero de las máquinas ({cr.pesos.recupero} %), kilos por máquina ({cr.pesos.kgMaquina} %),
        plazo de pago ({cr.pesos.plazo} %) y descuento ({cr.pesos.descuento} %). Verde desde 67, amarillo desde 40. Si el resultado da negativo, rojo.
        {origen ? ` Precio y costo del kilo: ${origen}.` : ''}
      </p>

      {porNombre.length > 0 && (
        <div className="caja" style={{ marginTop: 18 }}>
          <h2>Máquinas en clientes que no están en el semáforo</h2>
          <p className="sub">Están en Activos como instaladas en estos clientes. Crealos (o agregá el nombre como "otro nombre" de un cliente) para que su inversión cuente.</p>
          <div className="lista-mi">
            {porNombre.map(([nombre, ms]) => (
              <div key={nombre}>
                <span>{nombre}<small> · {ms.length} {ms.length === 1 ? 'equipo' : 'equipos'} · {pesos(ms.reduce((s, m) => s + (m.inversion ?? 0), 0), 0)}</small></span>
                <BotonAccion accion={crearClienteDesde} campos={{ nombre }} className="btn claro chico">Crear cliente</BotonAccion>
              </div>
            ))}
          </div>
        </div>
      )}

      {param(sp, 'importar') && (
        <Ventana titulo="Importar clientes desde Excel" cerrar={cerrar} ancha>
          <Importador tipo="cliente" destino="/clientes" />
        </Ventana>
      )}
      {param(sp, 'nuevo') && (
        <Ventana titulo="Cliente nuevo" cerrar={cerrar}>
          <FormCliente c={null} />
        </Ventana>
      )}
    </>
  );
}
