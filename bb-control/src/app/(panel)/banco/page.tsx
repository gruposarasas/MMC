import Link from 'next/link';
import { guardarCuenta } from '@/acciones/banco';
import { Columnas } from '@/components/Columnas';
import { FormAccion } from '@/components/FormAccion';
import { TabsBanco } from '@/components/TabsBanco';
import { Tile } from '@/components/Tile';
import { Titulo } from '@/components/Titulo';
import { leerDolar } from '@/lib/ajustes';
import { CATEGORIAS, type Categoria, type Item, planificacion } from '@/lib/banco';
import { db } from '@/lib/db';
import { aTexto, dolares, fecha, hoy, mesCorto, nombreMes, numero, pesos } from '@/lib/formato';

export const metadata = { title: 'Banco · BB-CONTROL' };

type Cuenta = { id: number; nombre: string; banco: string; moneda: 'ARS' | 'USD'; saldo: number; saldo_al: string | null; activo: boolean };
const CLASE: Record<Categoria | 'cobros', string> = {
  echeqs: 'cat-echeqs', deudas: 'cat-deudas', proveedores: 'cat-proveedores', impuestos: 'cat-impuestos', fijos: 'cat-fijos', sueldos: 'cat-sueldos', cobros: 'cat-cobros',
};

function Lista({ items }: { items: Item[] }) {
  return (
    <ul className="plan-lista">
      {items.map((x, i) => (
        <li key={i}>
          <span className="num plan-fecha">{fecha(x.fecha).slice(0, 5)}</span>
          <span className="plan-concepto">
            <Link href={x.href}>{x.concepto}</Link>
            <small>
              <span className={`cat ${CLASE[x.categoria]}`}>{x.categoria === 'cobros' ? 'A cobrar' : CATEGORIAS[x.categoria]}</span>
              {x.estimado && <span className="chip">Estimado</span>}
              {x.detalle && ` ${x.detalle}`}
            </small>
          </span>
          <span className={`num plan-monto${x.categoria === 'cobros' ? ' cobro' : ''}`}>{x.categoria === 'cobros' ? '+' : ''}{pesos(x.monto, 0)}</span>
        </li>
      ))}
    </ul>
  );
}

