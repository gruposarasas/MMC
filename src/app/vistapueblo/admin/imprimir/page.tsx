import Link from 'next/link';
import { db } from '@/lib/supabase';
import { esAdminVP, tarjetasPorIds, localesPublicos, qrSvg, linkCobro, claveImpresa } from '@/lib/vistapueblo-servidor';
import { dondeVale } from '@/lib/vistapueblo';
import { EntrarAdmin, AutoImprimir } from '@/components/vistapueblo/Comun';
import { Voucher } from '@/components/vistapueblo/Voucher';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Imprimir vouchers · Vistapueblo' };

/** Hoja de impresión: A4 con 3 vouchers por hoja, o ticketera de 80 mm (uno por corte). */
export default async function Imprimir({ searchParams }: { searchParams: Promise<{ ids?: string; formato?: string }> }) {
  if (!(await esAdminVP())) return <EntrarAdmin />;
  const sp = await searchParams;
  const formato = sp.formato === 'ticket' ? 'ticket' : 'a4';
  const ids = (sp.ids || '').split(',');
  const [ts, ls] = await Promise.all([tarjetasPorIds(ids), localesPublicos()]);
  // Al imprimirla, la tarjeta pasa a valer con el QR fijo del papel.
  const digitales = ts.filter((t) => !t.impresa).map((t) => t.id);
  if (digitales.length) {
    await db().from('vp_tarjetas').update({ impresa: true }).in('id', digitales);
    ts.forEach((t) => { t.impresa = true; });
  }
  const vouchers = await Promise.all(ts.map(async (t) => ({
    id: t.id,
    v: { numero: t.numero, nombre: t.nombre, monto: t.monto, vence: t.vence, donde: dondeVale(t.todos_los_locales, t.locales, ls), modo: t.modo, mensaje: t.mensaje, codigo: t.codigo, qr: await qrSvg(linkCobro(claveImpresa(t))) },
  })));
  const otro = formato === 'a4' ? 'ticket' : 'a4';
  return (
    <main className={`vp-print ${formato}`}>
      <style>{formato === 'ticket' ? '@page{size:80mm auto;margin:3mm}' : '@page{size:A4;margin:10mm}'}</style>
      <div className="vp-print-barra">
        <div>
          <b>{ts.length === 1 ? '1 voucher' : `${ts.length} vouchers`}</b> · {formato === 'a4' ? 'Hoja A4, 3 por hoja' : 'Ticketera 80 mm'}
          {' · '}<Link className="vp-link" href={`/vistapueblo/admin/imprimir?formato=${otro}&ids=${ts.map((t) => t.id).join(',')}`}>Pasar a {otro === 'a4' ? 'hoja A4' : 'ticketera'}</Link>
        </div>
        <div className="vp-inline">
          <Link className="vp-link" href="/vistapueblo/admin?tab=tarjetas">Volver</Link>
          {ts.length > 0 && <AutoImprimir />}
        </div>
      </div>
      {!ts.length && <p className="vp-vacio">No hay vouchers para imprimir.</p>}
      <div className="vp-print-hojas">
        {vouchers.map(({ id, v }) => <Voucher key={id} v={v} formato={formato} />)}
      </div>
    </main>
  );
}
