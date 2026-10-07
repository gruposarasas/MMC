// Conexión a Postgres. Solo servidor.
import postgres from 'postgres';

type Sql = postgres.Sql<Record<string, unknown>>;
const global = globalThis as unknown as { __bbSql?: Sql };

export function db(): Sql {
  if (typeof window !== 'undefined') throw new Error('db() es solo del servidor');
  if (!global.__bbSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Falta DATABASE_URL');
    global.__bbSql = postgres(url, {
      prepare: false, // compatible con el pooler de Supabase
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
