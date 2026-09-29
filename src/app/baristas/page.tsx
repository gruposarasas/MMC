import { estadoTorneo } from '@/lib/torneo';
import { PantallaTorneo } from '@/components/torneo/PantallaTorneo';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Torneo de Baristas · Mundial de Café' };

export default async function Baristas() {
  return <PantallaTorneo inicial={await estadoTorneo()} />;
}
