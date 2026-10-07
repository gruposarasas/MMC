// Consultas del equipo que se usan en varias pantallas. Solo servidor.
import { db } from './db';
import { hoy } from './formato';
import { proximoCumple } from './vacaciones';

export type Persona = { id: number; nombre: string; apellido: string; nacimiento: string | null; puesto: string };

export async function cumpleanos(dias: number) {
  const h = hoy();
  const gente = await db()<Persona[]>`select id, nombre, apellido, nacimiento, puesto from empleados where activo and nacimiento is not null`;
  return gente
    .map((p) => ({ ...p, ...proximoCumple(p.nacimiento!, h) }))
    .filter((p) => p.faltan <= dias)
    .sort((a, b) => a.faltan - b.faltan);
}

export type Pedido = {
  tipo: 'vacaciones' | 'adelanto' | 'uniforme' | 'certificado';
  id: number;
  empleado_id: number;
  nombre: string;
  apellido: string;
  creado: string;
  detalle: Record<string, unknown>;
};

export async function pedidosPendientes(empleado?: number): Promise<Pedido[]> {
  const sql = db();
  const filtro = empleado ? sql`and x.empleado_id = ${empleado}` : sql``;
  const filas = await sql<Pedido[]>`
    select x.*, e.nombre, e.apellido from (
      select 'vacaciones' tipo, v.id, v.empleado_id, v.creado, jsonb_build_object('desde', v.desde, 'hasta', v.hasta, 'dias', v.dias, 'nota', v.nota) detalle
        from vacaciones v where v.estado = 'pendiente'
      union all
      select 'adelanto', a.id, a.empleado_id, a.creado, jsonb_build_object('monto', a.monto, 'motivo', a.motivo) from adelantos a where a.estado = 'pendiente'
      union all
      select 'uniforme', u.id, u.empleado_id, u.creado, jsonb_build_object('prenda', u.prenda, 'talle', u.talle, 'cantidad', u.cantidad, 'nota', u.nota)
        from uniformes u where u.estado = 'pedido'
      union all
      select 'certificado', c.id, c.empleado_id, c.creado, jsonb_build_object('desde', c.desde, 'hasta', c.hasta, 'motivo', c.motivo, 'archivo', c.archivo_id)
        from certificados c where not c.visto
    ) x join empleados e on e.id = x.empleado_id
    where true ${filtro}
    order by x.creado`;
  return filas;
}
