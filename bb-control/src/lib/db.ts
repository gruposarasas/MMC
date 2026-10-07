// Conexión a Postgres. Solo servidor.
import postgres from 'postgres';
import { opcionesConexion } from '../../scripts/conexion.mjs';

type Sql = postgres.Sql<Record<string, unknown>>;
const global = globalThis as unknown as { __bbSql?: Sql };

export function db(): Sql {
  if (typeof window !== 'undefined') throw new Error('db() es solo del servidor');
  if (!global.__bbSql) {
    global.__bbSql = postgres({
      ...opcionesConexion(process.env.DATABASE_URL),
      prepare: false, // compatible con el pooler de Supabase
      connect_timeout: 15,
      max: 6,
      idle_timeout: 30,
      onnotice: () => {},
      types: {
        // numeric e int8 como número; las fechas (date) quedan como texto AAAA-MM-DD.
        numeric: { to: 1700, from: [1700, 20], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) },
        fecha: { to: 1082, from: [1082], serialize: (x: unknown) => String(x), parse: (x: string) => x },
      },
    }) as unknown as Sql;
  }
  return global.__bbSql;
}
