import { redirect } from 'next/navigation';
import { visitanteActual } from '@/lib/datos';
import { Registro } from '@/components/Registro';

export const dynamic = 'force-dynamic';

export default async function Inicio() {
  if (await visitanteActual()) redirect('/billetera');
  return (
    <div className="tel">
      <Registro />
    </div>
  );
}
