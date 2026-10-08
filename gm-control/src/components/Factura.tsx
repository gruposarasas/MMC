'use client';
import { useRef, useState } from 'react';
import { CamposImportes } from '@/components/CamposImportes';
import { aNumero, aTexto, pesos, redondear } from '@/lib/formato';

export type ItemForm = { descripcion: string; cantidad: number; unidad: string; precio: number; alicuota: number };
export type Sugerencia = { nombre: string; unidad: string; precio: number; moneda: 'ARS' | 'USD'; insumo: boolean };
type Fila = { k: number; descripcion: string; cantidad: string; unidad: string; precio: string; alicuota: string };

const ALICUOTAS = ['21', '10.5', '27', '0'];
const etiquetaAlic = (a: string) => (a === '0' ? 'Sin IVA' : `${a.replace('.', ',')} %`);
let sec = 0;
const filaVacia = (alicuota: number): Fila => ({ k: ++sec, descripcion: '', cantidad: '1', unidad: '', precio: '', alicuota: String(alicuota) });

type Props = {
  modo: 'items' | 'total';
  items?: ItemForm[];
  sugerencias: Sugerencia[];
  alicuotaDefecto: number;
  neto?: number;
  alicuota?: number;
  iva?: number;
  otros?: number;
  moneda?: 'ARS' | 'USD';
  cotizacion?: number;
  dolar?: number | null;
  totalFactura?: number; // el total que dice la factura leída, para controlar
};

/** Elegir entre cargar los productos de la factura o solo el total. */
export function ImportesEgreso(p: Props) {
  const [modo, setModo] = useState(p.modo);
  return (
    <>
      <div className="ancho modo-carga" role="group" aria-label="Cómo cargar los importes">
        <button type="button" className={modo === 'items' ? 'on' : ''} aria-pressed={modo === 'items'} onClick={() => setModo('items')}>
          Por productos (como la factura)
        </button>
        <button type="button" className={modo === 'total' ? 'on' : ''} aria-pressed={modo === 'total'} onClick={() => setModo('total')}>
          Solo el total
        </button>
      </div>
      <input type="hidden" name="modo" value={modo} />
      {modo === 'items' ? (
        <ItemsFactura {...p} />
      ) : (
        <CamposImportes conMoneda moneda={p.moneda} cotizacion={p.cotizacion} dolar={p.dolar} neto={p.neto} alicuota={p.alicuota ?? p.alicuotaDefecto} iva={p.iva} otros={p.otros} />
      )}
    </>
  );
}

