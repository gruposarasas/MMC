import { redirect } from 'next/navigation';
import { guardarRazonSocial, quitarAccesoContador } from '@/acciones/contabilidad';
import { AccesoContador } from '@/components/Contabilidad';
import { BotonAccion, FormAccion } from '@/components/FormAccion';
import { TabsContabilidad } from '@/components/TabsContabilidad';
import { Titulo } from '@/components/Titulo';
import { exigirContabilidad } from '@/lib/contabilidad';
import { db } from '@/lib/db';
import { formatoCuit } from '@/lib/proveedores';

export const metadata = { title: 'Accesos · Contabilidad · BB-CONTROL' };

type Contador = { id: number; nombre: string; email: string; activo: boolean; tiene: boolean; ultimo_ingreso: string | null };
type Razon = { id: number; nombre: string; cuit: string; activo: boolean; usos: number };

const cuando = (ts: string | null) =>
  ts ? new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Mendoza', dateStyle: 'short', timeStyle: 'short' }).format(new Date(ts)) : 'Nunca';

// Solo administración: quién entra como contador y las razones sociales.
export default async function Accesos() {
  const q = await exigirContabilidad();
  if (q.rol !== 'admin') redirect('/contabilidad');
  const sql = db();
  const [contadores, razones] = await Promise.all([
    sql<Contador[]>`select id, nombre, email, activo, clave_hash is not null tiene, ultimo_ingreso from contadores order by activo desc, nombre`,
    sql<Razon[]>`select r.*, (select count(*) from contab_obligaciones o where o.razon_id = r.id)::int usos from razones_sociales r order by orden, id`,
  ]);
  return (
    <>
      <div className="cabeza">
        <Titulo modulo="contabilidad" titulo="Accesos">
          El contador entra en <b>/contador</b> con su mail y su clave, y ve solo Contabilidad: carga las obligaciones del mes y sus archivos,
          ve el IVA estimado y las novedades del equipo. No marca pagos ni cambia coberturas.
        </Titulo>
      </div>
      <TabsContabilidad actual="/contabilidad/accesos" admin />

      <div className="grilla2">
        <div className="caja">
          <h2>Contador</h2>
          <p className="sub">Podés darle acceso a cada persona del estudio con su mail. La clave se muestra una sola vez.</p>
          {contadores.length > 0 && (
            <div className="tabla-env" style={{ marginBottom: 16 }}>
              <table className="t">
                <thead><tr><th>Nombre</th><th>Último ingreso</th><th><span className="sr">Acciones</span></th></tr></thead>
                <tbody>
                  {contadores.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="principal">{c.nombre}</span>
                        <div className="chico">{c.email}</div>
                      </td>
                      <td className="chico">{c.activo && c.tiene ? cuando(c.ultimo_ingreso) : <span className="chip">Sin acceso</span>}</td>
                      <td>
                        <div className="iconos">
                          <AccesoContador id={c.id} boton={c.activo && c.tiene ? 'Nueva clave' : 'Dar acceso'} confirmar={c.activo && c.tiene ? 'La clave anterior deja de funcionar. ¿Seguir?' : undefined} />
                          {c.activo && c.tiene && (
                            <BotonAccion accion={quitarAccesoContador} campos={{ id: c.id }} className="ico mal" confirmar={`${c.nombre} no va a poder entrar más. ¿Seguro?`}>
                              Quitar acceso
                            </BotonAccion>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h3 style={{ fontSize: 15, margin: '4px 0 10px' }}>Dar acceso</h3>
          <AccesoContador boton="Generar clave">
            <label className="campo">
              <span>Nombre (o el del estudio)</span>
              <input name="nombre" required placeholder="Ej.: Estudio Pérez" autoComplete="off" />
            </label>
            <label className="campo">
              <span>Mail</span>
              <input name="email" type="email" required placeholder="contador@estudio.com" autoComplete="off" />
            </label>
          </AccesoContador>
        </div>

        <div className="caja">
          <h2>Razones sociales</h2>
          <p className="sub">El contador carga el F.931, el IVA y los Ingresos Brutos de cada una. Si son varias, cada gasto lo dice en el detalle.</p>
          {razones.map((r) => (
            <details key={r.id} className="ob-editar" style={{ borderTop: '1px solid var(--linea2)', padding: '10px 0' }}>
              <summary>
                {r.nombre}
                {r.cuit && <span className="chico" style={{ fontWeight: 400, color: 'var(--tinta2)' }}> · CUIT {formatoCuit(r.cuit)}</span>}
                {!r.activo && <span className="chip" style={{ marginLeft: 8 }}>Inactiva</span>}
              </summary>
              <FormAccion accion={guardarRazonSocial} claseBoton="btn chico">
                <input type="hidden" name="id" value={r.id} />
                <label className="campo">
                  <span>Nombre</span>
                  <input name="nombre" defaultValue={r.nombre} required />
                </label>
                <label className="campo">
                  <span>CUIT</span>
                  <input name="cuit" defaultValue={formatoCuit(r.cuit)} inputMode="numeric" placeholder="30-12345678-9" />
                </label>
                <label className="casilla ancho">
                  <input type="checkbox" name="activo" defaultChecked={r.activo} /> Activa {r.usos > 0 && `(${r.usos} obligaciones cargadas)`}
                </label>
              </FormAccion>
            </details>
          ))}
          <h3 style={{ fontSize: 15, margin: '14px 0 10px' }}>Agregar razón social</h3>
          <FormAccion accion={guardarRazonSocial} boton="Agregar" claseBoton="btn chico" limpiar>
            <label className="campo">
              <span>Nombre</span>
              <input name="nombre" required />
            </label>
            <label className="campo">
              <span>CUIT <em>(opcional)</em></span>
              <input name="cuit" inputMode="numeric" placeholder="30-12345678-9" />
            </label>
          </FormAccion>
        </div>
      </div>
    </>
  );
}
