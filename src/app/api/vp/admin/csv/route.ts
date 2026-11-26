import { NextResponse } from 'next/server';
import { esAdminVP, cuentaCorriente, todasLasTarjetas, locales, linkTarjeta } from '@/lib/vistapueblo-servidor';
import { estadoTarjeta, ESTADOS, dondeVale, diaHora, nombreMes, mesActual } from '@/lib/vistapueblo';

const celda = (v: unknown) => {
  const s = String(v ?? '');
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
// Punto y coma y BOM: Excel en español lo abre bien con doble clic.
const csv = (filas: unknown[][]) => '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n');

/** Descargas para Excel: cuenta corriente del mes (resumen y detalle) o la lista de gift cards. */
export async function GET(req: Request) {
  if (!(await esAdminVP())) return new NextResponse('Sesión vencida', { status: 401 });
  const u = new URL(req.url);
  const tipo = u.searchParams.get('tipo');
  let nombre = 'vistapueblo.csv';
  let filas: unknown[][] = [];
  if (tipo === 'tarjetas') {
    const [ts, ls] = await Promise.all([todasLasTarjetas(), locales()]);
    nombre = 'Vistapueblo - Gift cards.csv';
    filas = [['N°', 'Nombre', 'Mail', 'WhatsApp', 'Monto', 'Saldo', 'Vence', 'Dónde vale', 'Estado', 'Código', 'Link', 'Lote', 'Creada']];
    for (const t of ts) filas.push([t.numero, t.nombre, t.mail, t.whatsapp, t.monto, t.saldo, t.vence, dondeVale(t.todos_los_locales, t.locales, ls), ESTADOS[estadoTarjeta(t)], t.codigo, linkTarjeta(t.token), t.lote, diaHora(t.created_at)]);
  } else {
    const mes = /^\d{4}-\d{2}$/.test(u.searchParams.get('mes') || '') ? u.searchParams.get('mes')! : mesActual();
    const local = u.searchParams.get('local') || '';
    const cc = await cuentaCorriente(mes);
    nombre = `Vistapueblo - Cuenta corriente ${mes}${local ? ` - ${cc.filas.find((f) => f.id === local)?.nombre ?? ''}` : ''}.csv`;
    filas = [[`Cuenta corriente de gift cards · ${nombreMes(mes)}`], [], ['Local', '% que absorbe', 'Consumos', 'Total consumido', 'Absorbe el local', 'A cargo de Vistapueblo (descontar del alquiler)']];
    for (const f of cc.filas.filter((f) => !local || f.id === local)) filas.push([f.nombre, f.porcentaje, f.cantidad, f.consumido, f.local, f.vp]);
    if (!local) filas.push(['Total', '', cc.total.cantidad, cc.total.consumido, cc.total.local, cc.total.vp]);
    filas.push([], ['Detalle'], ['N° consumo', 'Fecha y hora', 'Local', 'Gift card', 'Cliente', 'Cajero', 'Monto', '%', 'Absorbe el local', 'A cargo de Vistapueblo', 'Estado']);
    for (const c of cc.consumos.filter((c) => !local || c.local_id === local)) {
      filas.push([c.numero, diaHora(c.created_at), c.local, c.tarjeta?.numero ?? '', c.tarjeta?.nombre ?? '', c.cajero, c.monto, c.porcentaje, c.anulado ? 0 : c.a_cargo_local, c.anulado ? 0 : c.a_cargo_vp, c.anulado ? `Anulado${c.anulado_motivo ? `: ${c.anulado_motivo}` : ''}` : 'OK']);
    }
  }
  return new NextResponse(csv(filas), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nombre)}`, 'Cache-Control': 'no-store' },
  });
}
