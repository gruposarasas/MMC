'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FIGURAS } from '@/lib/marca';

const ITEMS = [
  { href: '/kpi', nombre: 'KPI', fig: FIGURAS.kpi },
  { href: '/ventas', nombre: 'Ventas', fig: FIGURAS.ventas },
  { href: '/compras', nombre: 'Compras', fig: FIGURAS.compras },
  { href: '/gastos', nombre: 'Gastos', fig: FIGURAS.gastos },
  { href: '/sueldos', nombre: 'Sueldos', fig: FIGURAS.sueldos },
  { href: '/equipo', nombre: 'Equipo', fig: FIGURAS.equipo },
  { href: '/costos', nombre: 'Costos', fig: FIGURAS.costos },
  { href: '/ajustes', nombre: 'Ajustes', fig: FIGURAS.ajustes },
];

export function Nav({ pendientes }: { pendientes: number }) {
  const ruta = usePathname();
  return (
    <nav className="nav" aria-label="Módulos">
      {ITEMS.map((i) => {
        const on = ruta === i.href || ruta.startsWith(`${i.href}/`);
        return (
          <Link key={i.href} href={i.href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>
            <span className="nav-n">
              <img src={i.fig} alt="" />
              {i.nombre}
            </span>
            {i.href === '/equipo' && pendientes > 0 && <span className="badge" title="Pedidos pendientes">{pendientes}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