// Todo lo que hay que pagar en los próximos 12 meses: echeqs, cuotas, facturas, impuestos, fijos y sueldos.
export default async function Banco() {
  const sql = db();
  const [plan, cuentas, deudas, dolar] = await Promise.all([
    planificacion(12),
    sql<Cuenta[]>`select * from cuentas_banco order by activo desc, orden, id`,
    sql`select moneda, sum(total) total from (
          select p.moneda, c.total from pasivo_cuotas c join pasivos p on p.id = c.pasivo_id where c.pagada_el is null and p.activo
          union all select moneda, monto from echeqs where estado = 'pendiente' and sentido = 'emitido') x group by 1`,
    leerDolar(),
  ]);
  const deudaFin = deudas.reduce((a, d) => a + Number(d.total) * (d.moneda === 'USD' ? (dolar?.valor ?? 0) : 1), 0);
  const vencido = plan.vencido.reduce((a, x) => a + x.monto, 0);
  const anio = plan.meses.reduce((a, m) => a + m.total, 0);
  const este = plan.meses[0];
  const estimadoEste = este.items.filter((x) => x.estimado && x.categoria !== 'cobros').reduce((a, x) => a + x.monto, 0);
  const cats = Object.keys(CATEGORIAS) as Categoria[];
  const hayCobros = plan.meses.some((m) => m.cobros);

  return (
    <>
      <div className="cabeza">
        <Titulo modulo="banco" titulo="Banco">
          Todo lo que hay que pagar en los próximos 12 meses: echeqs, cuotas de préstamos y planes, facturas de proveedores, impuestos,
          gastos fijos y sueldos. Lo estimado está marcado.
        </Titulo>
        <div className="acciones">
          <Link className="btn claro" href="/banco/echeqs?nuevo=1">+ Echeq</Link>
          <Link className="btn vino" href="/banco/deudas?nuevo=1">+ Préstamo o deuda</Link>
        </div>
      </div>
      <TabsBanco actual="/banco" />
      {plan.avisos.map((a) => <div className="aviso" key={a}>{a}</div>)}

      <div className="tiles">
        <Tile titulo="En bancos" valor={plan.saldoBancos == null ? '—' : pesos(plan.saldoBancos, 0)} oscuro sub={plan.saldoBancos == null ? 'Cargá el saldo de tus cuentas abajo' : `${plan.cuentas} ${plan.cuentas === 1 ? 'cuenta' : 'cuentas'}`} />
        <Tile titulo="Vencido sin pagar" valor={pesos(vencido, 0)} sub={plan.vencido.length ? `${plan.vencido.length} pagos con fecha pasada` : 'Nada vencido'} />
        <Tile titulo={`A pagar en ${nombreMes(este.mes).split(' ')[0]}`} valor={pesos(este.total, 0)} sub={estimadoEste ? `${pesos(estimadoEste, 0)} estimado` : 'Todo con montos reales'} />
        <Tile titulo="Próximos 12 meses" valor={pesos(anio, 0)} sub={`Promedio ${pesos(anio / 12, 0)} por mes`} />
        <Tile titulo="Deuda financiera" valor={pesos(deudaFin, 0)} sub="Cuotas y echeqs emitidos por pagar" />
      </div>

      <div className="grilla2">
        <div className="caja">
          <h2>Obligaciones por mes</h2>
          <p className="sub">Lo que hay que pagar cada mes, con lo estimado incluido.</p>
          <Columnas
            datos={plan.meses.map((m) => ({ clave: m.mes, etiqueta: mesCorto(m.mes).slice(0, 3), valor: Math.round(m.total), detalle: nombreMes(m.mes) }))}
            color="var(--s-costos)"
            resaltar={este.mes}
          />
        </div>
        <div className="caja">
          <h2>Saldos en bancos</h2>
          <p className="sub">Cargá el saldo de cada cuenta para ver cuánto alcanza. Se actualiza a mano.</p>
          {cuentas.length > 0 && (
            <div className="lista-mi" style={{ marginBottom: 12 }}>
              {cuentas.map((c) => (
                <details key={c.id} className="ob-editar cuenta">
                  <summary>
                    <span>{c.nombre}{!c.activo && ' (inactiva)'}<small>{c.saldo_al ? ` · al ${fecha(c.saldo_al)}` : ''}</small></span>
                    <b className="num">{c.moneda === 'USD' ? dolares(c.saldo) : pesos(c.saldo, 0)}</b>
                  </summary>
                  <FormAccion accion={guardarCuenta} boton="Guardar" claseBoton="btn chico" key={`${c.id}-${c.saldo}-${c.saldo_al}`}>
                    <input type="hidden" name="id" value={c.id} />
                    <label className="campo"><span>Nombre</span><input name="nombre" defaultValue={c.nombre} required /></label>
                    <label className="campo"><span>Banco</span><input name="banco" defaultValue={c.banco} /></label>
                    <label className="campo"><span>Saldo</span><input name="saldo" inputMode="decimal" defaultValue={aTexto(c.saldo) || '0'} required /></label>
                    <label className="campo"><span>Al día</span><input name="saldo_al" type="date" defaultValue={hoy()} /></label>
                    <input type="hidden" name="moneda" value={c.moneda} />
                    <label className="casilla ancho"><input type="checkbox" name="activo" defaultChecked={c.activo} /> Activa (suma en el saldo)</label>
                  </FormAccion>
                </details>
              ))}
            </div>
          )}
          <details className="ob-editar">
            <summary>+ Agregar cuenta</summary>
            <FormAccion accion={guardarCuenta} boton="Agregar" claseBoton="btn chico" limpiar>
              <label className="campo"><span>Nombre</span><input name="nombre" required placeholder="Ej.: Galicia cuenta corriente" /></label>
              <label className="campo"><span>Banco</span><input name="banco" /></label>
              <label className="campo"><span>Moneda</span><select name="moneda"><option value="ARS">Pesos</option><option value="USD">Dólares</option></select></label>
              <label className="campo"><span>Saldo hoy</span><input name="saldo" inputMode="decimal" required /></label>
            </FormAccion>
          </details>
        </div>
      </div>

      <div className="caja">
        <h2>Mes por mes</h2>
        <p className="sub">
          {plan.saldoBancos == null
            ? 'Con el saldo de las cuentas cargado se ve también el saldo proyectado.'
            : 'Saldo proyectado: lo que hay hoy en los bancos, menos lo vencido y lo que vence cada mes, más los echeqs a cobrar. No cuenta las ventas que vienen.'}
        </p>
        <div className="tabla-env">
          <table className="t plan-tabla">
            <thead>
              <tr>
                <th>Mes</th>
                {cats.map((c) => <th key={c} className="der">{CATEGORIAS[c]}</th>)}
                <th className="der">Total</th>
                {hayCobros && <th className="der">A cobrar</th>}
                {plan.saldoBancos != null && <th className="der">Saldo proyectado</th>}
              </tr>
            </thead>
            <tbody>
              {plan.vencido.length > 0 && (
                <tr className="fila-vencido">
                  <td className="principal">Vencido</td>
                  {cats.map((c) => {
                    const v = plan.vencido.filter((x) => x.categoria === c).reduce((a, x) => a + x.monto, 0);
                    return <td key={c} className="der num">{v ? pesos(v, 0) : '—'}</td>;
                  })}
                  <td className="der num principal">{pesos(vencido, 0)}</td>
                  {hayCobros && <td />}
                  {plan.saldoBancos != null && <td className="der num">{pesos(plan.saldoBancos - vencido, 0)}</td>}
                </tr>
              )}
              {plan.meses.map((m) => (
                <tr key={m.mes}>
                  <td className="principal">{mesCorto(m.mes)}</td>
                  {cats.map((c) => <td key={c} className="der num">{m.por[c] ? pesos(m.por[c], 0) : '—'}</td>)}
                  <td className="der num principal">{pesos(m.total, 0)}</td>
                  {hayCobros && <td className="der num">{m.cobros ? pesos(m.cobros, 0) : '—'}</td>}
                  {plan.saldoBancos != null && <td className={`der num${(m.saldo ?? 0) < 0 ? ' negativo' : ''}`}>{pesos(m.saldo, 0)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {plan.vencido.length > 0 && (
        <div className="caja">
          <h2>Vencido sin pagar</h2>
          <p className="sub">Si ya se pagó, marcalo en su módulo (un echeq debitado, una cuota o una factura) para que deje de aparecer.</p>
          <Lista items={plan.vencido} />
        </div>
      )}

      <div className="caja">
        <h2>Detalle</h2>
        <p className="sub">Cada pago con su fecha. Tocá uno para ir a cargarlo o corregirlo.</p>
        {plan.meses.map((m, i) => (
          <details key={m.mes} className="plan-mes" open={i === 0}>
            <summary>
              <span>{nombreMes(m.mes)}</span>
              <span className="num">{numero(m.items.length)} pagos · <b>{pesos(m.total, 0)}</b></span>
            </summary>
            {m.items.length ? <Lista items={m.items} /> : <p className="vacio">Nada para pagar.</p>}
          </details>
        ))}
      </div>
    </>
  );
}
