'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { importarVentas, type ResultadoImportacion } from '@/acciones/ventas';
import { fecha, numero, pesos } from '@/lib/formato';
import { adivinar, CAMPOS, type Campo, type Celda, convertir, filaTitulos, leerCsv } from '@/lib/importar';

export function ImportarVentas() {
  const router = useRouter();
  const [archivo, setArchivo] = useState('');
  const [filas, setFilas] = useState<Celda[][] | null>(null);
  const [titulos, setTitulos] = useState(0);
  const [mapa, setMapa] = useState<Campo[]>([]);
  const [error, setError] = useState('');
  const [leyendo, setLeyendo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState<ResultadoImportacion | null>(null);

  async function elegir(f: File | undefined) {
    setError('');
    setHecho(null);
    setFilas(null);
    if (!f) return;
    setArchivo(f.name);
    const nombre = f.name.toLowerCase();
    if (nombre.endsWith('.xls')) {
      setError('Ese archivo es .xls (Excel viejo). Abrilo y guardalo como .xlsx, o exportalo de nuevo desde Contabilium en formato .xlsx o .csv.');
      return;
    }
    setLeyendo(true);
    try {
      let datos: Celda[][];
      if (nombre.endsWith('.csv') || nombre.endsWith('.txt')) {
        datos = leerCsv(await f.text());
      } else {
        const { default: leerXlsx } = await import('read-excel-file/web-worker');
        const hojas = await leerXlsx(f);
        const hoja = hojas.find((h) => filaTitulos(h.data as Celda[][]) >= 0) ?? hojas[0];
        datos = (hoja?.data ?? []) as Celda[][];
      }
      if (!datos.length) throw new Error('vacío');
      let t = filaTitulos(datos);
      if (t < 0) t = 0;
      setFilas(datos);
      setTitulos(t);
      setMapa((datos[t] || []).map(adivinar));
    } catch {
      setError('No pudimos leer el archivo. Tiene que ser un Excel (.xlsx) o un .csv.');
    } finally {
      setLeyendo(false);
    }
  }

  function cambiarTitulos(t: number) {
    if (!filas) return;
    setTitulos(t);
    setMapa((filas[t] || []).map(adivinar));
  }

  const res = useMemo(() => (filas ? convertir(filas, titulos, mapa) : null), [filas, titulos, mapa]);
  const tot = useMemo(() => {
    if (!res) return null;
    const t = { neto: 0, iva: 0, total: 0, nc: 0, desde: '', hasta: '' };
    for (const f of res.filas) {
      t.neto += f.neto;
      t.iva += f.iva;
      t.total += f.total;
      if (f.total < 0) t.nc++;
      if (!t.desde || f.fecha < t.desde) t.desde = f.fecha;
      if (!t.hasta || f.fecha > t.hasta) t.hasta = f.fecha;
    }
    return t;
  }, [res]);

  const falta = mapa.includes('fecha') ? (mapa.includes('total') || mapa.includes('neto') ? '' : 'Elegí qué columna es el total (o el neto).') : 'Elegí qué columna es la fecha.';

  async function importar() {
    if (!res || !res.filas.length) return;
    setEnviando(true);
    setError('');
    try {
      const r = await importarVentas({ archivo, filas: res.filas });
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

  if (hecho) {
    const mes = hecho.hasta?.slice(0, 7);
    return (
      <div>
        <div className="aviso ok">
          Listo: {numero(hecho.comprobantes)} comprobantes importados ({numero(hecho.nuevas)} nuevos y {numero(hecho.actualizadas)} actualizados
          {hecho.filas !== hecho.comprobantes ? `; el archivo tenía ${numero(hecho.filas)} filas y se agruparon por comprobante` : ''}).
        </div>
        <div className="acciones">
          <Link className="btn" href={`/ventas?p=${mes}`}>Ver las ventas</Link>
          <button className="btn claro" onClick={() => setHecho(null)}>Importar otro archivo</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ol style={{ margin: '0 0 14px', paddingLeft: 20, color: 'var(--tinta2)', fontSize: 14 }}>
        <li>En Contabilium, entrá a Ventas → Comprobantes, filtrá el mes y exportá a Excel.</li>
        <li>Subí el archivo acá. Si un comprobante ya estaba cargado, se actualiza (no se duplica).</li>
        <li>Revisá que cada columna esté bien asignada y tocá Importar.</li>
      </ol>
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
                <select value={titulos} onChange={(e) => cambiarTitulos(Number(e.target.value))}>
                  {filas.slice(0, 20).map((_, i) => (
                    <option key={i} value={i}>Fila {i + 1}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="tabla-env">
              <table className="t">
                <thead>
                  <tr><th>Columna del Excel</th><th>Ejemplo</th><th>Es…</th></tr>
                </thead>
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
                            onChange={(e) => setMapa((m) => { const c = [...m]; c[i] = e.target.value as Campo; return c; })}
                            aria-label={`Qué es la columna ${String(t ?? i + 1)}`}
                            style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid var(--linea)', background: '#fff' }}
                          >
                            {CAMPOS.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {falta ? (
            <div className="aviso">{falta}</div>
          ) : (
            <>
              <div className="tiles">
                <div className="tile"><div className="t">Ventas</div><div className="v">{numero(res.filas.length)}</div><div className="s">{tot?.desde && `${fecha(tot.desde)} al ${fecha(tot.hasta)}`}</div></div>
                <div className="tile"><div className="t">Total con IVA</div><div className="v">{pesos(tot?.total, 0)}</div><div className="s">{tot?.nc ? `${tot.nc} ${tot.nc === 1 ? 'nota' : 'notas'} de crédito (en negativo)` : ' '}</div></div>
                <div className="tile"><div className="t">Neto sin IVA</div><div className="v">{pesos(tot?.neto, 0)}</div><div className="s">IVA {pesos(tot?.iva, 0)}</div></div>
              </div>
              {(res.errores.length > 0 || res.salteadas.length > 0) && (
                <details className="aviso" style={{ cursor: 'pointer' }}>
                  <summary>
                    {res.errores.length > 0 && `${res.errores.length} filas con problemas. `}
                    {res.salteadas.length > 0 && `${res.salteadas.length} filas salteadas (anuladas, vacías o de totales).`}
                  </summary>
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18 }}>
                    {[...res.errores, ...res.salteadas].slice(0, 30).map((e) => <li key={e.fila}>Fila {e.fila}: {e.motivo}</li>)}
                  </ul>
                </details>
              )}
              <div className="tabla-env">
                <table className="t">
                  <thead>
                    <tr><th>Fecha</th><th>Comprobante</th><th>Cliente</th><th className="der">Neto</th><th className="der">IVA</th><th className="der">Total</th></tr>
                  </thead>
                  <tbody>
                    {res.filas.slice(0, 8).map((f) => (
                      <tr key={f.fila}>
                        <td className="num">{fecha(f.fecha)}</td>
                        <td>{f.comprobante} <span className="chico num">{f.numero}</span></td>
                        <td className="corta">{f.cliente}</td>
                        <td className={`der num${f.neto < 0 ? ' neg' : ''}`}>{pesos(f.neto)}</td>
                        <td className={`der num${f.iva < 0 ? ' neg' : ''}`}>{pesos(f.iva)}</td>
                        <td className={`der num${f.total < 0 ? ' neg' : ''}`}>{pesos(f.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {res.filas.length > 8 && <p className="mas">… y {numero(res.filas.length - 8)} más.</p>}
              <div className="form-pie" style={{ marginTop: 16 }}>
                <button className="btn vino" onClick={importar} disabled={enviando || !res.filas.length}>
                  {enviando ? 'Importando…' : `Importar ${numero(res.filas.length)} ventas`}
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
