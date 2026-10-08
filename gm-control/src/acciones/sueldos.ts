'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { hoy, sumarMeses } from '@/lib/formato';
import { type Estado, entero, falla, fechaForm, intentar, numero, texto, tilde, volver } from '@/lib/form';
import { exigirAdmin } from '@/lib/sesion';

const mesValido = (s: string) => (/^\d{4}-(0[1-9]|1[0-2])$/.test(s) ? s : null);

/** Crea los sueldos del mes para todo el equipo activo, con su sueldo de referencia y los adelantos a descontar. */
export async function armarMes(f: FormData) {
  await exigirAdmin();
  const mes = mesValido(texto(f, 'mes', 7));
  if (!mes) return;
  const desde = `${mes}-01`;
  const hasta = `${sumarMeses(mes, 1)}-01`;
  await db()`
    insert into sueldos (empleado_id, periodo, bruto, neto, descuentos)
    select e.id, ${desde}::date, e.sueldo_bruto, e.sueldo_neto,
           coalesce((select sum(a.monto) from adelantos a where a.empleado_id = e.id and a.estado = 'aprobado' and a.descontar_en = ${desde}::date), 0)
    from empleados e
    where (e.ingreso is null or e.ingreso < ${hasta}::date)
      and (e.egreso is null or e.egreso >= ${desde}::date)
      and (e.activo or e.egreso is not null)
      and not exists (select 1 from sueldos s where s.empleado_id = e.id and s.periodo = ${desde}::date)`;
  revalidatePath('/sueldos');
}

export async function guardarSueldo(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const empleado_id = entero(f, 'empleado_id') ?? falla('Elegí a la persona.');
    const mes = mesValido(texto(f, 'mes', 7)) ?? falla('Falta el mes.');
    const pagado = tilde(f, 'pagado');
    const s = {
      bruto: numero(f, 'bruto', { min: 0 }),
      neto: numero(f, 'neto', { min: 0 }),
      extras: numero(f, 'extras'),
      descuentos: numero(f, 'descuentos', { min: 0 }),
      pagado,
      fecha_pago: pagado ? (fechaForm(f, 'fecha_pago') ?? hoy()) : null,
      medio_pago: texto(f, 'medio_pago', 40),
      notas: texto(f, 'notas', 500),
    };
    const sql = db();
    await sql`
      insert into sueldos ${sql({ ...s, empleado_id, periodo: `${mes}-01` })}
      on conflict (empleado_id, periodo) do update set
        bruto = excluded.bruto, neto = excluded.neto, extras = excluded.extras, descuentos = excluded.descuentos,
        pagado = excluded.pagado, fecha_pago = excluded.fecha_pago, medio_pago = excluded.medio_pago, notas = excluded.notas`;
    revalidatePath('/sueldos');
    redirect(volver(f, `/sueldos?p=${mes}`));
  });
}

export async function pagarSueldo(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (id) await db()`update sueldos set pagado = true, fecha_pago = ${hoy()} where id = ${id}`;
  revalidatePath('/sueldos');
}

export async function pagarTodos(f: FormData) {
  await exigirAdmin();
  const mes = mesValido(texto(f, 'mes', 7));
  if (mes) await db()`update sueldos set pagado = true, fecha_pago = ${hoy()} where periodo = ${`${mes}-01`} and not pagado`;
  revalidatePath('/sueldos');
}

export async function borrarSueldo(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (id) await db()`delete from sueldos where id = ${id}`;
  revalidatePath('/sueldos');
}
