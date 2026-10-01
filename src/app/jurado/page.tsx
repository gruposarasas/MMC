import { juradoActual, vistaJurado } from '@/lib/jurados';
import { EntrarJurado, PanelJurado } from '@/components/torneo/PanelJurado';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Jurado · Torneo de Baristas' };

export default async function Jurado() {
  const n = await juradoActual();
  if (!n) return <EntrarJurado />;
  return <PanelJurado inicial={await vistaJurado(n)} />;
}
