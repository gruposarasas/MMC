import { NextResponse } from 'next/server';
import { esAdminVP, cuentaCorriente, todasLasTarjetas, locales, linkTarjeta, respuestaCsv, filasMetricas } from '@/lib/vistapueblo-servidor';
import { estadoTarjeta, ESTADOS, dondeVale, diaHora, nombreMes, mesActual, nombreDe, MODOS, FECHA_RE } from '@/lib/vistapueblo';

/** Descargas para Excel: cuenta corriente del mes (resumen y detalle) o la lista de gift cards. */
export async function GET(req: Request) {
  if (!(await esAdminVP())) return new NextResponse('Sesión vencida', { status: 401 });
  const u = new URL(req.url);
  const tipo = u.searchParams.get('tipo');
  let nombre = 'vistapueblo.csv';
  let filas: unknown[][] = [];
  if (tipo === 'metricas') {
    const desde = u.searchParams.get('desde') || '', hasta = u.searchParams.get('hasta') || '';
    if (!FECHA_RE.test(desde) || !FECHA_RE.test(hasta)) return new NextResponse('Fechas inválidas', { status: 400 });
    const r = await filasMetricas(desde, hasta, u.searchParams.get('local') || undefined);
    return respuestaCsv(r.nombre, r.filas);
  }
  if (tipo === 'tarjetas') {
    const [ts, ls] = await Promise.all([todasLasTarjetas(), locales()]);
    nombre = 'Vistapueblo - Gift cards.csv';
    filas = [['N°', 'Nombre', 'Mail', 'WhatsApp', 'Monto', 'Saldo', 'Vence', 'Dónde vale', 'Uso', 'Tipo', 'Estado', 'Código', 'Link', 'Lote', 'Creada']];
    for (const t of ts) filas.push([t.numero, nombreDe(t.nombre), t.mail, t.whatsapp, t.monto, t.saldo, t.vence, dondeVale(t.todos_los_locales, t.locales, ls), MODOS[t.modo].titulo, t.impresa ? 'Impresa' : 'Digital', ESTADOS[estadoTarjeta(t)], t.codigo, linkTarjeta(t.token), t.lote, diaHora(t.created_at)]);
  } else {
    const mes = /^\d{4}-\d{2}$/.test(u.searchParams.get('mes') || '') ? u.searchParams.get('mes')! : mesActual();
    const local = u.searchParams.get('local') || '';
    const cc = await cuentaCorriente(mes);
    nombre = `Vistapueblo - Cuenta corriente ${mes}${local ? ` - ${cc.filas.find((f) => f.id === local)?.nombre ?? ''}` : ''}.csv`;
    filas = [[`Cuenta corriente de gift cards · ${nombreMes(mes)}`], [], ['Local', '% que absorbe', 'Consumos', 'Total consumido', 'Absorbe el local', 'A cargo de Vistapueblo (descontar del alquiler)', 'Venta total (tickets)']];
    for (const f of cc.filas.filter((f) => !local || f.id === local)) filas.push([f.nombre, f.porcentaje, f.cantidad, f.consumido, f.local, f.vp, f.ventas]);
    if (!local) filas.push(['Total', '', cc.total.cantidad, cc.total.consumido, cc.total.local, cc.total.vp, cc.total.ventas]);
    filas.push([], ['Detalle'], ['N° consumo', 'Fecha y hora', 'Local', 'Gift card', 'Cliente', 'Cajero', 'Personas', 'Ticket', 'Con gift card', '%', 'Absorbe el local', 'A cargo de Vistapueblo', 'Estado']);
    for (const c of cc.consumos.filter((c) => !local || c.local_id === local)) {
      filas.push([c.numero, diaHora(c.created_at), c.local, c.tarjeta?.numero ?? '', c.tarjeta?.nombre ?? '', c.cajero, c.personas ?? '', c.ticket, c.monto, c.porcentaje, c.anulado ? 0 : c.a_cargo_local, c.anulado ? 0 : c.a_cargo_vp, c.anulado ? `Anulado${c.anulado_motivo ? `: ${c.anulado_motivo}` : ''}` : 'OK']);
    }
  }
  return respuestaCsv(nombre, filas);
}
