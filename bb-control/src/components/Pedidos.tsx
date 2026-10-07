import Link from 'next/link';
import { certificadoVisto, resolverAdelanto, resolverUniforme, resolverVacaciones } from '@/acciones/equipo';
import { BotonAccion } from '@/components/FormAccion';
import { fecha, nombreCompleto, pesos } from '@/lib/formato';
import type { Pedido } from '@/lib/equipo';

const TITULO = { vacaciones: 'Vacaciones', adelanto: 'Adelanto', uniforme: 'Uniforme', certificado: 'Certificado médico' };

/** Pedidos del equipo para aprobar o rechazar. */
export function Pedidos({ pedidos, conNombre = true }: { pedidos: Pedido[]; conNombre?: boolean }) {
  if (!pedidos.length) return <p className="vacio" style={{ padding: 12 }}>No hay pedidos pendientes.</p>;
  return (
    <div>
      {pedidos.map((p) => {
        const d = p.detalle as Record<string, string & number>;
        let texto = '';
        if (p.tipo === 'vacaciones') texto = `Del ${fecha(d.desde)} al ${fecha(d.hasta)} · ${d.dias} días${d.nota ? ` · ${d.nota}` : ''}`;
        if (p.tipo === 'adelanto') texto = `${pesos(d.monto, 0)}${d.motivo ? ` · ${d.motivo}` : ''}`;
        if (p.tipo === 'uniforme') texto = `${d.cantidad} × ${d.prenda}${d.talle ? ` (talle ${d.talle})` : ''}${d.nota ? ` · ${d.nota}` : ''}`;
        if (p.tipo === 'certificado') texto = `Del ${fecha(d.desde)} al ${fecha(d.hasta)}${d.motivo ? ` · ${d.motivo}` : ''}`;
        return (
          <div className="pedido" key={`${p.tipo}-${p.id}`}>
            <div className="que">
              <b>{TITULO[p.tipo]}</b>
              {conNombre && (
                <>
                  {' · '}
                  <Link href={`/equipo/${p.empleado_id}`}>{nombreCompleto(p)}</Link>
                </>
              )}
              <small>{texto}</small>
            </div>
            <div className="acciones">
              {p.tipo === 'vacaciones' && (
                <>
                  <BotonAccion accion={resolverVacaciones} campos={{ id: p.id, estado: 'aprobada' }} className="btn chico bien">Aprobar</BotonAccion>
                  <BotonAccion accion={resolverVacaciones} campos={{ id: p.id, estado: 'rechazada' }} className="btn chico claro" confirmar="¿Rechazar este pedido de vacaciones?">Rechazar</BotonAccion>
                </>
              )}
              {p.tipo === 'adelanto' && (
                <>
                  <BotonAccion accion={resolverAdelanto} campos={{ id: p.id, estado: 'aprobado' }} className="btn chico bien" confirmar={`¿Aprobar el adelanto de ${pesos(d.monto, 0)}? Queda como pagado hoy y se descuenta del sueldo de este mes.`}>
                    Aprobar y pagar
                  </BotonAccion>
                  <BotonAccion accion={resolverAdelanto} campos={{ id: p.id, estado: 'rechazado' }} className="btn chico claro" confirmar="¿Rechazar este adelanto?">Rechazar</BotonAccion>
                </>
              )}
              {p.tipo === 'uniforme' && (
                <>
                  <BotonAccion accion={resolverUniforme} campos={{ id: p.id, estado: 'entregado' }} className="btn chico bien">Entregado hoy</BotonAccion>
                  <BotonAccion accion={resolverUniforme} campos={{ id: p.id, estado: 'rechazado' }} className="btn chico claro" confirmar="¿Rechazar este pedido?">Rechazar</BotonAccion>
                </>
              )}
              {p.tipo === 'certificado' && (
                <>
                  {d.archivo && <a className="btn chico claro" href={`/api/archivos/${d.archivo}`} target="_blank" rel="noopener">Ver</a>}
                  <BotonAccion accion={certificadoVisto} campos={{ id: p.id }} className="btn chico bien">Visto</BotonAccion>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
