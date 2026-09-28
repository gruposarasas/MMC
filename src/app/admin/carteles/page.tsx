import Link from 'next/link';
import QRCode from 'qrcode';
import { esAdmin, todasLasMarcas } from '@/lib/datos';
import { URL_PUBLICA } from '@/lib/config';
import recursos from '@/lib/recursos.json';
import { EntrarAdmin } from '@/components/admin/Comun';
import { Imprimir } from '@/components/admin/Imprimir';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Carteles · Mundial de Café' };

export default async function Carteles() {
  if (!(await esAdmin())) return <EntrarAdmin />;
  const [marcas, qr] = await Promise.all([
    todasLasMarcas(),
    QRCode.toString(URL_PUBLICA, { type: 'svg', errorCorrectionLevel: 'M', margin: 0, color: { dark: '#281722', light: '#ffffff' } }),
  ]);
  const activas = marcas.filter((m) => m.activa && !m.eliminada && m.beneficio);

  return (
    <div className="bo" style={{ gridTemplateColumns: '1fr' }}>
      <section>
        <p style={{ margin: '0 0 12px' }}><Link className="link" href="/admin">← Volver al back office</Link></p>
        <div className="fila">
          <div>
            <h1>Carteles para imprimir</h1>
            <p className="sub" style={{ marginBottom: 0 }}>El QR de mesas y paredes lleva siempre a la misma página de registro: {URL_PUBLICA.replace('https://', '')}</p>
          </div>
          <Imprimir id="cartelMesa" texto="Imprimir cartel" className="btn chico" />
        </div>
        <div className="carteles">
          <div className="cartel imprimible" id="cartelMesa">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="c-logo" src={recursos.logo} alt="Mundial de Café by Bruno Brown" />
            <h3>Escaneá y disfrutá de tus beneficios</h3>
            <div className="c-qr"><div dangerouslySetInnerHTML={{ __html: qr }} /></div>
            <div className="c-paso">Registrate una vez y usalo en cada stand</div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="c-pie" src={recursos.guarda} alt="" />
          </div>
          <div style={{ maxWidth: 380 }}>
            <h2 style={{ fontSize: 17, color: 'var(--arena)', margin: 0 }}>Tarjetas de caja</h2>
            <p className="sub">Una por cafetería, para el personal del stand y de sus sucursales. El cajero le dice el código al visitante en el momento de pagar.</p>
            <div style={{ display: 'grid', gap: 12 }}>
              {activas.length === 0 && <p className="ayuda">Todavía no hay marcas visibles.</p>}
              {activas.map((m) => (
                <div key={m.id} style={{ display: 'contents' }}>
                  <div className="tcaja imprimible" id={`tc-${m.id}`}>
                    <h4>{m.nombre}</h4>
                    <p>Código de caja del Mundial de Café</p>
                    <div className="codigo">{m.codigo}</div>
                    <p><b>Beneficio:</b> {m.beneficio}. {m.condiciones}</p>
                    <p>Cuando un visitante quiera usar su beneficio, decile este código para que lo escriba en su celular. Te tiene que mostrar &quot;Canje válido&quot; con su nombre y la hora con los segundos moviéndose. Si la hora está quieta, es una captura de pantalla: no lo aceptes.</p>
                  </div>
                  <Imprimir id={`tc-${m.id}`} texto={`Imprimir tarjeta de ${m.nombre}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
