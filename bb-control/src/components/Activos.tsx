'use client';
import { useState } from 'react';
import { guardarActivo, guardarImportacionActivos } from '@/acciones/activos';
import { FormAccion } from '@/components/FormAccion';
import {
  CATEGORIAS_ACTIVO, costoActivo, ESTADOS_ACTIVO, GASTOS_IMPORTACION, type GastoImportacion, gastosImportacion, type Importacion, type Moneda, SINGULAR,
} from '@/lib/activos';
import { aNumero, aTexto, dolares, pesos } from '@/lib/formato';

export type ActivoForm = {
  id: number; categoria: keyof typeof CATEGORIAS_ACTIVO; numero: string; descripcion: string; marca: string; modelo: string; estado: keyof typeof ESTADOS_ACTIVO;
  cliente: string; ubicacion: string; instalada: string | null; importacion_id: number | null; moneda: Moneda; costo_mercaderia: number | null;
  costo_otros: number; valor_estimado: number | null; alta: string | null; notas: string;
};

const num = (s: string) => (s.trim() ? aNumero(s) : null);
const fmt = (n: number, m: Moneda) => (m === 'USD' ? dolares(n) : pesos(n));

/** Alta o edición de un activo, con su costo calculado en vivo. */
export function FormActivo({ a, importaciones, clientes, dolar, volver, categoriaInicial }: {
  a: ActivoForm | null; importaciones: Importacion[]; clientes: string[]; dolar: number | null; volver: string; categoriaInicial: string;
}) {
  const [estado, setEstado] = useState<string>(a?.estado ?? 'cliente');
  const [imp, setImp] = useState<number>(a?.importacion_id ?? 0);
  const [moneda, setMoneda] = useState<Moneda>(a?.moneda ?? 'USD');
  const [merc, setMerc] = useState(aTexto(a?.costo_mercaderia));
  const [otros, setOtros] = useState(aTexto(a?.costo_otros));
  const lote = importaciones.find((l) => l.id === imp) ?? null;
  const mon = lote?.moneda ?? moneda;
  const c = costoActivo({ moneda: mon, costo_mercaderia: num(merc), costo_otros: num(otros) ?? 0, importacion_id: imp || null }, lote, dolar);
  const g = lote ? gastosImportacion(lote) : null;

  return (
    <FormAccion accion={guardarActivo}>
      <input type="hidden" name="volver" value={volver} />
      {a && <input type="hidden" name="id" value={a.id} />}
      <label className="campo">
        <span>Tipo</span>
        <select name="categoria" defaultValue={a?.categoria ?? (Object.hasOwn(SINGULAR, categoriaInicial) ? categoriaInicial : 'maquina')}>
          {Object.entries(SINGULAR).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
      </label>
      <label className="campo">
        <span>N° de serie o patente</span>
        <input name="numero" defaultValue={a?.numero} autoComplete="off" />
      </label>
      <label className="campo ancho">
        <span>Descripción</span>
        <input name="descripcion" defaultValue={a?.descripcion} required placeholder="Ej.: Máquina espresso 2 grupos" />
      </label>
      <label className="campo"><span>Marca</span><input name="marca" defaultValue={a?.marca} list="marcas-activos" /></label>
      <label className="campo"><span>Modelo</span><input name="modelo" defaultValue={a?.modelo} /></label>
      <datalist id="marcas-activos">{['La Marzocco', 'Rocket', 'Nuova Simonelli', 'Victoria Arduino', 'Mazzer', 'Mahlkönig', 'Eureka', 'Probat', 'Giesen'].map((m) => <option key={m} value={m} />)}</datalist>
      <label className="campo">
        <span>Dónde está</span>
        <select name="estado" value={estado} onChange={(x) => setEstado(x.target.value)}>
          {Object.entries(ESTADOS_ACTIVO).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
        </select>
      </label>
      <label className="campo">
        <span>Cliente {estado !== 'cliente' && <em>(opcional)</em>}</span>
        <input name="cliente" defaultValue={a?.cliente} list="clientes-activos" required={estado === 'cliente'} autoComplete="off" />
        <datalist id="clientes-activos">{clientes.map((x) => <option key={x} value={x} />)}</datalist>
      </label>
      <label className="campo"><span>Dirección <em>(opcional)</em></span><input name="ubicacion" defaultValue={a?.ubicacion} /></label>
      <label className="campo"><span>Instalada el <em>(opcional)</em></span><input type="date" name="instalada" defaultValue={a?.instalada ?? ''} /></label>

      <fieldset className="ancho costo-activo">
        <legend>Costo</legend>
        <label className="campo">
          <span>Importación</span>
          <select name="importacion_id" value={imp} onChange={(x) => setImp(Number(x.target.value))}>
            <option value={0}>Sin importación (compra local)</option>
            {importaciones.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
          </select>
        </label>
        {lote ? (
          <input type="hidden" name="moneda" value={lote.moneda} />
        ) : (
          <label className="campo">
            <span>Moneda</span>
            <select name="moneda" value={moneda} onChange={(x) => setMoneda(x.target.value as Moneda)}>
              <option value="USD">Dólares</option>
              <option value="ARS">Pesos</option>
            </select>
          </label>
        )}
        <label className="campo">
          <span>Mercadería por unidad ({mon === 'USD' ? 'US$' : '$'})</span>
          <input name="costo_mercaderia" inputMode="decimal" value={merc} onChange={(x) => setMerc(x.target.value)}
            placeholder={g ? `${aTexto(Math.round(g.mercaderiaUnidad * 100) / 100) || 0} (promedio de la importación)` : '0'} />
        </label>
        <label className="campo">
          <span>Otros costos propios <em>(instalación, flete local)</em></span>
          <input name="costo_otros" inputMode="decimal" value={otros} onChange={(x) => setOtros(x.target.value)} placeholder="0" />
        </label>
        <div className="resumen-calc ancho" role="status">
          {c.completo ? (
            <>
              <span>Mercadería <b>{pesos(c.mercaderia)}</b></span>
              {lote && <span>Gastos de importación por unidad <b>{pesos(c.gastos)}</b></span>}
              {c.otros > 0 && <span>Otros <b>{pesos(c.otros)}</b></span>}
              <span>Costo <b>{pesos(c.total)}</b>{c.dolares != null && mon === 'USD' ? ` (${dolares(c.dolares)})` : ''}</span>
            </>
          ) : (
            <span>{mon === 'USD' && !dolar && !lote ? 'Cargá el dólar de referencia (en Costos) para pasar el costo a pesos.' : 'Cargá el costo de la mercadería o elegí la importación.'}</span>
          )}
        </div>
      </fieldset>

      <label className="campo">
        <span>Valor estimado hoy ({mon === 'USD' ? 'US$' : '$'}) <em>(opcional)</em></span>
        <input name="valor_estimado" inputMode="decimal" defaultValue={aTexto(a?.valor_estimado)} placeholder="Lo que vale hoy en el mercado" />
      </label>
      <label className="campo"><span>Fecha de alta <em>(opcional)</em></span><input type="date" name="alta" defaultValue={a?.alta ?? ''} /></label>
      <label className="campo ancho"><span>Notas</span><input name="notas" defaultValue={a?.notas} placeholder="Ej.: comodato hasta 03/2027, service cada 6 meses" /></label>
    </FormAccion>
  );
}

/** Importación de equipos: mercadería y gastos, con el costo por unidad en vivo. */
export function FormImportacion({ l, dolar, volver }: { l: (Importacion & { fecha: string | null; origen: string; notas: string }) | null; dolar: number | null; volver: string }) {
  const [v, setV] = useState<Record<string, string>>(() => ({
    moneda: l?.moneda ?? 'USD', cotizacion: aTexto(l?.cotizacion ?? dolar ?? undefined), mercaderia: aTexto(l?.mercaderia), unidades: String(l?.unidades ?? ''),
    ...Object.fromEntries((Object.keys(GASTOS_IMPORTACION) as GastoImportacion[]).flatMap((k) => [
      [k, aTexto(l?.[k])], [`${k}_moneda`, l?.[`${k}_moneda`] ?? (k === 'transporte' ? 'USD' : 'ARS')],
    ])),
  }));
  const set = (k: string) => (x: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((o) => ({ ...o, [k]: x.target.value }));
  const n = (k: string) => aNumero(v[k] ?? '') ?? 0;
  const borrador = {
    id: 0, nombre: '', moneda: v.moneda as Moneda, cotizacion: v.moneda === 'USD' ? n('cotizacion') || 1 : 1, mercaderia: n('mercaderia'), unidades: Math.max(1, Math.round(n('unidades'))),
    ...Object.fromEntries((Object.keys(GASTOS_IMPORTACION) as GastoImportacion[]).flatMap((k) => [[k, n(k)], [`${k}_moneda`, v[`${k}_moneda`]]])),
  } as Importacion;
  const g = gastosImportacion(borrador);
  const usd = v.moneda === 'USD';

  return (
    <FormAccion accion={guardarImportacionActivos}>
      <input type="hidden" name="volver" value={volver} />
      {l && <input type="hidden" name="id" value={l.id} />}
      <label className="campo ancho"><span>Nombre</span><input name="nombre" defaultValue={l?.nombre} required placeholder="Ej.: Importación La Marzocco marzo 2026" /></label>
      <label className="campo"><span>Fecha <em>(opcional)</em></span><input type="date" name="fecha" defaultValue={l?.fecha ?? ''} /></label>
      <label className="campo"><span>Origen o proveedor <em>(opcional)</em></span><input name="origen" defaultValue={l?.origen} /></label>
      <label className="campo">
        <span>Moneda de la mercadería</span>
        <select name="moneda" value={v.moneda} onChange={set('moneda')}>
          <option value="USD">Dólares</option>
          <option value="ARS">Pesos</option>
        </select>
      </label>
      {usd && <label className="campo"><span>Dólar de la importación</span><input name="cotizacion" inputMode="decimal" value={v.cotizacion} onChange={set('cotizacion')} required /></label>}
      <label className="campo"><span>Mercadería total ({usd ? 'US$' : '$'})</span><input name="mercaderia" inputMode="decimal" value={v.mercaderia} onChange={set('mercaderia')} placeholder="FOB de todo lo importado" /></label>
      <label className="campo"><span>Unidades importadas</span><input name="unidades" inputMode="numeric" value={v.unidades} onChange={set('unidades')} required /></label>
      <fieldset className="ancho costo-activo">
        <legend>Gastos de la importación (se dividen por las unidades)</legend>
        {(Object.keys(GASTOS_IMPORTACION) as GastoImportacion[]).map((k) => (
          <div className="gasto-imp" key={k}>
            <label className="campo"><span>{GASTOS_IMPORTACION[k]}</span><input name={k} inputMode="decimal" value={v[k]} onChange={set(k)} placeholder="0" /></label>
            <label className="campo">
              <span>Moneda</span>
              <select name={`${k}_moneda`} value={v[`${k}_moneda`]} onChange={set(`${k}_moneda`)} aria-label={`Moneda de ${GASTOS_IMPORTACION[k]}`}>
                <option value="ARS">Pesos</option>
                <option value="USD">Dólares</option>
              </select>
            </label>
          </div>
        ))}
        <div className="resumen-calc ancho" role="status">
          <span>Mercadería por unidad <b>{fmt(g.mercaderiaUnidad, v.moneda as Moneda)}</b></span>
          <span>Gastos <b>{pesos(g.total)}</b> ÷ {borrador.unidades} = <b>{pesos(g.porUnidad)}</b> por unidad</span>
          <span>Costo por unidad <b>{pesos(g.costoUnidadPesos)}</b>{usd && borrador.cotizacion > 1 ? ` (${dolares(g.costoUnidadPesos / borrador.cotizacion)})` : ''}</span>
        </div>
      </fieldset>
      <label className="campo ancho"><span>Notas</span><input name="notas" defaultValue={l?.notas} placeholder="Ej.: despacho 26 001 IC04 123456 X" /></label>
    </FormAccion>
  );
}
