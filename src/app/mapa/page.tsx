import { visitanteActual } from '@/lib/datos';
import { CabSeccion } from '@/components/Secciones';
import { Mapa } from '@/components/Mapa';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Mapa del evento · Mundial de Café' };

export default async function PaginaMapa() {
  const v = await visitanteActual();
  return (
    <div className="tel">
      <div className="tel-in">
        {v ? <CabSeccion /> : <CabSeccion volver="/" texto="Registrate" />}
        <h1 className="h1">Mapa del evento</h1>
        <p className="lead">Bodega Arizu. Tocá + para acercar o tocá dos veces sobre el mapa.</p>
        <Mapa />
        <p className="ayuda">* Sujeto a posibles cambios.</p>
        <p style={{ marginTop: 12 }}>
          <a className="link" href="/img/mapa.jpg" target="_blank" rel="noopener">Abrir el mapa en pantalla completa</a>
        </p>
      </div>
    </div>
  );
}
