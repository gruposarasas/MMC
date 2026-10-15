// Ajustes guardados en la base. Solo servidor.
import { db } from './db';

export async function leerAjuste<T>(clave: string): Promise<T | null> {
  const [r] = await db()`select valor from ajustes where clave = ${clave}`;
  return r ? (r.valor as T) : null;
}

export async function guardarAjuste(clave: string, valor: unknown) {
  const sql = db();
  await sql`insert into ajustes (clave, valor) values (${clave}, ${sql.json(valor as never)})
            on conflict (clave) do update set valor = excluded.valor, actualizado = now()`;
}

/** Dólar de referencia: el de venta del BNA (automático) o uno cargado a mano. */
export type Dolar = { valor: number; fecha: string; compra?: number | null; fuente?: 'BNA' | 'manual'; actualizado?: string; auto?: boolean };
export const leerDolar = () => leerAjuste<Dolar>('dolar');
