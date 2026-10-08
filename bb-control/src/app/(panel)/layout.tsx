import { Marco } from '@/components/Marco';
import { exigirAdmin } from '@/lib/sesion';

export const dynamic = 'force-dynamic';

export default async function Panel({ children }: { children: React.ReactNode }) {
  await exigirAdmin();
  return <Marco>{children}</Marco>;
}