function ItemsFactura(p: Props) {
  const [filas, setFilas] = useState<Fila[]>(() =>
    p.items?.length
      ? p.items.map((i) => ({ k: ++sec, descripcion: i.descripcion, cantidad: aTexto(i.cantidad) || '1', unidad: i.unidad, precio: aTexto(i.precio), alicuota: String(i.alicuota) }))
      : [filaVacia(p.alicuotaDefecto)],
  );
  const [moneda, setMoneda] = useState<'ARS' | 'USD'>(p.moneda ?? 'ARS');
  const [cot, setCot] = useState(aTexto(p.moneda === 'USD' ? p.cotizacion : (p.dolar ?? undefined)));
  const [otros, setOtros] = useState(aTexto(p.otros));
  const [conIva, setConIva] = useState(false);
  const tabla = useRef<HTMLDivElement>(null);
  const sugerencias = new Map(p.sugerencias.map((s) => [s.nombre.toLowerCase(), s]));

  const num = (s: string) => aNumero(s) ?? 0;
  const calc = filas.map((f) => {
    const a = Number(f.alicuota) || 0;
    const precioSin = conIva ? num(f.precio) / (1 + a / 100) : num(f.precio);
    const neto = redondear(num(f.cantidad) * precioSin);
    return { f, a, precioSin, neto, iva: redondear((neto * a) / 100) };
  });
  const neto = redondear(calc.reduce((s, c) => s + c.neto, 0));
  const porAlic = new Map<number, number>();
  for (const c of calc) if (c.iva) porAlic.set(c.a, redondear((porAlic.get(c.a) ?? 0) + c.iva));
  const iva = redondear([...porAlic.values()].reduce((s, x) => s + x, 0));
  const total = redondear(neto + iva + num(otros));
  const items = calc
    .filter((c) => c.f.descripcion.trim())
    .map((c) => ({ descripcion: c.f.descripcion.trim(), cantidad: num(c.f.cantidad), unidad: c.f.unidad.trim(), precio: redondear(c.precioSin, 4), alicuota: c.a }));
  const vinculaInsumo = items.some((i) => sugerencias.get(i.descripcion.toLowerCase())?.insumo);

  const cambiar = (k: number, campo: keyof Fila, valor: string) =>
    setFilas((fs) =>
      fs.map((f) => {
        if (f.k !== k) return f;
        const n = { ...f, [campo]: valor };
        if (campo === 'descripcion') {
          const s = sugerencias.get(valor.trim().toLowerCase());
          if (s) {
            if (!n.unidad) n.unidad = s.unidad;
            if (!n.precio && s.moneda === moneda && s.precio) n.precio = aTexto(s.precio);
          }
        }
        return n;
      }),
    );
  const enfocar = (i: number) => requestAnimationFrame(() => tabla.current?.querySelectorAll<HTMLInputElement>('input[data-desc]')[i]?.focus());
  const agregar = () => {
    setFilas((fs) => [...fs, filaVacia(Number(fs[fs.length - 1]?.alicuota ?? p.alicuotaDefecto))]);
    enfocar(filas.length);
  };
  const tecla = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'Enter') return;
    e.preventDefault(); // Enter pasa al renglón siguiente en vez de guardar
    if (i === filas.length - 1) agregar();
    else enfocar(i + 1);
  };

  return (
    <>
      <label className="campo">
        <span>Moneda</span>
        <select name="moneda" value={moneda} onChange={(e) => setMoneda(e.target.value as 'ARS' | 'USD')}>
          <option value="ARS">Pesos</option>
          <option value="USD">Dólares</option>
        </select>
      </label>
      {moneda === 'USD' ? (
        <label className="campo">
          <span>Cotización del dólar</span>
          <input name="cotizacion" inputMode="decimal" value={cot} onChange={(e) => setCot(e.target.value)} required />
        </label>
      ) : (
        <input type="hidden" name="cotizacion" value="1" />
      )}

      <div className="ancho factura" ref={tabla}>
        <div className="factura-cab" aria-hidden>
          <span>Producto</span>
          <span>Cant.</span>
          <span>Unidad</span>
          <span>{conIva ? 'Precio con IVA' : 'Precio unit. sin IVA'}</span>
          <span>IVA</span>
          <span className="der">Subtotal</span>
          <span />
        </div>
        {calc.map(({ f, neto: sub }, i) => (
          <div className="factura-fila" key={f.k}>
            <input data-desc aria-label={`Producto ${i + 1}`} list="sug-items" placeholder="Producto o detalle" value={f.descripcion} onChange={(e) => cambiar(f.k, 'descripcion', e.target.value)} onKeyDown={(e) => tecla(e, i)} />
            <input aria-label="Cantidad" inputMode="decimal" value={f.cantidad} onChange={(e) => cambiar(f.k, 'cantidad', e.target.value)} onKeyDown={(e) => tecla(e, i)} />
            <input aria-label="Unidad" list="sug-unidades" placeholder="kg, u…" value={f.unidad} onChange={(e) => cambiar(f.k, 'unidad', e.target.value)} onKeyDown={(e) => tecla(e, i)} />
            <input aria-label="Precio unitario" inputMode="decimal" placeholder="0" value={f.precio} onChange={(e) => cambiar(f.k, 'precio', e.target.value)} onKeyDown={(e) => tecla(e, i)} />
            <select aria-label="IVA" value={f.alicuota} onChange={(e) => cambiar(f.k, 'alicuota', e.target.value)}>
              {ALICUOTAS.map((a) => <option key={a} value={a}>{etiquetaAlic(a)}</option>)}
            </select>
            <span className="sub num">{pesos(sub)}</span>
            <button type="button" className="ico mal" aria-label={`Quitar renglón ${i + 1}`} onClick={() => setFilas((fs) => (fs.length > 1 ? fs.filter((x) => x.k !== f.k) : [filaVacia(p.alicuotaDefecto)]))}>×</button>
          </div>
        ))}
        <datalist id="sug-items">{p.sugerencias.map((s) => <option key={s.nombre} value={s.nombre} />)}</datalist>
        <datalist id="sug-unidades">{['kg', 'g', 'u', 'l', 'bolsas', 'cajas', 'horas'].map((u) => <option key={u} value={u} />)}</datalist>
        <div className="factura-pie">
          <button type="button" className="btn claro chico" onClick={agregar}>+ Agregar producto</button>
          <label className="casilla" style={{ fontSize: 13 }}>
            <input type="checkbox" checked={conIva} onChange={(e) => setConIva(e.target.checked)} /> Los precios ya incluyen IVA
          </label>
        </div>
      </div>
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <label className="campo">
        <span>Percepciones / otros impuestos</span>
        <input name="otros" inputMode="decimal" value={otros} onChange={(e) => setOtros(e.target.value)} placeholder="0" />
      </label>
      {vinculaInsumo && (
        <label className="casilla" style={{ alignSelf: 'end', paddingBottom: 10 }}>
          <input type="checkbox" name="actualizar_costos" defaultChecked /> Actualizar el costo de los insumos de Costos con estos precios
        </label>
      )}
      <div className="resumen-calc">
        <span>{items.length} {items.length === 1 ? 'producto' : 'productos'}</span>
        <span>Neto <b>{pesos(neto)}</b></span>
        {[...porAlic.entries()].map(([a, v]) => (
          <span key={a}>IVA {String(a).replace('.', ',')} % <b>{pesos(v)}</b></span>
        ))}
        {num(otros) !== 0 && <span>Otros <b>{pesos(num(otros))}</b></span>}
        <span>Total <b>{moneda === 'USD' ? `US$ ${aTexto(total) || 0}` : pesos(total)}</b></span>
        {moneda === 'USD' && <span>En pesos <b>{num(cot) ? pesos(total * num(cot)) : 'falta la cotización'}</b></span>}
      </div>
      {p.totalFactura != null && (
        <ControlTotal total={total} factura={p.totalFactura} usd={moneda === 'USD'} />
      )}
    </>
  );
}

/** Compara lo cargado con el total impreso en la factura leída. */
function ControlTotal({ total, factura, usd }: { total: number; factura: number; usd: boolean }) {
  const fmt = (n: number) => (usd ? `US$ ${aTexto(redondear(n)) || 0}` : pesos(n));
  const dif = redondear(total - factura);
  const ok = Math.abs(dif) <= (usd ? 0.05 : 1);
  return (
    <div className={`ancho aviso ${ok ? 'ok' : 'mal'}`} role="status" style={{ margin: 0 }}>
      {ok
        ? `El total coincide con la factura (${fmt(factura)}).`
        : `La factura dice ${fmt(factura)} y lo cargado da ${fmt(total)} (diferencia ${fmt(dif)}). Revisá precios, IVA o percepciones.`}
    </div>
  );
}
