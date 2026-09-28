import { redirect } from 'next/navigation';
import { visitanteActual, marcaParaCanje } from '@/lib/datos';
import { urlLogo } from '@/lib/config';
import { vencida } from '@/lib/formato';
import { Teclado } from '@/components/Teclado';

export const dynamic = 'force-dynamic';

export default async function Canjear({ params }: { params: Promise<{ marca: string }> }) {
  const v = await visitanteActual();
  if (!v) redirect('/');
  const { marca: id } = await params;
  const d = await marcaParaCanje(v.id, id);
  if (!d) redirect('/billetera');
  const m = d.marca;
  const restantes = vencida(m.vence) ? 0 : Math.max(0, m.creditos - d.usados);
  return (
    <Teclado
      marca={{ id: m.id, nombre: m.nombre, stand: m.stand, beneficio: m.beneficio, creditos: m.creditos, emblema: m.emblema, logoUrl: urlLogo(m.logo_path) }}
      restantesIni={restantes}
      bloqueoIni={d.bloqueoSeg}
    />
  );
}
