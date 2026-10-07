'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { guardarArchivo } from '@/lib/archivos';
import { db } from '@/lib/db';
import { hoy, soloDigitos } from '@/lib/formato';
import { type Estado, entero, falla, fechaForm, intentar, numero, texto, volver } from '@/lib/form';
import { exigirAdmin, hashClave, nuevaClave } from '@/lib/sesion';

const refrescar = (id?: number | null) => {
  revalidatePath('/equipo');
  if (id) revalidatePath(`/equipo/${id}`);
  revalidatePath('/sueldos');
};

export async function guardarEmpleado(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, 'id');
    const diasTxt = texto(f, 'dias_vacaciones', 4);
    const e = {
      nombre: texto(f, 'nombre', 60) || falla('Poné el nombre.'),
      apellido: texto(f, 'apellido', 60),
      dni: soloDigitos(texto(f, 'dni', 20)) || null,
      cuil: texto(f, 'cuil', 20),
      nacimiento: fechaForm(f, 'nacimiento'),
      ingreso: fechaForm(f, 'ingreso'),
      puesto: texto(f, 'puesto', 60),
      area: texto(f, 'area', 60),
      telefono: texto(f, 'telefono', 30),
      mail: texto(f, 'mail', 120),
      direccion: texto(f, 'direccion', 200),
      emergencia: texto(f, 'emergencia', 200),
      obra_social: texto(f, 'obra_social', 80),
      cbu: texto(f, 'cbu', 60),
      talle_remera: texto(f, 'talle_remera', 10),
      talle_pantalon: texto(f, 'talle_pantalon', 10),
      talle_calzado: texto(f, 'talle_calzado', 10),
      sueldo_bruto: numero(f, 'sueldo_bruto', { min: 0 }),
      sueldo_neto: numero(f, 'sueldo_neto', { min: 0 }),
      dias_vacaciones: diasTxt ? numero(f, 'dias_vacaciones', { min: 0, max: 60, dec: 0 }) : null,
      notas: texto(f, 'notas', 2000),
    };
    if (e.dni && (e.dni.length < 7 || e.dni.length > 9)) falla('Revisá el DNI.');
    const sql = db();
    if (e.dni) {
      const [otro] = await sql`select id from empleados where dni = ${e.dni} and id is distinct from ${id}`;
      if (otro) falla('Ya hay otra persona con ese DNI.');
    }
    let nuevoId = id;
    if (id) await sql`update empleados set ${sql(e)} where id = ${id}`;
    else [{ id: nuevoId }] = (await sql`insert into empleados ${sql(e)} returning id`) as unknown as { id: number }[];
    refrescar(nuevoId);
    redirect(id ? volver(f, `/equipo/${id}`) : `/equipo/${nuevoId}`);
  });
}

export async function cambiarActivo(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (!id) return;
  if (texto(f, 'activo') === '1') await db()`update empleados set activo = true, egreso = null where id = ${id}`;
  else await db()`update empleados set activo = false, egreso = coalesce(egreso, ${hoy()}), clave_hash = null where id = ${id}`;
  refrescar(id);
}

/** Genera una clave nueva para la app del equipo y la devuelve una sola vez. */
export async function generarClave(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (!id) return { error: 'Falta la persona.' };
  const [e] = await db()`select dni from empleados where id = ${id}`;
  if (!e?.dni) return { error: 'Primero cargá el DNI: es el usuario para entrar a la app.' };
  const clave = nuevaClave();
  await db()`update empleados set clave_hash = ${hashClave(clave)} where id = ${id}`;
  revalidatePath(`/equipo/${id}`);
  return { ok: 'Clave generada', clave };
}

// ---------- vacaciones ----------
export async function cargarVacaciones(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const empleado_id = entero(f, 'empleado_id') ?? falla('Falta la persona.');
    const desde = fechaForm(f, 'desde', 'Poné desde cuándo.')!;
    const hasta = fechaForm(f, 'hasta', 'Poné hasta cuándo.')!;
    if (hasta < desde) falla('La fecha de vuelta tiene que ser después de la de salida.');
    await db()`insert into vacaciones (empleado_id, desde, hasta, estado, nota, resuelto)
               values (${empleado_id}, ${desde}, ${hasta}, 'aprobada', ${texto(f, 'nota', 300)}, now())`;
    refrescar(empleado_id);
    return { ok: 'Vacaciones cargadas.' };
  });
}

export async function resolverVacaciones(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  const estado = texto(f, 'estado');
  if (!id || !['aprobada', 'rechazada', 'cancelada'].includes(estado)) return;
  const [r] = await db()`update vacaciones set estado = ${estado}, respuesta = ${texto(f, 'respuesta', 300)}, resuelto = now()
                         where id = ${id} returning empleado_id`;
  refrescar(r?.empleado_id as number);
}

