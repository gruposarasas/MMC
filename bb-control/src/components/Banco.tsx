'use client';
import { useCallback, useState } from 'react';
import { crearPasivo, guardarEcheq } from '@/acciones/banco';
import { ElegirProveedor, type OpcionProveedor } from '@/components/ElegirProveedor';
import { FormAccion } from '@/components/FormAccion';
import { cronograma, type Sistema, SISTEMAS } from '@/lib/cuotas';
import { aNumero, aTexto, fecha, pesos } from '@/lib/formato';

export type FacturaPendiente = { id: number; proveedor_id: number | null; fecha: string; detalle: string; total: number; vencimiento: string | null };
export type EcheqForm = {
  id: number; sentido: 'emitido' | 'recibido'; cuenta_id: number | null; numero: string; banco: string; proveedor_id: number | null; tercero: string;
  cuit: string; emision: string | null; pago: string; moneda: 'ARS' | 'USD'; monto: number; notas: string;
};

/** Alta o edición de un echeq. Si es emitido, se pueden marcar las facturas del proveedor que paga. */
export function FormEcheq({ e, cuentas, proveedores, facturas, vinculadas, volver, sentidoInicial }: {
  e: EcheqForm | null; cuentas: { id: number; nombre: string }[]; proveedores: OpcionProveedor[]; facturas: FacturaPendiente[];
  vinculadas: number[]; volver: string; sentidoInicial: 'emitido' | 'recibido';
}) {
  const [sentido, setSentido] = useState<'emitido' | 'recibido'>(e?.sentido ?? sentidoInicial);
  const [prov, setProv] = useState<number | null>(e?.proveedor_id ?? null);
  const [marcadas, setMarcadas] = useState<number[]>(vinculadas);
  const [monto, setMonto] = useState(aTexto(e?.monto));
  const onCambio = useCallback((id: number | null) => setProv(id), []);
  const delProveedor = facturas.filter((f) => f.proveedor_id === prov);
  const suma = delProveedor.filter((f) => marcadas.includes(f.id)).reduce((a, f) => a + f.total, 0);
  const elegidoSinNuevo = e && !e.proveedor_id && e.tercero ? { nombre: e.tercero, cuit: e.cuit } : null;

  return (
    <FormAccion accion={guardarEcheq}>
      <input type="hidden" name="volver" value={volver} />
      {e && <input type="hidden" name="id" value={e.id} />}
      <div className="ancho modo-carga" role="group" aria-label="Tipo de echeq">
        <button type="button" className={sentido === 'emitido' ? 'on' : ''} aria-pressed={sentido === 'emitido'} onClick={() => setSentido('emitido')}>Emitido (lo pagamos)</button>
        <button type="button" className={sentido === 'recibido' ? 'on' : ''} aria-pressed={sentido === 'recibido'} onClick={() => setSentido('recibido')}>Recibido (lo cobramos)</button>
      </div>
      <input type="hidden" name="sentido" value={sentido} />
      {sentido === 'emitido' ? (
        <ElegirProveedor opciones={proveedores} id={e?.proveedor_id} nuevo={elegidoSinNuevo} requerido etiqueta="A la orden de (proveedor)" onCambio={onCambio} />
      ) : (
        <label className="campo">
          <span>Quién lo libró (cliente)</span>
          <input name="tercero" defaultValue={e?.tercero} required autoComplete="off" />
        </label>
      )}
      <label className="campo">
        <span>Fecha de {sentido === 'emitido' ? 'pago' : 'cobro'}</span>
        <input type="date" name="pago" defaultValue={e?.pago} required />
      </label>
      <label className="campo">
        <span>Monto</span>
        <input name="monto" inputMode="decimal" required value={monto} onChange={(x) => setMonto(x.target.value)} placeholder="0" />
      </label>
      <label className="campo">
        <span>Moneda</span>
        <select name="moneda" defaultValue={e?.moneda ?? 'ARS'}>
          <option value="ARS">Pesos</option>
          <option value="USD">Dólares</option>
        </select>
      </label>
      <label className="campo">
        <span>Número <em>(opcional)</em></span>
        <input name="numero" defaultValue={e?.numero} autoComplete="off" />
      </label>
      {sentido === 'emitido' ? (
        <label className="campo">
          <span>Cuenta</span>
          <select name="cuenta_id" defaultValue={e?.cuenta_id ?? cuentas[0]?.id ?? ''}>
            <option value="">Sin cuenta</option>
            {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
      ) : (
        <label className="campo">
          <span>Banco <em>(opcional)</em></span>
          <input name="banco" defaultValue={e?.banco} />
        </label>
      )}
      <label className="campo">
        <span>Emisión <em>(opcional)</em></span>
        <input type="date" name="emision" defaultValue={e?.emision ?? ''} />
      </label>
      <label className="campo">
        <span>CUIT <em>(opcional)</em></span>
        <input name="cuit" defaultValue={e?.cuit} inputMode="numeric" />
      </label>
      {sentido === 'emitido' && prov && (
        <fieldset className="ancho facturas-echeq">
          <legend>Facturas que paga <em>(quedan pagadas con la fecha del echeq)</em></legend>
          {delProveedor.length ? (
            <>
              {delProveedor.map((f) => (
                <label key={f.id} className="casilla">
                  <input
                    type="checkbox"
                    name="egresos"
                    value={f.id}
                    checked={marcadas.includes(f.id)}
                    onChange={(x) => setMarcadas((m) => (x.target.checked ? [...m, f.id] : m.filter((y) => y !== f.id)))}
                  />
                  <span>
                    {fecha(f.fecha)} · {f.detalle || 'Sin detalle'} · <b className="num">{pesos(f.total)}</b>
                    {f.vencimiento && <small> · vence {fecha(f.vencimiento)}</small>}
                  </span>
                </label>
              ))}
              {suma > 0 && (
                <p className="chico" style={{ margin: '6px 0 0' }}>
                  Elegidas: {pesos(suma)}
                  {aNumero(monto) && Math.abs(suma - (aNumero(monto) ?? 0)) > 1 ? ` · el echeq es de ${pesos(aNumero(monto))}` : ''}
                </p>
              )}
            </>
          ) : (
            <p className="chico" style={{ margin: 0 }}>Este proveedor no tiene facturas sin pagar.</p>
          )}
        </fieldset>
      )}
      <label className="campo ancho">
        <span>Notas</span>
        <input name="notas" defaultValue={e?.notas} />
      </label>
    </FormAccion>
  );
}

/** Préstamo, plan de pagos o deuda nueva, con la vista previa del cronograma. */
export function FormDeuda({ rubros, rubroDefecto }: { rubros: { id: number; nombre: string }[]; rubroDefecto: number | null }) {
  const [sistema, setSistema] = useState<Sistema>('frances');
  const [v, setV] = useState({ capital: '', tasa: '', cuotas: '12', primera: '', cuotaFija: '', otros: '' });
  const [iva, setIva] = useState(true);
  const cambiar = (k: keyof typeof v) => (x: React.ChangeEvent<HTMLInputElement>) => setV((o) => ({ ...o, [k]: x.target.value }));
  const n = (s: string) => aNumero(s) ?? 0;
  const listo = v.primera && (sistema === 'fija' ? n(v.cuotaFija) > 0 : n(v.capital) > 0);
  const plan = listo
    ? cronograma({ capital: n(v.capital), tasa: v.tasa ? n(v.tasa) : 0, cuotas: n(v.cuotas) || 1, primera: v.primera, sistema, cuotaFija: n(v.cuotaFija), ivaIntereses: iva, otros: n(v.otros) })
    : [];
  const total = plan.reduce((a, c) => a + c.total, 0);
  const intereses = plan.reduce((a, c) => a + c.interes + c.iva + c.otros, 0);
  const conTasa = sistema === 'frances' || sistema === 'aleman' || sistema === 'unica';

  return (
    <FormAccion accion={crearPasivo} boton="Crear y ver cuotas">
      <label className="campo">
        <span>Qué es</span>
        <select name="tipo" defaultValue="prestamo">
          <option value="prestamo">Préstamo</option>
          <option value="plan">Plan de pagos (ARCA, ATM…)</option>
          <option value="leasing">Leasing</option>
          <option value="tarjeta">Tarjeta de crédito (en cuotas)</option>
          <option value="deuda">Deuda con un proveedor</option>
          <option value="otro">Otro</option>
        </select>
      </label>
      <label className="campo">
        <span>Nombre</span>
        <input name="nombre" required placeholder="Ej.: Préstamo Galicia tostadora" />
      </label>
      <label className="campo">
        <span>Acreedor <em>(banco, organismo o proveedor)</em></span>
        <input name="acreedor" placeholder="Ej.: Banco Galicia" />
      </label>
      <label className="campo">
        <span>Cómo se paga</span>
        <select name="sistema" value={sistema} onChange={(x) => setSistema(x.target.value as Sistema)}>
          {Object.entries(SISTEMAS).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
      </label>
      <label className="campo">
        <span>{sistema === 'fija' ? 'Capital total' : 'Capital'} {sistema === 'fija' && <em>(opcional)</em>}</span>
        <input name="capital" inputMode="decimal" value={v.capital} onChange={cambiar('capital')} required={sistema !== 'fija'} placeholder="0" />
      </label>
      <label className="campo">
        <span>Moneda</span>
        <select name="moneda" defaultValue="ARS">
          <option value="ARS">Pesos</option>
          <option value="USD">Dólares</option>
        </select>
      </label>
      {conTasa && (
        <label className="campo">
          <span>Tasa nominal anual (TNA %)</span>
          <input name="tasa" inputMode="decimal" value={v.tasa} onChange={cambiar('tasa')} required={sistema !== 'unica'} placeholder="Ej.: 45" />
        </label>
      )}
      {sistema === 'fija' && (
        <label className="campo">
          <span>Valor de cada cuota</span>
          <input name="cuota_fija" inputMode="decimal" value={v.cuotaFija} onChange={cambiar('cuotaFija')} required />
        </label>
      )}
      {sistema !== 'unica' && (
        <label className="campo">
          <span>Cantidad de cuotas</span>
          <input name="cuotas" inputMode="numeric" value={v.cuotas} onChange={cambiar('cuotas')} required />
        </label>
      )}
      <label className="campo">
        <span>{sistema === 'unica' ? 'Fecha de pago' : 'Vence la primera cuota'}</span>
        <input type="date" name="primera" value={v.primera} onChange={cambiar('primera')} required />
      </label>
      <label className="campo">
        <span>Seguro o gastos por cuota <em>(opcional)</em></span>
        <input name="otros" inputMode="decimal" value={v.otros} onChange={cambiar('otros')} placeholder="0" />
      </label>
      <label className="campo">
        <span>Intereses y gastos van a</span>
        <select name="rubro_id" defaultValue={rubroDefecto ?? ''}>
          <option value="">No cargarlos en Gastos</option>
          {rubros.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
      </label>
      {sistema !== 'fija' && (
        <label className="casilla" style={{ alignSelf: 'end', paddingBottom: 10 }}>
          <input type="checkbox" name="iva_intereses" checked={iva} onChange={(x) => setIva(x.target.checked)} /> Sumar IVA sobre los intereses (21 %)
        </label>
      )}
      <label className="campo ancho">
        <span>Notas</span>
        <input name="notas" />
      </label>
      {plan.length > 0 && (
        <div className="ancho resumen-calc" role="status">
          <span>{plan.length} {plan.length === 1 ? 'pago' : 'cuotas'}</span>
          <span>Primera <b>{pesos(plan[0].total)}</b></span>
          {plan.length > 1 && <span>Última <b>{pesos(plan[plan.length - 1].total)}</b> el {fecha(plan[plan.length - 1].vencimiento)}</span>}
          <span>Total a pagar <b>{pesos(total)}</b></span>
          <span>Intereses, IVA y gastos <b>{pesos(intereses)}</b></span>
        </div>
      )}
      <p className="sub ancho" style={{ margin: 0 }}>Después podés corregir cada cuota para que quede igual al cronograma del banco.</p>
    </FormAccion>
  );
}
