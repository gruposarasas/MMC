import Link from 'next/link';

export function TabsClientes({ actual }: { actual: string }) {
  return (
    <nav className="pildoras" aria-label="Secciones de clientes" style={{ marginBottom: 18 }}>
      {[
        { href: '/clientes', nombre: 'Semáforo' },
        { href: '/clientes/criterios', nombre: 'Criterios' },
      ].map((t) => (
        <Link key={t.href} className={t.href === actual ? 'on' : ''} aria-current={t.href === actual ? 'page' : undefined} href={t.href}>{t.nombre}</Link>
      ))}
    </nav>
  );
}
