import Link from 'next/link';
import { notFound } from 'next/navigation';
import { borrarCliente } from '@/acciones/clientes';
import { FormCliente } from '@/components/FormCliente';
import { BotonAccion } from '@/components/FormAccion';
import { Luz } from '@/components/Luz';
import { TabsClientes } from '@/components/TabsClientes';
import { Tile } from '@/components/Tile';
import { Titulo } from '@/components/Titulo';
import { Ventana } from '@/components/Ventana';
import { type CategoriaActivo, SINGULAR } from '@/lib/activos';
import { datosSemaforo, MESES_VENTAS } from '@/lib/clientes';
import { mesCorto, numero, pesos, porcentaje, sumarMeses } from '@/lib/formato';
import { colorDe, INDICADORES, type Indicador, meses, textoIndicador } from '@/lib/semaforo';
import { type Params, param, url } from '@/lib/url';

export const metadata = { title: 'Cliente · BB-CONTROL' };

export default async function Cliente({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Params> }) {
  const { id: idTxt } = await params;
  const sp = await searchParams;
  const id = Number(idTxt);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const { cr, origen, filas, desde, hasta } = await datosSemaforo();
  const fila = filas.find((f) => f.c.id === id);
  if (!fila) notFound();
  const { c, maquinas, facturadoMes, r } = fila;
  const base = `/clientes/${id}`;
  const cerrar = url(base, sp, { editar: null });
  const faltan = r.faltan.length > 0;
  const tasa = Number(cr.tasaMensual);
  const desc = Number(c.descuento_pct);

  // La cuenta del mes, renglón por renglón (las restas en negativo).
  const renglones: { concepto: string; detalle?: string; valor: number; tipo?: 'resta' | 'total' }[] = [
    { concepto: 'Café que compra', detalle: `${numero(r.kilos, 1)} kg × ${pesos(r.precio)}${c.precio_kg != null ? ' (precio especial)' : ''}`, valor: r.bruto },
    ...(desc ? [{ concepto: 'Descuento', detalle: porcentaje(desc, desc % 1 ? 1 : 0), valor: -r.descuento, tipo: 'resta' as const }] : []),
    { concepto: 'Lo que paga (sin IVA)', valor: r.neto, tipo: 'total' },
    { concepto: 'Costo del café', detalle: `${numero(r.kilos, 1)} kg × ${pesos(r.costoKg)}`, valor: -r.costoCafe, tipo: 'resta' },
    { concepto: 'Margen del café', valor: r.margenBruto, tipo: 'total' },
    ...(c.plazo_dias ? [{ concepto: 'Costo del plazo de pago', detalle: `${c.plazo_dias} días al ${porcentaje(tasa, 1)} por mes`, valor: -r.financiero, tipo: 'resta' as const }] : []),
    ...(Number(c.comision_pct) ? [{ concepto: 'Comisión del cobro', detalle: `${porcentaje(Number(c.comision_pct), 1)} (${c.forma_pago})`, valor: -r.cobro, tipo: 'resta' as const }] : []),
    ...(r.inversion ? [
      { concepto: 'Amortización de las máquinas', detalle: `${pesos(r.inversion, 0)} en ${cr.vidaUtilMeses} meses`, valor: -r.amortizacion, tipo: 'resta' as const },
      { concepto: 'Costo del capital en máquinas', detalle: `${porcentaje(Number(cr.tasaMaquinasAnual), 1)} anual en dólares`, valor: -r.capital, tipo: 'resta' as const },
    ] : []),
    ...(r.service ? [{ concepto: 'Service de las máquinas', detalle: `${maquinas.length} × ${pesos(Number(cr.serviceMaquinaMes), 0)}`, valor: -r.service, tipo: 'resta' as const }] : []),
    { concepto: 'Resultado del cliente', valor: r.resultado, tipo: 'total' },
  ];

  // Cuánto mueve cada variable, para negociar.
  const margenVerde = cr.umbrales.margen[0] / 100;
  const porKiloVerde = r.porKilo - margenVerde * r.precio * (1 - desc / 100);
  const kilosVerde = porKiloVerde > 0 ? r.costoMaquinas / porKiloVerde : null;
  const porMaquina = maquinas.length ? r.costoMaquinas / maquinas.length : 0;
  const palancas: React.ReactNode[] = faltan ? [] : [
    r.pierde
      ? r.kilosEquilibrio != null
        ? <>Para no perder plata tiene que comprar <b>{numero(r.kilosEquilibrio, 1)} kg por mes</b> (hoy compra {numero(r.kilos, 1)} kg).</>
        : <>Con este precio, descuento y plazo <b>cada kilo deja pérdida</b>: aunque compre más, no cubre el café ni las máquinas.</>
      : null,
    kilosVerde != null && r.costoMaquinas > 0 && (r.valores.margen ?? 0) < cr.umbrales.margen[0]
      ? <>Para un margen neto de {numero(cr.umbrales.margen[0])} % (verde) tiene que comprar <b>{numero(kilosVerde, 1)} kg por mes</b>.</>
      : null,
    maquinas.length ? <>Cada equipo instalado cuesta <b>{pesos(porMaquina, 0)} por mes</b> (amortización, capital{r.service ? ' y service' : ''}).</> : null,
    desc ? <>Cada punto de descuento cuesta <b>{pesos(r.bruto / 100, 0)} por mes</b>.</> : null,
    c.plazo_dias ? <>Pagar a {c.plazo_dias} días cuesta <b>{pesos(r.financiero, 0)} por mes</b>: de contado, el resultado mejora en eso.</> : null,
    r.porKilo > 0 ? <>Cada kilo más que compre deja <b>{pesos(r.porKilo, 0)}</b> (después del descuento, el plazo y el café).</> : null,
  ].filter(Boolean);

  return (
    <>
      <p style={{ margin: '0 0 8px' }}><Link className="link" href="/clientes">← Semáforo de clientes</Link></p>
      <div className="cabeza">
        <Titulo modulo="clientes" eti="Cliente" titulo={c.nombre}>
          {[c.locales > 1 ? `${c.locales} locales` : '1 local', c.forma_pago, c.plazo_dias ? `a ${c.plazo_dias} días` : 'de contado',
            desc ? `${porcentaje(desc, desc % 1 ? 1 : 0)} de descuento` : 'sin descuento', c.activo ? '' : 'Inactivo'].filter(Boolean).join(' · ')}
        </Titulo>
        <div className="acciones">
          <Link className="btn vino" href={url(base, sp, { editar: 1 })} scroll={false}>Editar datos</Link>
        </div>
      </div>
      <TabsClientes actual="/clientes" />
      {faltan && (
        <div className="aviso mal">
          Para calcular el semáforo falta {r.faltan.join(' y ')}.{' '}
          {r.faltan.some((x) => x.includes('kilo del') || x.includes('costo')) ? <Link href="/clientes/criterios">Cargalo en Criterios</Link> : <Link href={url(base, sp, { editar: 1 })} scroll={false}>Completalo</Link>}
        </div>
      )}
      {!c.activo && <div className="aviso">Este cliente está inactivo: no suma en el total del semáforo.</div>}
      {r.sinValor > 0 && (
        <div className="aviso">{r.sinValor === 1 ? 'Un equipo no tiene' : `${r.sinValor} equipos no tienen`} costo ni valor estimado en Activos: no suman a la inversión.</div>
      )}

      <div className="tiles">
        <div className="tile">
          <div className="t">Semáforo</div>
          <div className="v"><Luz color={r.color} grande /></div>
          <div className="s">{faltan ? 'Faltan datos' : `Puntaje ${r.score} de 100${r.pierde ? ' · pierde plata' : ''}`}</div>
        </div>
        <Tile titulo="Resultado por mes" oscuro valor={faltan ? '—' : pesos(r.resultado, 0)} sub={faltan ? undefined : `${pesos(r.resultado * 12, 0)} por año`} />
        <Tile titulo="Margen neto" valor={faltan ? '—' : textoIndicador('margen', r.valores.margen)} sub="Resultado sobre lo que paga" />
        <Tile titulo="Máquinas instaladas" valor={pesos(r.inversion, 0)} sub={maquinas.length ? `${maquinas.length} ${maquinas.length === 1 ? 'equipo' : 'equipos'} · se recupera en ${faltan ? '—' : meses(r.valores.recupero)}` : 'No tiene equipos de Bruno Brown'} />
      </div>

      <div className="grilla2">
        <div className="caja">
          <h2>Cuenta del mes</h2>
          <p className="sub">Lo que deja este cliente cada mes, sin IVA.</p>
          {faltan ? <p className="vacio">Completá los datos que faltan para ver la cuenta.</p> : (
            <div className="tabla-env">
              <table className="t cuenta-cliente">
                <thead><tr><th>Concepto</th><th className="der">Por mes</th><th className="der celu-no">Por año</th></tr></thead>
                <tbody>
                  {renglones.map((x) => (
                    <tr key={x.concepto} className={x.tipo ?? ''}>
                      <td>{x.concepto}{x.detalle && <div className="chico">{x.detalle}</div>}</td>
                      <td className={`der num${x.tipo === 'total' && x.valor < 0 ? ' negativo' : ''}`}>{pesos(x.valor, 0)}</td>
                      <td className={`der num celu-no${x.tipo === 'total' && x.valor < 0 ? ' negativo' : ''}`}>{pesos(x.valor * 12, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="caja">
          <h2>Variables del semáforo</h2>
          <p className="sub">Cada variable da de 0 a 100 puntos entre su valor rojo (0) y su valor verde (100). El semáforo es el promedio según el peso: verde desde 67, amarillo desde 40.</p>
          <div className="tabla-env">
            <table className="t">
              <thead><tr><th>Variable</th><th className="der">Valor</th><th className="der celu-no">Verde / rojo</th><th className="der celu-no">Peso</th><th className="der">Puntos</th></tr></thead>
              <tbody>
                {(Object.keys(INDICADORES) as Indicador[]).map((k) => {
                  const cuenta = r.puntos[k] != null;
                  return (
                    <tr key={k}>
                      <td title={INDICADORES[k].ayuda}>{INDICADORES[k].nombre}{!cuenta && <div className="chico">No cuenta: sin máquinas de café</div>}</td>
                      <td className="der num principal">{faltan && (k === 'margen' || k === 'recupero' || k === 'kgMaquina') ? '—' : textoIndicador(k, r.valores[k])}</td>
                      <td className="der num chico celu-no" style={{ whiteSpace: 'nowrap' }}>{textoIndicador(k, cr.umbrales[k][0])} / {textoIndicador(k, cr.umbrales[k][1])}</td>
                      <td className="der num chico celu-no">{cuenta ? `${cr.pesos[k]} %` : '—'}</td>
                      <td className="der num" style={{ whiteSpace: 'nowrap' }}>
                        {cuenta && !faltan ? <><span className="puntitos" aria-hidden><i className={colorDe(r.puntos[k])} /></span> {r.puntos[k]}</> : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!faltan && <p className="chico" style={{ marginTop: 10 }}>Puntaje: <b>{r.score} de 100</b>{r.pierde ? '. Da rojo porque el resultado es negativo, aunque el promedio dé más.' : '.'}</p>}
        </div>
      </div>

      {palancas.length > 0 && (
        <div className="caja" style={{ marginTop: 18 }}>
          <h2>Para negociar</h2>
          <ul className="palancas">{palancas.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>
      )}

      <div className="grilla2" style={{ marginTop: palancas.length ? 0 : 18 }}>
        <div className="caja">
          <div className="caja-cab">
            <div>
              <h2>Máquinas en sus locales</h2>
              <p className="sub" style={{ margin: 0 }}>De Activos, a costo de reposición de hoy (o su valor estimado).</p>
            </div>
            <Link className="btn claro chico" href={`/activos?nuevo=1&cliente=${encodeURIComponent(c.nombre)}`}>+ Agregar en Activos</Link>
          </div>
          <div className="lista-mi">
            {maquinas.map((m) => (
              <div key={m.id}>
                <span>
                  <Link className="link" href={`/activos?editar=${m.id}`}>{m.descripcion || SINGULAR[m.categoria as CategoriaActivo] || m.categoria}</Link>
                  <small>{[SINGULAR[m.categoria as CategoriaActivo], m.marca, m.numero ? `N° ${m.numero}` : '', m.cliente].filter(Boolean).join(' · ')}</small>
                </span>
                <b className="num">{m.inversion == null ? 'Sin valor' : pesos(m.inversion, 0)}</b>
              </div>
            ))}
            {!maquinas.length && <p className="vacio" style={{ margin: 0 }}>No hay equipos de Activos instalados con este nombre{c.alias.length ? ' ni sus otros nombres' : ''}.</p>}
          </div>
        </div>

        <div className="caja">
          <h2>Lo que compra</h2>
          <p className="sub">Facturado en Ventas de {mesCorto(desde.slice(0, 7))} a {mesCorto(sumarMeses(hasta.slice(0, 7), -1))}, sin IVA.</p>
          <div className="lista-mi">
            <div><span>Kilos por mes que se usan<small>{c.kilos_desde_ventas ? 'Estimados con lo facturado' : 'Cargados a mano'}</small></span><b className="num">{r.kilos ? `${numero(r.kilos, 1)} kg` : '—'}</b></div>
            <div><span>Facturado por mes<small>Promedio de {MESES_VENTAS} meses</small></span><b className="num">{facturadoMes != null ? pesos(facturadoMes, 0) : 'Sin ventas'}</b></div>
            {r.kilosVentas != null && (
              <div><span>Kilos según lo facturado<small>Facturado ÷ precio con descuento</small></span><b className="num">{numero(r.kilosVentas, 1)} kg</b></div>
            )}
            <div><span>Precio del kilo<small>{c.precio_kg != null ? 'Especial de este cliente' : origen ? `General: ${origen}` : 'General (Criterios)'}</small></span><b className="num">{r.precio ? pesos(r.precio, 0) : '—'}</b></div>
            {c.kilos_mes != null && Number(c.kilos_mes) > 0 && r.kilosVentas != null && !c.kilos_desde_ventas && Math.abs(r.kilosVentas - Number(c.kilos_mes)) / Number(c.kilos_mes) > 0.25 && (
              <div><span className="chico">Ojo: según lo facturado compra {numero(r.kilosVentas, 1)} kg por mes y tiene cargados {numero(Number(c.kilos_mes), 1)} kg.</span></div>
            )}
          </div>
          {c.notas && <p className="chico" style={{ marginTop: 10 }}>{c.notas}</p>}
          {(c.alias.length > 0 || c.cuit) && (
            <p className="chico" style={{ marginTop: 10 }}>{c.alias.length ? `También figura como: ${c.alias.join(', ')}.` : ''} {c.cuit ? `CUIT ${c.cuit}.` : ''}</p>
          )}
        </div>
      </div>

      {param(sp, 'editar') && (
        <Ventana titulo={`Editar ${c.nombre}`} cerrar={cerrar}>
          <FormCliente c={c} volver={base} />
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--linea2)' }}>
            <BotonAccion accion={borrarCliente} campos={{ id }} className="btn claro chico" confirmar={`¿Borrar ${c.nombre} del semáforo? Sus máquinas y ventas no se tocan.`}>Borrar cliente</BotonAccion>
          </div>
        </Ventana>
      )}
    </>
  );
}
