import { Marco } from '@/components/Marco';
import { exigirContabilidad } from '@/lib/contabilidad';

export const dynamic = 'force-dynamic';

// Contabilidad: entran administración y el contador (que ve solo esta sección).
export default async function Contable({ children }: { children: React.ReactNode }) {
  const q = await exigirContabilidad();
  return <Marco contador={q.rol === 'contador' ? q.nombre : undefined}>{children}</Marco>;
}
