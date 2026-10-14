import Link from 'next/link';

export function TabsActivos({ actual }: { actual: string }) {
  return (
    <nav className="pildoras" aria-label="Secciones de activos" style={{ marginBottom: 18 }}>
      {[
        { href: '/activos', nombre: 'Equipos y vehículos' },
        { href: '/activos/importaciones', nombre: 'Importaciones y costos' },
      ].map((t) => (
        <Link key={t.href} className={t.href === actual ? 'on' : ''} aria-current={t.href === actual ? 'page' : undefined} href={t.href}>{t.nombre}</Link>
      ))}
    </nav>
  );
}
