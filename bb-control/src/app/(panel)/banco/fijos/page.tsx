import Link from 'next/link';
import { agregarFijoSugerido, borrarFijo, guardarFijo } from '@/acciones/banco';
import { ElegirProveedor, type OpcionProveedor } from '@/components/ElegirProveedor';
import { BotonAccion, FormAccion } from '@/components/FormAccion';
import { TabsBanco } from '@/components/TabsBanco';
import { Tile } from '@/components/Tile';
import { Titulo } from '@/components/Titulo';
import { Ventana } from '@/components/Ventana';
import { leerDolar } from '@/lib/ajustes';
import { db } from '@/lib/db';
import { aTexto, dolares, hoy, mesCorto, pesos, sumarMeses } from '@/lib/formato';
import { type Params, param, url } from '@/lib/url';

export const metadata = { title: 'Gastos fijos · BB-CONTROL' };

type Fijo = {
  id: number; nombre: string; monto: number; moneda: 'ARS' | 'USD'; dia: number; rubro_id: number | null; proveedor_id: number | null;
  desde: string; hasta: string | null; activo: boolean; notas: string; rubro: string | null; proveedor: string | null; cargado: boolean;
};
type Sugerencia = { proveedor_id: number; rubro_id: number; proveedor: string; rubro: string; meses: number; monto: number; dia: number };

