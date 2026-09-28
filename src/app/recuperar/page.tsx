import { redirect } from 'next/navigation';
import { visitanteActual } from '@/lib/datos';
import { Recuperar } from '@/components/Recuperar';

export const dynamic = 'force-dynamic';

export default async function PaginaRecuperar() {
  if (await visitanteActual()) redirect('/billetera');
  return (
    <div className="tel">
      <Recuperar />
    </div>
  );
}
