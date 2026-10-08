import { ModuloEgresos } from '@/components/ModuloEgresos';
import type { Params } from '@/lib/url';

export const metadata = { title: 'Gastos · GM-CONTROL' };

export default async function Gastos({ searchParams }: { searchParams: Promise<Params> }) {
  return <ModuloEgresos tipo="gasto" sp={await searchParams} />;
}
