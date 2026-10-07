import { ModuloEgresos } from '@/components/ModuloEgresos';
import type { Params } from '@/lib/url';

export const metadata = { title: 'Compras · BB-CONTROL' };

export default async function Compras({ searchParams }: { searchParams: Promise<Params> }) {
  return <ModuloEgresos tipo="compra" sp={await searchParams} />;
}
