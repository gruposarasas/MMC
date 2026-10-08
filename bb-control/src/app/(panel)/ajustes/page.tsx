import { Titulo } from '@/components/Titulo';
import { headers } from 'next/headers';
import { guardarRubro } from '@/acciones/ajustes';
import { configurarContabilium, desconectarContabilium } from '@/acciones/contabilium';
import { ConectarContabilium } from '@/components/Contabilium';
import { BotonAccion } from '@/components/FormAccion';
import { credenciales, leerConfig, leerEstado } from '@/lib/contabilium';
import { FormAccion } from '@/components/FormAccion';
import { FormDolar } from '@/components/FormDolar';
import { leerDolar } from '@/lib/ajustes';
import { db } from '@/lib/db';

export const metadata = { title: 'Ajustes · BB-CONTROL' };

type Rubro = { id: number; tipo: 'compra' | 'gasto'; nombre: string; clase: string; activo: boolean; usos: number };
const CLASES: Record<string, string> = {
  operativo: 'Gasto operativo',
  cargas: 'Cargas sociales (F.931)',
  impuestos: 'Impuestos',
  inversion: 'Inversión',
};

export default async function Ajustes() {
  const [rubros, dolar, h, cred, estado, config] = await Promise.all([
    db()<Rubro[]>`select r.*, (select count(*) from egresos e where e.rubro_id = r.id)::int usos from rubros r order by tipo, orden, nombre`,
    leerDolar(),
    headers(),
    credenciales(),
    leerEstado(),
    leerConfig(),
  ]);
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? '';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const linkEquipo = `${proto}://${host}/mi`;

  const Lista = ({ tipo }: { tipo: 'compra' | 'gasto' }) => (
    <div className="caja">
      <h2>Rubros de {tipo === 'compra' ? 'compras (mercadería)' : 'gastos'}</h2>
      <p className="sub">
        {tipo === 'compra'
          ? 'Todo lo que se compra para vender.'
          : 'La clase ordena el tablero: las cargas sociales e inversiones se muestran aparte.'}{' '}
        Un rubro que no se usa más se desactiva (no se borra, para no perder la historia).
      </p>
      {rubros.filter((r) => r.tipo === tipo).map((r) => (
        <FormAccion key={r.id} accion={guardarRubro} className="linea-form" boton="Guardar" claseBoton="btn chico claro">
          <input type="hidden" name="id" value={r.id} />
          <input type="hidden" name="tipo" value={tipo} />
          <input name="nombre" defaultValue={r.nombre} aria-label="Nombre" style={{ flex: 1, minWidth: 160 }} />
          {tipo === 'gasto' && (
            <select name="clase" defaultValue={r.clase} aria-label="Clase" style={{ background: '#fff', border: '1px solid var(--linea)', borderRadius: 8, padding: '5px 6px', fontSize: 13 }}>
              {Object.entries(CLASES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
          <label className="casilla" style={{ fontSize: 13 }}><input type="checkbox" name="activo" defaultChecked={r.activo} /> Activo</label>
          <span className="chico" style={{ minWidth: 56 }}>{r.usos} usos</span>
        </FormAccion>
      ))}
      <div style={{ borderTop: '1px solid var(--linea)', marginTop: 10, paddingTop: 12 }}>
        <FormAccion accion={guardarRubro} className="linea-form" boton="Agregar" claseBoton="btn chico" limpiar>
          <input type="hidden" name="tipo" value={tipo} />
          <input name="nombre" placeholder="Rubro nuevo" aria-label="Rubro nuevo" style={{ flex: 1, minWidth: 160 }} />
          {tipo === 'gasto' && (
            <select name="clase" defaultValue="operativo" aria-label="Clase" style={{ background: '#fff', border: '1px solid var(--linea)', borderRadius: 8, padding: '5px 6px', fontSize: 13 }}>
              {Object.entries(CLASES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          )}
        </FormAccion>
      </div>
    </div>
  );

  return (
    <>
      <div className="cabeza">
        <Titulo modulo="ajustes" eti="Configuración" titulo="Ajustes">
          Rubros de compras y gastos, dólar de referencia y la app del equipo.
        </Titulo>
      </div>
      <div className="grilla2" style={{ marginBottom: 18 }}>
        <div className="caja">
          <h2>App del equipo</h2>
          <p className="sub">Cada persona entra con su DNI y la clave que le generás en su ficha de Equipo. Se puede agregar a la pantalla de inicio del celular.</p>
          <p style={{ fontSize: 18, fontWeight: 700, margin: 0, overflowWrap: 'anywhere' }}>{linkEquipo}</p>
        </div>
        <div className="caja">
          <h2>Dólar de referencia</h2>
          <p className="sub">Se usa para los costos de insumos en dólares y como sugerencia al cargar compras en dólares.</p>
          <FormDolar dolar={dolar} />
        </div>
      </div>
      <div className="caja">
        <div className="caja-cab">
          <div>
            <h2>Contabilium</h2>
            <p className="sub" style={{ margin: 0 }}>
              Conecta la API para traer las ventas solas. Los datos están en Contabilium → Mi cuenta → Configuración → API → Credenciales (plan Full o superior).
            </p>
          </div>
          {cred ? <span className="chip bien">Conectado</span> : <span className="chip">Sin conectar</span>}
        </div>
        {estado && (
          <div className={`aviso ${estado.ok ? 'ok' : 'mal'}`}>
            Última sincronización ({new Date(estado.fecha).toLocaleString('es-AR', { timeZone: 'America/Argentina/Mendoza', dateStyle: 'short', timeStyle: 'short' })}): {estado.mensaje}
          </div>
        )}
        {cred?.origen === 'entorno' ? (
          <p className="sub">Configurado con las variables CONTABILIUM_EMAIL y CONTABILIUM_API_KEY del servidor ({cred.email}).</p>
        ) : (
          <ConectarContabilium email={cred?.email ?? ''} tieneClave={!!cred} />
        )}
        {cred && (
          <div className="acciones" style={{ marginTop: 12, justifyContent: 'space-between' }}>
            <form action={configurarContabilium} className="acciones">
              <label className="casilla"><input type="checkbox" name="auto" defaultChecked={config.auto} /> Traer las ventas solas cada 6 horas (últimos 35 días)</label>
              <button className="btn chico claro">Guardar</button>
            </form>
            {cred.origen === 'ajustes' && (
              <BotonAccion accion={desconectarContabilium} campos={{}} className="btn chico claro" confirmar="¿Desconectar Contabilium? Las ventas ya traídas quedan.">Desconectar</BotonAccion>
            )}
          </div>
        )}
      </div>
      <div className="grilla2">
        <Lista tipo="compra" />
        <Lista tipo="gasto" />
      </div>
    </>
  );
}