// ---------- adelantos ----------
export async function cargarAdelanto(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const empleado_id = entero(f, 'empleado_id') ?? falla('Falta la persona.');
    const monto = numero(f, 'monto', { requerido: 'Poné el monto.', min: 1 });
    const mes = texto(f, 'descontar_en', 7);
    await db()`insert into adelantos (empleado_id, monto, motivo, estado, fecha_pago, descontar_en, resuelto)
               values (${empleado_id}, ${monto}, ${texto(f, 'motivo', 300)}, 'aprobado', ${fechaForm(f, 'fecha_pago') ?? hoy()},
                       ${/^\d{4}-\d{2}$/.test(mes) ? `${mes}-01` : null}, now())`;
    refrescar(empleado_id);
    return { ok: 'Adelanto cargado.' };
  });
}

export async function resolverAdelanto(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  const estado = texto(f, 'estado');
  if (!id || !['aprobado', 'rechazado'].includes(estado)) return;
  const mes = texto(f, 'descontar_en', 7) || hoy().slice(0, 7);
  const [r] = await db()`
    update adelantos set estado = ${estado}, respuesta = ${texto(f, 'respuesta', 300)}, resuelto = now(),
      fecha_pago = ${estado === 'aprobado' ? hoy() : null},
      descontar_en = ${estado === 'aprobado' && /^\d{4}-\d{2}$/.test(mes) ? `${mes}-01` : null}
    where id = ${id} returning empleado_id`;
  refrescar(r?.empleado_id as number);
}

export async function borrarAdelanto(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  const [r] = await db()`delete from adelantos where id = ${id ?? 0} returning empleado_id`;
  refrescar(r?.empleado_id as number);
}

// ---------- uniformes ----------
export async function cargarUniforme(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const empleado_id = entero(f, 'empleado_id') ?? falla('Falta la persona.');
    const prenda = texto(f, 'prenda', 80) || falla('Poné qué prenda se entregó.');
    await db()`insert into uniformes (empleado_id, prenda, talle, cantidad, estado, fecha_entrega, nota)
               values (${empleado_id}, ${prenda}, ${texto(f, 'talle', 10)}, ${numero(f, 'cantidad', { min: 1, dec: 0 }) || 1},
                       'entregado', ${fechaForm(f, 'fecha_entrega') ?? hoy()}, ${texto(f, 'nota', 300)})`;
    refrescar(empleado_id);
    return { ok: 'Entrega registrada.' };
  });
}

export async function resolverUniforme(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  const estado = texto(f, 'estado');
  if (!id || !['entregado', 'rechazado'].includes(estado)) return;
  const [r] = await db()`update uniformes set estado = ${estado}, fecha_entrega = ${estado === 'entregado' ? hoy() : null}
                         where id = ${id} returning empleado_id`;
  refrescar(r?.empleado_id as number);
}

export async function borrarUniforme(f: FormData) {
  await exigirAdmin();
  const [r] = await db()`delete from uniformes where id = ${entero(f, 'id') ?? 0} returning empleado_id`;
  refrescar(r?.empleado_id as number);
}

// ---------- certificados ----------
export async function cargarCertificado(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const empleado_id = entero(f, 'empleado_id') ?? falla('Falta la persona.');
    const desde = fechaForm(f, 'desde', 'Poné desde cuándo.')!;
    const hasta = fechaForm(f, 'hasta') ?? desde;
    if (hasta < desde) falla('Revisá las fechas.');
    const archivo = await guardarArchivo(f, 'archivo');
    await db()`insert into certificados (empleado_id, desde, hasta, motivo, archivo_id, visto)
               values (${empleado_id}, ${desde}, ${hasta}, ${texto(f, 'motivo', 300)}, ${archivo}, true)`;
    refrescar(empleado_id);
    return { ok: 'Certificado cargado.' };
  });
}

export async function certificadoVisto(f: FormData) {
  await exigirAdmin();
  const [r] = await db()`update certificados set visto = true where id = ${entero(f, 'id') ?? 0} returning empleado_id`;
  refrescar(r?.empleado_id as number);
}

export async function borrarCertificado(f: FormData) {
  await exigirAdmin();
  const sql = db();
  const [r] = await sql`delete from certificados where id = ${entero(f, 'id') ?? 0} returning empleado_id, archivo_id`;
  if (r?.archivo_id) await sql`delete from archivos where id = ${r.archivo_id as string}`;
  refrescar(r?.empleado_id as number);
}
