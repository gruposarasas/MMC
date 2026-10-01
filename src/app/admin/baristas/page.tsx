import { esAdmin } from '@/lib/datos';
import { estadoTorneo } from '@/lib/torneo';
import { EntrarAdmin } from '@/components/admin/Comun';
import { AdminTorneo } from '@/components/torneo/AdminTorneo';
import { AccesosBaristas } from '@/components/torneo/AccesosBaristas';
import { accesosBaristas } from '@/lib/votos';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Torneo de Baristas · Back office' };

export default async function AdminBaristas() {
  if (!(await esAdmin())) return <EntrarAdmin />;
  return (
    <div className="bo" style={{ gridTemplateColumns: '1fr', maxWidth: 1100 }}>
      <section>
        <AdminTorneo inicial={await estadoTorneo()} />
        <AccesosBaristas inicial={await accesosBaristas()} />
      </section>
    </div>
  );
}
