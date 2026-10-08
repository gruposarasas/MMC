// Lista de proveedores: reconoce un proveedor por CUIT o por nombre (también por sus nombres
// anteriores) para no duplicarlo. Las funciones de texto sirven también en el navegador.
import type postgres from 'postgres';
import { normalizar } from './importar';

export type ProveedorBase = { id: number; nombre: string; cuit: string; rubro_id: number | null; alias: string[] };
type Tx = postgres.TransactionSql<Record<string, unknown>> | postgres.Sql<Record<string, unknown>>;

export const limpiarCuit = (s: unknown) => String(s ?? '').replace(/\D/g, '');
export const formatoCuit = (c: string) => (c.length === 11 ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : c);

/** Nombre para comparar: sin acentos, mayúsculas, espacios ni "S.A." o "S.R.L." al final. */
export function claveNombre(s: unknown) {
  const n = normalizar(s).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const sin = n.replace(/ (s ?a ?i ?c ?y ?f|s ?a ?i ?c|s ?a ?s|s ?a ?u|s ?r ?l|s ?a|s ?h|s ?c ?a|s ?c ?s|s ?c)$/, '');
  return (sin || n).replace(/ /g, '');
}

export class ListaProveedores {
  private porCuit = new Map<string, ProveedorBase>();
  private porNombre = new Map<string, ProveedorBase>();

  constructor(lista: ProveedorBase[]) {
    // Primero los nombres actuales: ganan sobre los nombres anteriores de otro proveedor.
    for (const p of lista) this.agregar(p);
    for (const p of lista) for (const a of p.alias) if (!this.porNombre.has(claveNombre(a))) this.porNombre.set(claveNombre(a), p);
  }

  static async cargar(tx: Tx) {
    return new ListaProveedores(await tx<ProveedorBase[]>`select id, nombre, cuit, rubro_id, alias from proveedores`);
  }

  private agregar(p: ProveedorBase) {
    if (p.cuit) this.porCuit.set(p.cuit, p);
    const k = claveNombre(p.nombre);
    if (k && !this.porNombre.has(k)) this.porNombre.set(k, p);
  }

  buscar(nombre: string, cuit = ''): ProveedorBase | null {
    const c = limpiarCuit(cuit);
    return (c.length === 11 && this.porCuit.get(c)) || this.porNombre.get(claveNombre(nombre)) || null;
  }

  /** Devuelve el proveedor que coincide o lo agrega a la lista. Si coincide por nombre y no tenía CUIT, se lo completa. */
  async buscarOCrear(tx: Tx, nombre: string, cuit: string, rubroId: number | null) {
    const c = limpiarCuit(cuit).length === 11 ? limpiarCuit(cuit) : '';
    const existe = this.buscar(nombre, c);
    if (existe) {
      if (c && !existe.cuit && !this.porCuit.has(c)) {
        await tx`update proveedores set cuit = ${c} where id = ${existe.id}`;
        existe.cuit = c;
        this.porCuit.set(c, existe);
      }
      return { id: existe.id, nuevo: false };
    }
    const limpio = nombre.trim().replace(/\s+/g, ' ').slice(0, 120);
    const [p] = await tx<ProveedorBase[]>`
      insert into proveedores (nombre, cuit, rubro_id) values (${limpio}, ${c}, ${rubroId})
      returning id, nombre, cuit, rubro_id, alias`;
    this.agregar(p);
    return { id: p.id, nuevo: true };
  }
}
