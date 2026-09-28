import { soloAdmin } from '@/lib/admin';
import { todosLosVisitantes, todosLosCanjes, todasLasMarcas } from '@/lib/datos';
import { diaHora } from '@/lib/formato';

const celda = (v: unknown) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // evita fórmulas al abrirlo en una planilla
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(_: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const no = await soloAdmin();
  if (no) return no;
  const { tipo } = await params;
  let filas: unknown[][];
  if (tipo === 'visitantes') {
    const [vs, cs] = await Promise.all([todosLosVisitantes(), todosLosCanjes()]);
    const n = new Map<string, number>();
    for (const c of cs) n.set(c.visitante_id, (n.get(c.visitante_id) || 0) + 1);
    filas = [
      ['Nombre', 'Nacimiento', 'Mail', 'WhatsApp', 'Registro', 'Canjes', 'Acepta novedades'],
      ...vs.map((v) => [v.nombre, v.nacimiento, v.mail || '', v.whatsapp || '', v.created_at, n.get(v.id) || 0, v.novedades ? 'Sí' : 'No']),
    ];
  } else if (tipo === 'canjes') {
    const [cs, ms, vs] = await Promise.all([todosLosCanjes(), todasLasMarcas(), todosLosVisitantes()]);
    const mn = new Map(ms.map((m) => [m.id, m.nombre]));
    const vn = new Map(vs.map((v) => [v.id, v.nombre]));
    filas = [
      ['N°', 'Fecha', 'Día y hora', 'Cafetería', 'Beneficio', 'Visitante', 'Dónde'],
      ...cs.map((c) => [c.numero, c.created_at, diaHora(c.created_at), mn.get(c.marca_id) || '', c.beneficio, vn.get(c.visitante_id) || '', c.post_evento ? 'Sucursal' : 'Mundial']),
    ];
  } else return new Response('No existe', { status: 404 });

  const csv = '﻿' + filas.map((f) => f.map(celda).join(',')).join('\r\n');
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${tipo}-mundial-cafe.csv"`,
      'cache-control': 'no-store',
    },
  });
}
