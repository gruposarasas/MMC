// Aplica las migraciones de db/migraciones que todavía no se corrieron.
// Se ejecuta solo al arrancar el contenedor y también con `npm run migrar`.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('[migrar] Falta DATABASE_URL');
  process.exit(1);
}

const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
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
  console.error('[migrar] error:', e.message);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}
