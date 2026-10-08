import Link from 'next/link';

const TABS = [
  { href: '/contabilidad', nombre: 'Obligaciones del mes' },
  { href: '/contabilidad/iva', nombre: 'IVA estimado' },
  { href: '/contabilidad/equipo', nombre: 'Equipo: ART y novedades' },
  { href: '/contabilidad/accesos', nombre: 'Accesos y razones sociales', admin: true },
];

export function TabsContabilidad({ actual, admin, mes }: { actual: string; admin: boolean; mes?: string }) {
  return (
    <nav className="pildoras" aria-label="Secciones de contabilidad" style={{ marginBottom: 18 }}>
      {TABS.filter((t) => admin || !t.admin).map((t) => (
        <Link key={t.href} className={t.href === actual ? 'on' : ''} aria-current={t.href === actual ? 'page' : undefined}
          href={mes && !t.admin ? `${t.href}?p=${mes}` : t.href}>
          {t.nombre}
        </Link>
      ))}
    </nav>
  );
}
