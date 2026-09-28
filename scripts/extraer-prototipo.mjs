// Extrae del prototipo aprobado (referencia/prototipo-mundial.html):
//  - los recursos gráficos del Mundial (A) a public/img/
//  - los logos de las marcas (LOGOS) a semilla/logos/
//  - la semilla de las 34 marcas a supabase/seed.sql, con las mismas claves y
//    códigos de caja que genera el prototipo.
// Uso: npm run extraer
import fs from 'node:fs';
import path from 'node:path';

const raiz = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const html = fs.readFileSync(path.join(raiz, 'referencia/prototipo-mundial.html'), 'utf8');

const objeto = (nombre) => {
  const m = html.match(new RegExp(`const ${nombre}=(\\{.*?\\});\\n`));
  if (!m) throw new Error(`No encontré ${nombre} en el prototipo`);
  return JSON.parse(m[1]);
};
const ext = (uri) => ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/svg+xml': 'svg' })[uri.match(/^data:([^;]+);/)[1]];
const guardar = (dir, base, uri) => {
  fs.mkdirSync(dir, { recursive: true });
  const archivo = `${base}.${ext(uri)}`;
  fs.writeFileSync(path.join(dir, archivo), Buffer.from(uri.split(',')[1], 'base64'));
  return archivo;
};
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const A = objeto('A');
const recursos = {};
for (const [k, v] of Object.entries(A)) recursos[k] = '/img/' + guardar(path.join(raiz, 'public/img'), k, v);
fs.writeFileSync(path.join(raiz, 'src/lib/recursos.json'), JSON.stringify(recursos, null, 2) + '\n');

const LOGOS = objeto('LOGOS');
const LISTA = JSON.parse(html.match(/const LISTA=(\[.*?\]),emb=/)[1]);
const EMB = ['taza', 'flor', 'planta', 'chemex', 'grano', 'copa', 'reloj', 'jarra', 'estrella', 'ondas'];

// Mismo algoritmo que semilla() del prototipo.
const usadosC = new Set(), usadasK = new Set();
const hsh = (t) => { let x = 2166136261; for (const ch of t) { x ^= ch.charCodeAt(0); x = Math.imul(x, 16777619) >>> 0; } return x; };
const cod = (n) => { let k = hsh(n + '#caja') % 9000; let c; do { c = String(1000 + k); k = (k + 7) % 9000; } while (usadosC.has(c)); usadosC.add(c); return c; };
const SALTA = ['EL', 'LA', 'LOS', 'LAS', 'DEL', 'DE', 'UNA', 'UN', 'CO', 'CHOCOLATES', 'CAFE', 'HELADOS', 'TIENDA'];
const clv = (n) => { const ws = n.normalize('NFD').replace(/[^A-Za-z ]/g, '').toUpperCase().split(' ').filter(Boolean), b = (ws.find((w) => w.length > 2 && !SALTA.includes(w)) || ws[0]).slice(0, 10); let k = hsh(n), c; do { c = b + '-' + (k % 1296).toString(36).toUpperCase().padStart(2, '0'); k = hsh(c); } while (usadasK.has(c)); usadasK.add(c); return c; };

const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const filas = LISTA.map((x, i) => {
  const sh = x.n === 'Shelby';
  const logo = LOGOS[x.n] ? 'semilla/' + guardar(path.join(raiz, 'semilla/logos'), slug(x.n), LOGOS[x.n]) : null;
  return `  (${i + 1}, ${q(x.n)}, ${q(x.st)}, ${q(sh ? '2x1 en café' : '')}, ${q(sh ? 'En cualquier café de la carta. Uno por vez.' : '')}, ${sh ? 2 : 1}, ${q(cod(x.n))}, ${q(clv(x.n))}, ${q(EMB[i % EMB.length])}, ${sh}, ${q(logo)})`;
});

fs.writeFileSync(path.join(raiz, 'supabase/seed.sql'), `-- Generado por scripts/extraer-prototipo.mjs a partir del prototipo. No editar a mano.
-- 34 marcas; todas ocultas y sin beneficio salvo Shelby. Idempotente por nombre.
insert into public.marcas (orden, nombre, stand, beneficio, condiciones, creditos, codigo, clave, emblema, activa, logo_path) values
${filas.join(',\n')}
on conflict (nombre) do nothing;
`);
console.log(`Listo: ${Object.keys(recursos).length} recursos, ${Object.keys(LOGOS).length} logos, ${LISTA.length} marcas.`);
