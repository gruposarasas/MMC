import { chromium, devices } from 'playwright';
import fs from 'node:fs';
const B = 'http://localhost:3000', S = '/var/tmp/manual/img/';
const F = '/var/tmp/pw/node_modules/@fontsource/poppins/files/';
const css = [400, 500, 600, 700, 800].map((w) => `@font-face{font-family:'Poppins';font-style:normal;font-weight:${w};font-display:block;src:url(data:font/woff2;base64,${fs.readFileSync(F + `poppins-latin-${w}-normal.woff2`).toString('base64')}) format('woff2')}`).join('\n');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--lang=es-AR'] });
async function ctx(opts, ocultarInstalar = true) {
  const c = await b.newContext({ locale: 'es-AR', timezoneId: 'America/Argentina/Mendoza', ...opts });
  await c.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: css }));
  await c.route('https://fonts.gstatic.com/**', (r) => r.abort());
  if (ocultarInstalar) await c.addInitScript(() => { try { localStorage.setItem('mc-instalar-oculto', '1'); } catch {} });
  return c;
}
const listo = async (p) => { await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400); };
const tel = { ...devices['iPhone 13'], deviceScaleFactor: 2 };

// ---------- visitante
{
  const c = await ctx(tel);
  const p = await c.newPage();
  await p.goto(B + '/'); await listo(p);
  await p.screenshot({ path: S + 'v-registro.png' });
  await p.fill('#rNom', 'Valentina Ruiz');
  const s = await p.$$('.fecha select'); await s[0].selectOption('12'); await s[1].selectOption('5'); await s[2].selectOption('1995');
  await p.fill('#rCon', 'valen.ruiz@mail.com'); await p.check('.check input >> nth=0');
  await p.click('button[type=submit]'); await p.waitForURL('**/billetera'); await listo(p); await p.waitForTimeout(3000);
  await p.screenshot({ path: S + 'v-billetera.png' });
  await p.click('article:has-text("Shelby") a.cu-usar'); await p.waitForURL('**/canjear/**'); await listo(p);
  for (const d of '48') await p.click(`.teclado button:text-is("${d}")`);
  await p.screenshot({ path: S + 'v-teclado.png' });
  for (const d of '27') await p.click(`.teclado button:text-is("${d}")`);
  await p.waitForSelector('.canje'); await p.waitForTimeout(1500);
  await p.screenshot({ path: S + 'v-canje.png' });
  await p.click('text=Listo'); await p.waitForURL('**/billetera'); await listo(p);
  const art = await p.$('article:has-text("Shelby")'); await art.screenshot({ path: S + 'v-cupon.png' });
  await c.close();
}
// invitación a instalar (iPhone)
{
  const c = await ctx(tel, false);
  const p = await c.newPage();
  await p.request.post(B + '/api/recuperar', { data: { via: 'mail', contacto: 'valen.ruiz@mail.com' } });
  await p.goto(B + '/billetera'); await listo(p); await p.waitForTimeout(500);
  await (await p.$('.instalar')).screenshot({ path: S + 'v-instalar.png' });
  await c.close();
}
// ---------- marca
{
  const c = await ctx(tel);
  const p = await c.newPage();
  await p.goto(B + '/marca'); await listo(p);
  await p.fill('#pmClave', 'CUMBAL-DEMO');
  await p.screenshot({ path: S + 'm-entrar.png' });
  await p.click('button[type=submit]'); await p.waitForSelector('#pmBen'); await listo(p);
  await p.fill('#pmBen', '10% off en café de especialidad');
  await p.fill('#pmCond', 'Presentando el cupón en caja.');
  await p.fill('#mVence', '2026-11-15');
  await p.fill('#mSuc', 'Belgrano 1020, Ciudad de Mendoza');
  await (await p.$('form.form')).screenshot({ path: S + 'm-form.png' });
  await c.close();
  const c2 = await ctx(tel);
  const q = await c2.newPage();
  await q.goto(B + '/marca'); await q.fill('#pmClave', 'SHELBY-DEMO'); await q.click('button[type=submit]');
  await q.waitForSelector('text=Tus canjes'); await listo(q);
  await q.screenshot({ path: S + 'm-enviado.png', fullPage: true });
  await c2.close();
}
// ---------- administración
{
  const c = await ctx({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 });
  const p = await c.newPage();
  await p.goto(B + '/admin'); await listo(p);
  await p.screenshot({ path: S + 'a-entrar.png', clip: { x: 380, y: 0, width: 520, height: 520 } });
  await p.fill('#aPass', 'prueba-admin'); await p.click('button[type=submit]'); await p.waitForSelector('.stats'); await listo(p);
  await p.screenshot({ path: S + 'a-resumen.png' });
  await p.goto(B + '/admin?tab=marcas'); await p.waitForSelector('.marcas'); await listo(p);
  await p.screenshot({ path: S + 'a-beneficios.png' });
  const sh = await p.$('.marca:has(h3:text-is("Shelby"))'); await sh.scrollIntoViewIfNeeded(); await sh.screenshot({ path: S + 'a-tarjeta-marca.png' });
  await p.click('text=Crear marca'); await p.waitForSelector('#fMarca'); await listo(p);
  await p.fill('#mNom', 'Café Nuevo'); await p.fill('#mStand', 'Stand 12');
  await (await p.$('#fMarca')).screenshot({ path: S + 'a-crear.png' });
  await p.goto(B + '/admin?tab=visitantes'); await p.waitForSelector('text=registrados'); await listo(p);
  await p.screenshot({ path: S + 'a-visitantes.png', clip: { x: 0, y: 0, width: 1280, height: 520 } });
  await p.goto(B + '/admin?tab=canjes'); await p.waitForSelector('text=liquidar'); await listo(p);
  await p.screenshot({ path: S + 'a-canjes.png', clip: { x: 0, y: 0, width: 1280, height: 560 } });
  await p.goto(B + '/admin/carteles'); await listo(p);
  await p.screenshot({ path: S + 'a-carteles.png', clip: { x: 0, y: 0, width: 1280, height: 860 } });
  const tc = await p.$('.tcaja:has(h4:text-is("Shelby"))'); await tc.screenshot({ path: S + 'tarjeta-caja.png' });
  await (await p.$('#cartelMesa')).screenshot({ path: S + 'cartel.png' });
  await c.close();
}
await b.close();
console.log(fs.readdirSync(S).join(' '));
