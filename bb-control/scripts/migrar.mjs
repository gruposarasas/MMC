// Aplica las migraciones de db/migraciones que todavía no se corrieron.
// Se ejecuta solo al arrancar el contenedor y también con `npm run migrar`.
// Si falla, explica por qué en el log; el contenedor arranca igual (ver Dockerfile).
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import postgres from 'postgres';
import { describirConexion, explicarError, opcionesConexion } from './conexion.mjs';

let opciones;
try {
  opciones = opcionesConexion(process.env.DATABASE_URL);
} catch (e) {
  console.error(`[migrar] ${e.message}`);
  process.exit(1);
}
console.log(`[migrar] conectando a ${describirConexion(opciones)}`);
const sql = postgres({ ...opciones, prepare: false, max: 1, connect_timeout: 15, onnotice: () => {} });
const dir = join(process.cwd(), 'db', 'migraciones');

try {
  await sql`select pg_advisory_lock(70123)`;
  await sql`create table if not exists _migraciones (nombre text primary key, aplicada timestamptz not null default now())`;
  const hechas = new Set((await sql`select nombre from _migraciones`).map((r) => r.nombre));
  const archivos = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort();
  for (const f of archivos) {
    if (hechas.has(f)) continue;
    const texto = await readFile(join(dir, f), 'utf8');
    await sql.begin(async (tx) => {
      await tx.unsafe(texto);
      await tx`insert into _migraciones (nombre) values (${f})`;
    });
    console.log(`[migrar] aplicada ${f}`);
  }
  await sql`alter table _migraciones enable row level security`;
  console.log('[migrar] base al día');
} catch (e) {
  console.error(`[migrar] ERROR: ${explicarError(e)}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
