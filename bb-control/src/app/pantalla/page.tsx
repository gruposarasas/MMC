import { pantallaActual } from '@/lib/pantalla';
import { PantallaQR } from './PantallaQR';

export const metadata = { title: 'Fichaje · Bruno Brown' };
export const dynamic = 'force-dynamic';

export default async function Pantalla() {
  const p = await pantallaActual();
  if (!p) {
    return (
      <div className="kiosco">
        <img src="/b-crema.png" alt="Bruno Brown" style={{ width: 64, marginBottom: 18 }} />
        <h1>Esta pantalla no está activada</h1>
        <p style={{ color: 'var(--arena)', maxWidth: 420, marginTop: 10 }}>
          Pedile a administración el link de activación (BB-CONTROL → Equipo → Fichaje → Pantallas) y abrilo en este equipo.
        </p>
      </div>
    );
  }
  return <PantallaQR lugar={p.lugar} />;
}
