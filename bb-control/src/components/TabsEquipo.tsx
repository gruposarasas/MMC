import Link from 'next/link';

const TABS = [
  { href: '/equipo', nombre: 'Personas' },
  { href: '/equipo/horas', nombre: 'Horas' },
  { href: '/equipo/fichaje', nombre: 'Fichaje' },
];

export function TabsEquipo({ actual }: { actual: string }) {
  return (
    <nav className="pildoras" aria-label="Secciones de equipo" style={{ marginBottom: 18 }}>
      {TABS.map((t) => (
        <Link key={t.href} className={t.href === actual ? 'on' : ''} aria-current={t.href === actual ? 'page' : undefined} href={t.href}>
          {t.nombre}
        </Link>
      ))}
    </nav>
  );
}
