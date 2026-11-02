import { activarPantalla } from '@/acciones/fichaje';
import { FormAccion } from '@/components/FormAccion';
import { db } from '@/lib/db';

export const metadata = { title: 'Activar pantalla · Bruno Brown' };
export const dynamic = 'force-dynamic';

// Un link de un solo uso: se activa con el botón (no al abrirlo), así no lo gasta la vista previa de WhatsApp o del mail.
export default async function Activar({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = await params;
  const [p] = await db()<{ lugar: string; nombre: string }[]>`
    select l.nombre lugar, p.nombre from pantallas p join lugares l on l.id = p.lugar_id where p.codigo = ${codigo.slice(0, 40)} and p.codigo_vence > now()`;
  return (
    <div className="kiosco">
      <img src="/b-crema.png" alt="Bruno Brown" style={{ width: 64, marginBottom: 18 }} />
      {p ? (
        <>
          <h1>Pantalla de fichaje de {p.lugar}</h1>
          <p style={{ color: 'var(--arena)', maxWidth: 440, margin: '10px 0 22px' }}>
            Este equipo va a mostrar el QR con el que el equipo marca la entrada y la salida. Dejalo prendido y a la vista{p.nombre ? ` (${p.nombre})` : ''}.
          </p>
          <FormAccion accion={activarPantalla} boton="Activar esta pantalla" claseBoton="btn vino" className="activar-pantalla">
            <input type="hidden" name="codigo" value={codigo} />
          </FormAccion>
        </>
      ) : (
        <>
          <h1>El link venció o ya se usó</h1>
          <p style={{ color: 'var(--arena)', maxWidth: 420, marginTop: 10 }}>Pedile a administración un link nuevo.</p>
        </>
      )}
    </div>
  );
}