export default async function Fijos({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const mes = hoy().slice(0, 7);
  const desde3 = `${sumarMeses(mes, -3)}-01`;
  const sql = db();
  const [fijos, sugerencias, rubros, [equipo], dolar] = await Promise.all([
    sql<Fijo[]>`
      select f.*, r.nombre rubro, p.nombre proveedor,
        exists (select 1 from egresos e where e.tipo = 'gasto' and to_char(e.fecha, 'YYYY-MM') = ${mes}
                and (f.rubro_id is null or e.rubro_id = f.rubro_id) and (f.proveedor_id is null or e.proveedor_id = f.proveedor_id)
                and (f.rubro_id is not null or f.proveedor_id is not null)) cargado
      from fijos f left join rubros r on r.id = f.rubro_id left join proveedores p on p.id = f.proveedor_id
      order by f.activo desc, f.dia, f.nombre`,
    // Gastos del mismo proveedor y rubro en al menos 2 de los últimos 3 meses que todavía no están como fijos.
    sql<Sugerencia[]>`
      with g as (
        select e.proveedor_id, e.rubro_id, to_char(e.fecha, 'YYYY-MM') mes, sum(e.total_ars) total,
               max(extract(day from coalesce(e.vencimiento, e.fecha)))::int dia
        from egresos e join rubros r on r.id = e.rubro_id
        where e.tipo = 'gasto' and e.fecha >= ${desde3} and e.proveedor_id is not null and r.clase = 'operativo'
          and coalesce(e.clave, '') not like 'contab|%' and coalesce(e.clave, '') not like 'cuota|%'
        group by 1, 2, 3)
      select g.proveedor_id, g.rubro_id, p.nombre proveedor, r.nombre rubro, count(*)::int meses, round(avg(g.total)) monto, round(avg(g.dia))::int dia
      from g join proveedores p on p.id = g.proveedor_id join rubros r on r.id = g.rubro_id
      where not exists (select 1 from fijos f where f.proveedor_id = g.proveedor_id and (f.rubro_id is null or f.rubro_id = g.rubro_id))
      group by 1, 2, 3, 4 having count(*) >= 2 order by 6 desc limit 8`,
    sql<{ id: number; nombre: string }[]>`select id, nombre from rubros where tipo = 'gasto' and activo order by orden, nombre`,
    sql`select coalesce(sum(sueldo_neto), 0) neto, count(*)::int n from empleados where activo`,
    leerDolar(),
  ]);
  const activos = fijos.filter((f) => f.activo && (!f.hasta || f.hasta.slice(0, 7) >= mes) && f.desde.slice(0, 7) <= sumarMeses(mes, 12));
  const porMes = activos.reduce((a, f) => a + (f.moneda === 'USD' ? f.monto * (dolar?.valor ?? 0) : f.monto), 0);
  const cerrar = url('/banco/fijos', sp, { nuevo: null, editar: null });
  const idEdit = Number(param(sp, 'editar')) || 0;
  const ed = idEdit ? fijos.find((f) => f.id === idEdit) : null;
  const abierto = param(sp, 'nuevo') || ed;
  const proveedores = abierto
    ? await sql<OpcionProveedor[]>`select id, nombre, cuit, rubro_id, alias from proveedores where activo or id = ${ed?.proveedor_id ?? 0} order by lower(nombre)`
    : [];

  return (
    <>
      <div className="cabeza">
        <Titulo modulo="banco" titulo="Gastos fijos">
          Lo que se paga todos los meses (alquiler, servicios, seguros, sistemas…). Se proyecta en la planificación hasta que se carga en Gastos.
        </Titulo>
        <div className="acciones">
          <Link className="btn vino" href={url('/banco/fijos', sp, { nuevo: 1, editar: null })} scroll={false}>+ Gasto fijo</Link>
        </div>
      </div>
      <TabsBanco actual="/banco/fijos" />

      <div className="tiles">
        <Tile titulo="Gastos fijos por mes" valor={pesos(porMes, 0)} oscuro sub={`${activos.length} activos`} />
        <Tile titulo="Sueldos por mes" valor={pesos(equipo.neto, 0)} sub={`Neto de referencia de ${equipo.n} personas (se proyecta solo)`} />
        <Tile titulo="Fijos + sueldos" valor={pesos(porMes + Number(equipo.neto), 0)} sub="Sin impuestos ni cuotas" />
      </div>
      <div className="aviso">
        No hace falta cargar acá los sueldos, el aguinaldo, el F.931, el IVA ni los Ingresos Brutos: se proyectan solos (los impuestos, con lo último que cargó el contador). Las cuotas van en Préstamos y deudas.
      </div>

      {sugerencias.length > 0 && (
        <div className="caja">
          <h2>Se repiten en Gastos</h2>
          <p className="sub">Aparecen en al menos 2 de los últimos 3 meses. Agregalos como fijos para que se proyecten.</p>
          <div className="lista-mi">
            {sugerencias.map((s) => (
              <div key={`${s.proveedor_id}-${s.rubro_id}`}>
                <span>{s.proveedor}<small> · {s.rubro} · {s.meses} meses · día {s.dia}</small></span>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <b className="num">{pesos(s.monto, 0)}</b>
                  <BotonAccion accion={agregarFijoSugerido} campos={{ nombre: `${s.rubro.replace(/\s*\(.*\)$/, '')} · ${s.proveedor}`, monto: s.monto, dia: s.dia, rubro_id: s.rubro_id, proveedor_id: s.proveedor_id }} className="btn claro chico">
                    Agregar
                  </BotonAccion>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="tabla-env">
        <table className="t">
          <thead>
            <tr><th>Gasto</th><th className="der">Por mes</th><th>Día</th><th>Vigencia</th><th>Este mes</th><th><span className="sr">Acciones</span></th></tr>
          </thead>
          <tbody>
            {fijos.map((f) => (
              <tr key={f.id} style={f.activo ? undefined : { opacity: 0.55 }}>
                <td className="corta">
                  <span className="principal">{f.nombre}</span>
                  <div className="chico">{[f.proveedor, f.rubro].filter(Boolean).join(' · ') || 'Sin proveedor ni rubro'}</div>
                </td>
                <td className="der num principal">{f.moneda === 'USD' ? dolares(f.monto) : pesos(f.monto, 0)}</td>
                <td className="num">{f.dia}</td>
                <td className="chico">Desde {mesCorto(f.desde.slice(0, 7))}{f.hasta ? ` hasta ${mesCorto(f.hasta.slice(0, 7))}` : ''}</td>
                <td>{!f.activo ? <span className="chip">Inactivo</span> : f.cargado ? <span className="chip bien">Ya está en Gastos</span> : <span className="chip alerta">Proyectado</span>}</td>
                <td>
                  <div className="iconos">
                    <Link className="ico" href={url('/banco/fijos', sp, { editar: f.id, nuevo: null })} scroll={false}>Editar</Link>
                    <BotonAccion accion={borrarFijo} campos={{ id: f.id }} className="ico mal" confirmar={`¿Borrar ${f.nombre}?`}>Borrar</BotonAccion>
                  </div>
                </td>
              </tr>
            ))}
            {!fijos.length && <tr><td colSpan={6} className="vacio">No hay gastos fijos cargados.</td></tr>}
          </tbody>
        </table>
      </div>

      {abierto && (
        <Ventana titulo={ed ? `Editar ${ed.nombre}` : 'Gasto fijo nuevo'} cerrar={cerrar}>
          <FormAccion accion={guardarFijo} key={ed?.id ?? 'nuevo'}>
            <input type="hidden" name="volver" value={cerrar} />
            {ed && <input type="hidden" name="id" value={ed.id} />}
            <label className="campo ancho"><span>Nombre</span><input name="nombre" defaultValue={ed?.nombre} required placeholder="Ej.: Alquiler depósito" /></label>
            <label className="campo"><span>Monto por mes</span><input name="monto" inputMode="decimal" defaultValue={aTexto(ed?.monto)} required /></label>
            <label className="campo">
              <span>Moneda</span>
              <select name="moneda" defaultValue={ed?.moneda ?? 'ARS'}><option value="ARS">Pesos</option><option value="USD">Dólares</option></select>
            </label>
            <label className="campo"><span>Día de pago</span><input name="dia" type="number" min={1} max={31} defaultValue={ed?.dia ?? 10} required /></label>
            <label className="campo">
              <span>Rubro de gastos</span>
              <select name="rubro_id" defaultValue={ed?.rubro_id ?? ''}>
                <option value="">Sin rubro</option>
                {rubros.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
            </label>
            <ElegirProveedor opciones={proveedores} id={ed?.proveedor_id} />
            <label className="campo"><span>Desde</span><input name="desde" type="month" defaultValue={ed?.desde.slice(0, 7) ?? mes} required /></label>
            <label className="campo"><span>Hasta <em>(opcional)</em></span><input name="hasta" type="month" defaultValue={ed?.hasta?.slice(0, 7) ?? ''} /></label>
            <label className="campo ancho"><span>Notas</span><input name="notas" defaultValue={ed?.notas} /></label>
            {ed && <label className="casilla ancho"><input type="checkbox" name="activo" defaultChecked={ed.activo} /> Activo</label>}
            <p className="sub ancho" style={{ margin: 0 }}>Con rubro y proveedor, el mes que se carga en Gastos deja de proyectarse (y si quedó sin pagar, aparece como factura a pagar).</p>
          </FormAccion>
        </Ventana>
      )}
    </>
  );
}
