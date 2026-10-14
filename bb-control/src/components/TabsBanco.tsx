import Link from 'next/link';

const TABS = [
  { href: '/banco', nombre: 'Planificación' },
  { href: '/banco/echeqs', nombre: 'Echeqs' },
  { href: '/banco/deudas', nombre: 'Préstamos y deudas' },
  { href: '/banco/fijos', nombre: 'Gastos fijos' },
];

export function TabsBanco({ actual }: { actual: string }) {
  return (
    <nav className="pildoras" aria-label="Secciones de banco" style={{ marginBottom: 18 }}>
      {TABS.map((t) => (
        <Link key={t.href} className={t.href === actual ? 'on' : ''} aria-current={t.href === actual ? 'page' : undefined} href={t.href}>
          {t.nombre}
        </Link>
      ))}
    </nav>
  );
}
