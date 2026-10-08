'use client';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { importarEgresos, importarInsumos, importarProductos, importarProveedores, type Resultado } from '@/acciones/importar';
import { dolares, fecha, numero, pesos } from '@/lib/formato';
import {
  adivinarCon, convertirEgresos, convertirInsumos, convertirProductos, convertirProveedores, ESQUEMAS, filaTitulosCon, planillaModelo, totalesComprobante, type TipoImportacion,
} from '@/lib/esquemas';
import type { Celda } from '@/lib/importar';
import { leerArchivo } from '@/lib/leerArchivo';
import { formatoCuit } from '@/lib/proveedores';

const NOMBRES: Record<TipoImportacion, string> = { compra: 'compras', gasto: 'gastos', producto: 'productos', insumo: 'insumos', proveedor: 'proveedores' };

export function Importador({ tipo, rubros = [], dolar = null, destino }: { tipo: TipoImportacion; rubros?: { id: number; nombre: string }[]; dolar?: number | null; destino: string }) {
  const router = useRouter();
  const esquema = ESQUEMAS[tipo];
  const esEgreso = tipo === 'compra' || tipo === 'gasto';
  const [archivo, setArchivo] = useState('');
  const [filas, setFilas] = useState<Celda[][] | null>(null);
  const [titulos, setTitulos] = useState(0);
  const [mapa, setMapa] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState<Resultado | null>(null);
  const [rubro, setRubro] = useState(rubros[0]?.id ?? 0);
  const [pagado, setPagado] = useState(true);
  const [alicuota, setAlicuota] = useState(21);
  const [actualizarCostos, setActualizarCostos] = useState(true);

  async function elegir(f: File | undefined) {
    setError('');
    setHecho(null);
    setFilas(null);
    if (!f) return;
    setArchivo(f.name);
    setLeyendo(true);
    try {
      const datos = await leerArchivo(f, (d) => filaTitulosCon(esquema, d) >= 0);
      if (!datos.length) throw new Error('El archivo está vacío.');
      const t = Math.max(filaTitulosCon(esquema, datos), 0);
      setFilas(datos);
      setTitulos(t);
      setMapa((datos[t] || []).map((x) => adivinarCon(esquema, x)));
    } catch (e) {
      setError(e instanceof Error && e.message.includes('.xls') ? e.message : 'No pudimos leer el archivo. Tiene que ser un Excel (.xlsx) o un .csv.');
    } finally {
      setLeyendo(false);
    }
  }

  const res = useMemo(() => {
    if (!filas) return null;
    if (esEgreso) return { tipo: 'egreso' as const, ...convertirEgresos(filas, titulos, mapa, { alicuota, dolar }) };
    if (tipo === 'producto') return { tipo: 'producto' as const, ...convertirProductos(filas, titulos, mapa), salteadas: [] };
    if (tipo === 'proveedor') return { tipo: 'proveedor' as const, ...convertirProveedores(filas, titulos, mapa), salteadas: [] };
    return { tipo: 'insumo' as const, ...convertirInsumos(filas, titulos, mapa), salteadas: [] };
  }, [filas, titulos, mapa, alicuota, dolar, esEgreso, tipo]);

  const falta = filas ? esquema.requiere.some((r) => r.every((c) => mapa.includes(c))) ? '' : `Elegí qué columna es ${esquema.requiere.map((r) => r.map((c) => esquema.campos.find((x) => x.id === c)?.nombre.toLowerCase()).join(' y ')).join(', o ')}.` : '';
  const cantidad = !res ? 0 : res.tipo === 'egreso' ? res.comprobantes.length : res.filas.length;

  async function importar() {
    if (!res || !cantidad) return;
    setEnviando(true);
    setError('');
    try {
      let r: Resultado;
      if (res.tipo === 'egreso') r = await importarEgresos({ tipo: tipo as 'compra' | 'gasto', archivo, rubroDefecto: rubro, pagado, actualizarCostos, comprobantes: res.comprobantes });
      else if (res.tipo === 'producto') r = await importarProductos({ archivo, filas: res.filas });
      else if (res.tipo === 'proveedor') r = await importarProveedores({ archivo, filas: res.filas });
      else r = await importarInsumos({ archivo, filas: res.filas });
      if (r.error) setError(r.error);
      else {
        setHecho(r);
        setFilas(null);
        router.refresh();
      }
    } catch {
      setError('No se pudo importar. Revisá la conexión y probá de nuevo.');
    } finally {
      setEnviando(false);
    }
  }

  function bajarModelo() {
    const url = URL.createObjectURL(new Blob([planillaModelo(esquema)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `planilla-${NOMBRES[tipo]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (hecho) {
    return (
      <div>
        <div className="aviso ok">
          Listo: {numero(hecho.nuevos)} {hecho.nuevos === 1 ? 'nuevo' : 'nuevos'} y {numero(hecho.actualizados)} {hecho.actualizados === 1 ? 'actualizado' : 'actualizados'}.
          {hecho.detalle ? ` (${hecho.detalle}.)` : ''}
        </div>
        <div className="acciones">
          <a className="btn" href={esEgreso && hecho.hasta ? `${destino}?p=${hecho.hasta.slice(0, 7)}` : destino}>Ver {NOMBRES[tipo]}</a>
          <button className="btn claro" onClick={() => setHecho(null)}>Importar otro archivo</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="sub" style={{ marginTop: -6 }}>{esquema.ayuda} Si un {esEgreso ? 'comprobante' : tipo} ya estaba cargado, se actualiza en vez de duplicarse{esEgreso ? ' (para eso tiene que tener número)' : ''}.</p>
      <div className="acciones" style={{ marginBottom: 12 }}>
        <button type="button" className="btn claro chico" onClick={bajarModelo}>Bajar planilla modelo</button>
        <span className="sub" style={{ margin: 0 }}>Completala en Excel y subila, o subí la que ya tengas.</span>
      </div>
      <label className="campo">
        <span>Archivo (.xlsx o .csv)</span>
        <input type="file" accept=".xlsx,.csv,.xls,.txt" onChange={(e) => elegir(e.target.files?.[0])} />
      </label>
      {leyendo && <p className="sub">Leyendo…</p>}
      {error && <div className="aviso mal" style={{ marginTop: 12 }}>{error}</div>}

      {filas && res && (
        <>
          <div className="caja" style={{ marginTop: 16 }}>
            <div className="caja-cab">
              <div>
                <h2>Columnas</h2>
                <p className="sub" style={{ margin: 0 }}>Las reconocimos solas; corregí las que hagan falta.</p>
              </div>
              <label className="campo" style={{ width: 170 }}>
                <span>Fila de títulos</span>
                <select value={titulos} onChange={(e) => { const t = Number(e.target.value); setTitulos(t); setMapa((filas[t] || []).map((x) => adivinarCon(esquema, x))); }}>
                  {filas.slice(0, 20).map((_, i) => <option key={i} value={i}>Fila {i + 1}</option>)}
                </select>
              </label>
            </div>
            <div className="tabla-env">
              <table className="t">
                <thead><tr><th>Columna del Excel</th><th>Ejemplo</th><th>Es…</th></tr></thead>
                <tbody>
                  {(filas[titulos] || []).map((t, i) => {
                    const ej = filas.slice(titulos + 1, titulos + 6).map((f) => f[i]).find((c) => c != null && c !== '');
                    return (
                      <tr key={i}>
                        <td className="principal">{String(t ?? `Columna ${i + 1}`)}</td>
                        <td className="chico corta">{ej instanceof Date ? fecha(ej.toISOString().slice(0, 10)) : String(ej ?? '')}</td>
                        <td>
                          <select
                            value={mapa[i] ?? 'ignorar'}
                            onChange={(e) => setMapa((m) => { const c = [...m]; c[i] = e.target.value; return c; })}
                            aria-label={`Qué es la columna ${String(t ?? i + 1)}`}
                            style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--linea)', background: '#fff' }}
                          >
                            <option value="ignorar">— No usar —</option>
                            {esquema.campos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {esEgreso && (
            <div className="form" style={{ marginBottom: 14 }}>
              <label className="campo">
                <span>Rubro si la fila no trae uno</span>
                <select value={rubro} onChange={(e) => setRubro(Number(e.target.value))}>
                  {rubros.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </label>
              <label className="campo">
                <span>IVA si la fila no lo dice</span>
                <select value={alicuota} onChange={(e) => setAlicuota(Number(e.target.value))}>
                  {[21, 10.5, 27, 0].map((a) => <option key={a} value={a}>{a ? `${String(a).replace('.', ',')} %` : 'Sin IVA'}</option>)}
                </select>
              </label>
              <label className="casilla"><input type="checkbox" checked={pagado} onChange={(e) => setPagado(e.target.checked)} /> Marcar como pagados (si el Excel no lo dice)</label>
              {tipo === 'compra' && (
                <label className="casilla"><input type="checkbox" checked={actualizarCostos} onChange={(e) => setActualizarCostos(e.target.checked)} /> Actualizar el costo de los insumos que se llamen igual</label>
              )}
            </div>
          )}

          {falta ? (
            <div className="aviso">{falta}</div>
          ) : (
            <>
              {(res.errores.length > 0 || res.salteadas.length > 0) && (
                <details className="aviso" style={{ cursor: 'pointer' }}>
                  <summary>
                    {res.errores.length > 0 && `${res.errores.length} filas con problemas (no se importan). `}
                    {res.salteadas.length > 0 && `${res.salteadas.length} filas salteadas (anuladas o sin fecha).`}
                  </summary>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                    {[...res.errores, ...res.salteadas].slice(0, 30).map((e) => <li key={e.fila}>Fila {e.fila}: {e.motivo}</li>)}
                  </ul>
                </details>
              )}
              {res.tipo === 'egreso' && <VistaEgresos comprobantes={res.comprobantes} />}
              {res.tipo === 'producto' && (
                <Vista
                  titulos={['Producto', 'Presentación', 'Precio sin IVA', 'IVA']}
                  filas={res.filas.map((p) => [p.nombre, p.presentacion, p.precio != null ? pesos(p.precio) : '—', `${p.iva} %`])}
                />
              )}
              {res.tipo === 'proveedor' && (
                <Vista
                  titulos={['Proveedor', 'Rubro', 'Contacto', 'CUIT']}
                  filas={res.filas.map((p) => [p.nombre, p.rubro, [p.contacto, p.telefono, p.email].filter(Boolean).join(' · '), formatoCuit(p.cuit) || '—'])}
                />
              )}
              {res.tipo === 'insumo' && (
                <Vista
                  titulos={['Insumo', 'Categoría', 'Unidad', 'Costo']}
                  filas={res.filas.map((p) => [p.nombre, p.categoria, p.unidad, p.moneda === 'USD' ? dolares(p.costo) : pesos(p.costo)])}
                />
              )}
              <div className="form-pie" style={{ marginTop: 16 }}>
                <button className="btn vino" onClick={importar} disabled={enviando || !cantidad}>
                  {enviando ? 'Importando…' : `Importar ${numero(cantidad)} ${res.tipo === 'egreso' ? (cantidad === 1 ? 'comprobante' : 'comprobantes') : NOMBRES[tipo]}`}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function VistaEgresos({ comprobantes }: { comprobantes: ReturnType<typeof convertirEgresos>['comprobantes'] }) {
  let total = 0;
  let items = 0;
  for (const c of comprobantes) {
    total += totalesComprobante(c).total * c.cotizacion;
    items += c.items.length;
  }
  const fechas = comprobantes.map((c) => c.fecha).sort();
  return (
    <>
      <div className="tiles">
        <div className="tile"><div className="t">Comprobantes</div><div className="v">{numero(comprobantes.length)}</div><div className="s">{fechas.length ? `${fecha(fechas[0])} al ${fecha(fechas[fechas.length - 1])}` : ''}</div></div>
        <div className="tile"><div className="t">Productos</div><div className="v">{numero(items)}</div><div className="s">renglones de factura</div></div>
        <div className="tile"><div className="t">Total con IVA</div><div className="v">{pesos(total, 0)}</div><div className="s">en pesos</div></div>
      </div>
      <Vista
        titulos={['Fecha', 'Proveedor', 'Comprobante', 'Detalle', 'Total']}
        filas={comprobantes.map((c) => {
          const t = totalesComprobante(c);
          return [
            fecha(c.fecha),
            c.proveedor || '—',
            [c.comprobante, c.numero].filter(Boolean).join(' '),
            c.items.length ? `${c.items[0].descripcion}${c.items.length > 1 ? ` y ${c.items.length - 1} más` : ''}` : c.rubro || '—',
            c.moneda === 'USD' ? dolares(t.total) : pesos(t.total),
          ];
        })}
      />
    </>
  );
}

function Vista({ titulos, filas }: { titulos: string[]; filas: string[][] }) {
  return (
    <>
      <div className="tabla-env">
        <table className="t">
          <thead><tr>{titulos.map((t, i) => <th key={t} className={i === titulos.length - 1 ? 'der' : ''}>{t}</th>)}</tr></thead>
          <tbody>
            {filas.slice(0, 10).map((f, i) => (
              <tr key={i}>{f.map((c, j) => <td key={j} className={j === f.length - 1 ? 'der num' : j === 0 ? 'principal' : 'chico'}>{c}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
      {filas.length > 10 && <p className="mas">… y {numero(filas.length - 10)} más.</p>}
    </>
  );
}
