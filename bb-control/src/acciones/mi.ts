'use server';
// Lo que cada persona del equipo pide desde su app. Siempre sobre su propio id de sesión.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { guardarArchivo } from '@/lib/archivos';
import { db } from '@/lib/db';
import { hoy } from '@/lib/formato';
import { type Estado, entero, falla, fechaForm, intentar, numero, texto } from '@/lib/form';
import { permitir } from '@/lib/limite';
import { empleadoSesion } from '@/lib/sesion';

async function yo() {
  const id = await empleadoSesion();
  if (!id) redirect('/mi');
  const [e] = await db()`select id from empleados where id = ${id} and activo`;
  if (!e) redirect('/mi');
  if (!permitir(`mi:${id}`, 30, 3600)) falla('Hiciste muchos pedidos seguidos. Probá más tarde.');
  return id;
}

const listo = () => {
  revalidatePath('/mi');
  revalidatePath('/equipo');
};

export async function pedirVacaciones(_: Estado, f: FormData): Promise<Estado> {
  return intentar(async () => {
    const id = await yo();
    const desde = fechaForm(f, 'desde', 'Poné desde cuándo.')!;
    const hasta = fechaForm(f, 'hasta', 'Poné hasta cuándo.')!;
    if (hasta < desde) falla('La fecha de vuelta tiene que ser después de la de salida.');
    if (desde < hoy()) falla('Las vacaciones se piden para fechas que todavía no pasaron.');
    await db()`insert into vacaciones (empleado_id, desde, hasta, nota) values (${id}, ${desde}, ${hasta}, ${texto(f, 'nota', 300)})`;
    listo();
    return { ok: '¡Listo! Te avisamos cuando lo aprueben.' };
  });
}

export async function cancelarVacaciones(f: FormData) {
  const id = await yo();
  await db()`update vacaciones set estado = 'cancelada', resuelto = now()
             where id = ${entero(f, 'id') ?? 0} and empleado_id = ${id} and estado = 'pendiente'`;
  listo();
}

export async function pedirAdelanto(_: Estado, f: FormData): Promise<Estado> {
  return intentar(async () => {
    const id = await yo();
    const monto = numero(f, 'monto', { requerido: 'Poné el monto.', min: 1, max: 100_000_000 });
    const [p] = await db()`select count(*) n from adelantos where empleado_id = ${id} and estado = 'pendiente'`;
    if (Number(p.n) >= 2) falla('Ya tenés pedidos de adelanto esperando respuesta.');
    await db()`insert into adelantos (empleado_id, monto, motivo) values (${id}, ${monto}, ${texto(f, 'motivo', 300)})`;
    listo();
    return { ok: 'Pedido enviado. Te avisamos cuando lo aprueben.' };
  });
}

export async function subirCertificado(_: Estado, f: FormData): Promise<Estado> {
  return intentar(async () => {
    const id = await yo();
    const desde = fechaForm(f, 'desde', 'Poné desde qué día.')!;
    const hasta = fechaForm(f, 'hasta') ?? desde;
    if (hasta < desde) falla('Revisá las fechas.');
    const archivo = await guardarArchivo(f, 'archivo', 'Sacale una foto al certificado o subí el PDF.');
    await db()`insert into certificados (empleado_id, desde, hasta, motivo, archivo_id)
               values (${id}, ${desde}, ${hasta}, ${texto(f, 'motivo', 300)}, ${archivo})`;
    listo();
    return { ok: 'Certificado enviado. ¡Que te mejores!' };
  });
}

export async function pedirUniforme(_: Estado, f: FormData): Promise<Estado> {
  return intentar(async () => {
    const id = await yo();
    const prenda = texto(f, 'prenda', 80) || falla('Elegí qué necesitás.');
    await db()`insert into uniformes (empleado_id, prenda, talle, cantidad, nota)
               values (${id}, ${prenda}, ${texto(f, 'talle', 10)}, ${numero(f, 'cantidad', { min: 1, max: 10, dec: 0 }) || 1}, ${texto(f, 'nota', 300)})`;
    listo();
    return { ok: 'Pedido enviado.' };
  });
}

export async function actualizarMisDatos(_: Estado, f: FormData): Promise<Estado> {
  return intentar(async () => {
    const id = await yo();
    const d = {
      telefono: texto(f, 'telefono', 30),
      mail: texto(f, 'mail', 120),
      direccion: texto(f, 'direccion', 200),
      emergencia: texto(f, 'emergencia', 200),
      obra_social: texto(f, 'obra_social', 80),
      cbu: texto(f, 'cbu', 60),
      talle_remera: texto(f, 'talle_remera', 10),
      talle_pantalon: texto(f, 'talle_pantalon', 10),
      talle_calzado: texto(f, 'talle_calzado', 10),
    };
    const sql = db();
    await sql`update empleados set ${sql(d)} where id = ${id}`;
    listo();
    return { ok: 'Datos guardados.' };
  });
}
