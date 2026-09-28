import { chromium } from 'playwright';
const [,, nombre] = process.argv;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 794, height: 1123 } });
await p.goto(`file:///var/tmp/manual/${nombre}.html`);
await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500);
await p.pdf({ path: `/var/tmp/manual/${nombre}.pdf`, format: 'A4', printBackground: true, preferCSSPageSize: true });
// vista previa de cada hoja
const hojas = await p.$$('.hoja');
for (let i = 0; i < hojas.length; i++) await hojas[i].screenshot({ path: `/var/tmp/manual/prev-${nombre}-${i + 1}.png` });
console.log(hojas.length, 'hojas');
await b.close();
