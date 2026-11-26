// Métricas de las gift cards (servidor): para administración (todos o un local) y para el panel de cada local.
import { metricas, mesesConConsumos } from '@/lib/vistapueblo-servidor';
import { pesos, porcentaje, fechaLarga, nombreMes, diaHora, mesActual, rangoPreset, FECHA_RE, diasEntre, sumarDias } from '@/lib/vistapueblo';
import { FiltroMetricas } from './Filtro';

export const INICIO_VP = '2026-11-01';

/** Rango pedido en la URL (por defecto, este mes). */
export function leerRango(sp: Record<string, string | undefined>) {
  let desde = sp.desde || '', hasta = sp.hasta || '';
  if (!FECHA_RE.test(desde) || !FECHA_RE.test(hasta)) ({ desde, hasta } = rangoPreset('mes'));
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  if (diasEntre(desde, hasta) > 1100) desde = sumarDias(hasta, -1099);
  return { desde, hasta };
}

const etiqueta = (k: string, agrupado: 'dia' | 'mes') => (agrupado === 'mes' ? nombreMes(k).slice(0, 3) + ' ' + k.slice(2, 4) : `${k.slice(8, 10)}/${k.slice(5, 7)}`);

export async function Metricas({ desde, hasta, localId, base, locales, csv, detalle }: {
  desde: string; hasta: string; localId?: string; base: string; locales?: { id: string; nombre: string }[]; csv: string; detalle?: boolean;
}) {
  const [m, meses] = await Promise.all([metricas(desde, hasta, localId), mesesConConsumos(mesActual())]);
  const t = m.total;
  const pctLocal = porcentaje(t.local, t.consumido);
  const pctVp = t.consumido ? Math.round((100 - pctLocal) * 10) / 10 : 0;
  const extraPct = porcentaje(t.ventas - t.consumido, t.consumido);
  const maxFecha = Math.max(1, ...m.porFecha.map((f) => f.consumido));
  const maxHora = Math.max(1, ...m.porHora.map((f) => f.visitas));
  // Horario de restaurante: de 8 a 7 del día siguiente, sin la madrugada vacía.
  const orden = [...m.porHora.slice(8), ...m.porHora.slice(0, 8)];
  let finHoras = orden.length;
  while (finHoras > 16 && !orden[finHoras - 1].visitas) finHoras--;
  const horas = orden.slice(0, finHoras);
  const unLocal = localId ? m.porLocal[0] : null;
  const pctLocalTexto = (x: { local: number; consumido: number }) => `${porcentaje(x.local, x.consumido)}%`;
  const paso = Math.max(1, Math.ceil(m.porFecha.length / 12));

  return (
    <>
      <FiltroMetricas base={base} desde={desde} hasta={hasta} local={localId ?? ''} locales={locales} meses={meses} inicio={INICIO_VP} />
      <div className="vp-titulo vp-met-cab">
        <p className="vp-sub">Del <b>{fechaLarga(desde)}</b> al <b>{fechaLarga(hasta)}</b>{unLocal && locales ? <> · <b>{unLocal.nombre}</b></> : null}. Los consumos anulados no cuentan.</p>
        <a className="vp-btn chico linea" href={csv}>Descargar Excel</a>
      </div>

      <div className="vp-stats vp-met-stats">
        <div className="destacado"><b>{t.personas.toLocaleString('es-AR')}</b><span>personas vinieron con la promoción</span>
          <small>en {t.visitas} {t.visitas === 1 ? 'mesa' : 'mesas'} · {t.clientes} gift cards distintas{t.visitas > t.mesasConPersonas ? ` · ${t.visitas - t.mesasConPersonas} sin dato de personas` : ''}</small></div>
        <div><b>{pesos(t.consumido)}</b><span>consumido con gift cards</span><small>{t.visitas ? `${pesos(Math.round(t.consumido / t.visitas))} por mesa` : '—'}</small></div>
        <div><b>{pesos(t.ventas)}</b><span>venta total de esas mesas</span><small>{t.ventas > t.consumido ? `los clientes pagaron ${pesos(t.ventas - t.consumido)} aparte (+${extraPct}%)` : 'sin consumo extra'}</small></div>
        <div><b>{t.visitas ? pesos(Math.round(t.ventas / t.visitas)) : '—'}</b><span>ticket promedio</span><small>{t.mesasConPersonas ? `${(t.personas / t.mesasConPersonas).toLocaleString('es-AR', { maximumFractionDigits: 1 })} personas por mesa` : '—'}</small></div>
      </div>

      <section className="vp-met-bloque">
        <h2>¿Quién lo paga?</h2>
        <p className="vp-ayuda">De los {pesos(t.consumido)} consumidos con gift cards{unLocal ? ` en ${unLocal.nombre}` : ''}:</p>
        {t.consumido ? (
          <>
            <div className="vp-split" role="img" aria-label={`Locales ${pctLocal}%, Vistapueblo ${pctVp}%`}>
              {t.local > 0 && <i className="loc" style={{ width: `${pctLocal}%` }} title={`Locales: ${pesos(t.local)} (${pctLocal}%)`} />}
              {t.vp > 0 && <i className="vp" style={{ width: `${pctVp}%` }} title={`Vistapueblo: ${pesos(t.vp)} (${pctVp}%)`} />}
            </div>
            <ul className="vp-leyenda">
              <li><i className="loc" aria-hidden="true" /><span>{unLocal ? `Absorbe ${unLocal.nombre}` : 'Absorben los locales'}</span><b>{pctLocal}% · {pesos(t.local)}</b></li>
              <li><i className="vp" aria-hidden="true" /><span>Cubre Vistapueblo <small>(se descuenta del alquiler)</small></span><b>{pctVp}% · {pesos(t.vp)}</b></li>
            </ul>
          </>
        ) : <p className="vp-vacio">No hay consumos en este período.</p>}
        {t.perdido > 0 && <p className="vp-ayuda">Además, en gift cards de consumo total quedaron {pesos(t.perdido)} sin usar.</p>}
      </section>

      {!localId && (
        <section className="vp-met-bloque">
          <h2>Por local</h2>
          <div className="vp-tabla">
            <table>
              <thead><tr><th>Local</th><th className="n">Mesas</th><th className="n">Personas</th><th className="n">Consumido</th><th>Del total</th><th className="n">% local</th><th className="n">Absorbe el local</th><th className="n">Cubre Vistapueblo</th><th className="n">Venta total</th></tr></thead>
              <tbody>
                {m.porLocal.map((f) => (
                  <tr key={f.id}>
                    <td><b>{f.nombre}</b></td><td className="n">{f.visitas}</td><td className="n">{f.personas}</td><td className="n">{pesos(f.consumido)}</td>
                    <td><span className="vp-parte"><i style={{ width: `${porcentaje(f.consumido, t.consumido)}%` }} /><em>{porcentaje(f.consumido, t.consumido)}%</em></span></td>
                    <td className="n">{f.consumido ? pctLocalTexto(f) : `${f.porcentaje}%`}</td><td className="n">{pesos(f.local)}</td><td className="n">{pesos(f.vp)}</td><td className="n">{pesos(f.ventas)}</td>
                  </tr>
                ))}
                <tr className="tot"><td>Total</td><td className="n">{t.visitas}</td><td className="n">{t.personas}</td><td className="n">{pesos(t.consumido)}</td><td>100%</td><td className="n">{pctLocal}%</td><td className="n">{pesos(t.local)}</td><td className="n">{pesos(t.vp)}</td><td className="n">{pesos(t.ventas)}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="vp-met-dos">
        <section className="vp-met-bloque">
          <h2>Consumido por {m.agrupado === 'mes' ? 'mes' : 'día'}</h2>
          <div className="vp-columnas" role="img" aria-label={`Consumido por ${m.agrupado === 'mes' ? 'mes' : 'día'}`}>
            {m.porFecha.map((f, i) => (
              <div key={f.k} className="vp-col" data-t={`${m.agrupado === 'mes' ? nombreMes(f.k) : fechaLarga(f.k)}: ${pesos(f.consumido)} · ${f.visitas} mesas · ${f.personas} personas`} tabIndex={0}>
                <i style={{ height: `${(f.consumido / maxFecha) * 100}%` }} />
                <span>{i % paso === 0 ? etiqueta(f.k, m.agrupado) : ''}</span>
              </div>
            ))}
          </div>
          <details className="vp-tabla-ver"><summary>Ver en tabla</summary>
            <div className="vp-tabla"><table><thead><tr><th>{m.agrupado === 'mes' ? 'Mes' : 'Día'}</th><th className="n">Mesas</th><th className="n">Personas</th><th className="n">Consumido</th></tr></thead>
              <tbody>{m.porFecha.filter((f) => f.visitas).map((f) => <tr key={f.k}><td>{m.agrupado === 'mes' ? nombreMes(f.k) : fechaLarga(f.k)}</td><td className="n">{f.visitas}</td><td className="n">{f.personas}</td><td className="n">{pesos(f.consumido)}</td></tr>)}</tbody></table></div>
          </details>
        </section>
        <section className="vp-met-bloque">
          <h2>Horarios con más mesas</h2>
          <div className="vp-columnas horas" role="img" aria-label="Mesas por hora del día">
            {horas.map((f) => (
              <div key={f.h} className="vp-col" data-t={`${String(f.h).padStart(2, '0')} a ${String((f.h + 1) % 24).padStart(2, '0')} hs: ${f.visitas} ${f.visitas === 1 ? 'mesa' : 'mesas'}`} tabIndex={0}>
                <i style={{ height: `${(f.visitas / maxHora) * 100}%` }} />
                <span>{f.h % 3 === 0 ? `${f.h}h` : ''}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      {!localId && (
        <section className="vp-met-bloque">
          <h2>Gift cards emitidas en el período</h2>
          <div className="vp-stats chicas">
            <div><b>{m.emitidas.cantidad}</b><span>emitidas · {pesos(m.emitidas.monto)}</span></div>
            <div><b>{porcentaje(m.emitidas.usadas, m.emitidas.cantidad)}%</b><span>ya se usaron ({m.emitidas.usadas})</span></div>
            <div><b>{m.emitidas.impresas}</b><span>impresas · {m.emitidas.cantidad - m.emitidas.impresas} digitales</span></div>
          </div>
        </section>
      )}

      {detalle && (
        <section className="vp-met-bloque">
          <h2>Detalle de consumos</h2>
          {m.consumos.length ? (
            <div className="vp-tabla">
              <table>
                <thead><tr><th>N°</th><th>Día y hora</th><th>Gift card</th><th className="n">Personas</th><th className="n">Ticket</th><th className="n">Gift card</th><th className="n">Absorbe el local</th><th className="n">Cubre Vistapueblo</th></tr></thead>
                <tbody>
                  {m.consumos.map((c) => (
                    <tr key={c.id} className={c.anulado ? 'anulado' : ''}>
                      <td>{c.numero}</td><td>{diaHora(c.created_at)}{c.cajero ? <small>{c.cajero}</small> : null}</td><td>N° {c.tarjeta?.numero} · {c.tarjeta?.nombre}</td>
                      <td className="n">{c.personas ?? '—'}</td><td className="n">{pesos(c.ticket)}</td><td className="n">{pesos(c.monto)}</td><td className="n">{pesos(c.a_cargo_local)} <small>{c.porcentaje}%</small></td><td className="n">{pesos(c.a_cargo_vp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="vp-vacio">No hay consumos en este período.</p>}
        </section>
      )}
    </>
  );
}
