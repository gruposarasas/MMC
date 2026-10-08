'use server';
// Contabilidad: el contador y administración cargan; solo administración marca pagado y da accesos.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { guardarArchivoContable } from '@/lib/archivos';
import { anotar, describirCarga, esTipo, exigirContabilidad, sincronizarGasto, TIPOS, versionClave } from '@/lib/contabilidad';
import { db } from '@/lib/db';
import { type Estado, entero, falla, fechaForm, intentar, numero, texto, tilde } from '@/lib/form';
import { fecha, hoy } from '@/lib/formato';
import { ip, permitir } from '@/lib/limite';
import { limpiarCuit } from '@/lib/proveedores';
import { COOKIE_CONTADOR, borrar, claveContador, claveCorrecta, escribir, exigirAdmin, hashClave } from '@/lib/sesion';

const listo = () => {
  revalidatePath('/contabilidad', 'layout');
  revalidatePath('/gastos');
  revalidatePath('/kpi');
};

/** Mes, razón social y tipo de una obligación, validados. */
async function clave(f: FormData) {
  const mes = texto(f, 'mes', 7);
  if (!/^20\d\d-(0[1-9]|1[0-2])$/.test(mes)) falla('Elegí el mes.');
  const tipo = texto(f, 'tipo', 10);
  if (!esTipo(tipo)) falla('Elegí qué obligación es.');
  const razon_id = entero(f, 'razon_id') ?? falla('Elegí la razón social.');
  if (!(await db()`select 1 from razones_sociales where id = ${razon_id} and activo`).length) falla('Elegí la razón social.');
  return { mes: `${mes}-01`, tipo: tipo as keyof typeof TIPOS, razon_id };
}

export async function guardarObligacion(_: Estado, f: FormData): Promise<Estado> {
  const q = await exigirContabilidad();
  return intentar(async () => {
    const k = await clave(f);
    const monto = numero(f, 'monto', { requerido: 'Poné el monto (0 si no hay que pagar nada).', min: 0 });
    const vencimiento = fechaForm(f, 'vencimiento');
    const nota = texto(f, 'nota', 500);
    await db().begin(async (tx) => {
      const [o] = await tx`
        insert into contab_obligaciones (mes, razon_id, tipo, monto, vencimiento, nota, cargado_por)
        values (${k.mes}, ${k.razon_id}, ${k.tipo}, ${monto}, ${vencimiento}, ${nota}, ${q.nombre})
        on conflict (mes, razon_id, tipo) do update set monto = excluded.monto, vencimiento = excluded.vencimiento, nota = excluded.nota,
          cargado_por = excluded.cargado_por, actualizado = now()
        where contab_obligaciones.pagado_el is null
        returning id, (xmax = 0) nuevo`;
      if (!o) falla('Ya está pagada: no se puede cambiar.');
      await anotar(tx, o.id as number, q.nombre, `${o.nuevo ? 'Cargó' : 'Cambió a'} ${describirCarga(monto, vencimiento)}${nota ? ` (${nota})` : ''}`);
      await sincronizarGasto(tx, o.id as number);
    });
    listo();
    return { ok: 'Guardado.' };
  });
}

export async function subirArchivoContable(_: unknown, f: FormData): Promise<Estado> {
  const q = await exigirContabilidad();
  return intentar(async () => {
    const k = await clave(f);
    if (!permitir(`contab-archivo:${await ip()}`, 60, 600)) falla('Subiste muchos archivos seguidos. Probá en unos minutos.');
    const sql = db();
    // Se puede subir el archivo antes de cargar el monto.
    await sql`insert into contab_obligaciones (mes, razon_id, tipo, cargado_por) values (${k.mes}, ${k.razon_id}, ${k.tipo}, ${q.nombre})
              on conflict (mes, razon_id, tipo) do nothing`;
    const [o] = await sql`select id, pagado_el from contab_obligaciones where mes = ${k.mes} and razon_id = ${k.razon_id} and tipo = ${k.tipo}`;
    if (o.pagado_el) falla('Ya está pagada: no se le agregan archivos.');
    const archivo = await guardarArchivoContable(f, 'archivo');
    await sql.begin(async (tx) => {
      await tx`insert into contab_archivos (obligacion_id, archivo_id, subido_por) values (${o.id as number}, ${archivo}, ${q.nombre})`;
      const [a] = await tx`select nombre from archivos where id = ${archivo}`;
      await anotar(tx, o.id as number, q.nombre, `Subió ${a.nombre}`);
    });
    listo();
    return { ok: 'Archivo subido.' };
  });
}

export async function quitarArchivoContable(f: FormData) {
  const q = await exigirContabilidad();
  const id = entero(f, 'id');
  if (!id) return;
  await db().begin(async (tx) => {
    const [a] = await tx`
      select ca.obligacion_id, ca.archivo_id, ar.nombre from contab_archivos ca
      join contab_obligaciones o on o.id = ca.obligacion_id join archivos ar on ar.id = ca.archivo_id
      where ca.id = ${id} and o.pagado_el is null`;
    if (!a) return; // pagada: no se quitan archivos
    await tx`delete from archivos where id = ${a.archivo_id as string}`;
    await anotar(tx, a.obligacion_id as number, q.nombre, `Quitó ${a.nombre}`);
  });
  listo();
}

/** Borra lo cargado (si no está pagada), con sus archivos y el gasto que había generado. */
export async function borrarObligacion(f: FormData) {
  await exigirContabilidad();
  const id = entero(f, 'id');
  if (!id) return;
  await db().begin(async (tx) => {
    const archivos = (await tx`select archivo_id from contab_archivos where obligacion_id = ${id}`).map((a) => a.archivo_id as string);
    const [o] = await tx`delete from contab_obligaciones where id = ${id} and pagado_el is null returning egreso_id`;
    if (!o) return;
    if (o.egreso_id) await tx`delete from egresos where id = ${o.egreso_id as number}`;
    if (archivos.length) await tx`delete from archivos where id in ${tx(archivos)}`;
  });
  listo();
}

// ---------- solo administración ----------
export async function marcarObligacionPagada(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (!id) return;
  const pagada = f.get('pagada') !== 'no';
  await db().begin(async (tx) => {
    const r = pagada
      ? await tx`update contab_obligaciones set pagado_el = ${hoy()}, pagado_por = 'Administración' where id = ${id} and monto is not null and pagado_el is null returning id`
      : await tx`update contab_obligaciones set pagado_el = null, pagado_por = '' where id = ${id} and pagado_el is not null returning id`;
    if (!r.length) return;
    await anotar(tx, id, 'Administración', pagada ? `La marcó pagada el ${fecha(hoy())}` : 'Volvió a pendiente');
    await sincronizarGasto(tx, id);
  });
  listo();
}

export async function fijarCobertura(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  const valor = texto(f, 'valor', 10);
  if (!id) return;
  await db()`update empleados set cobertura = ${valor === 'art' || valor === 'seguro' ? valor : null} where id = ${id}`;
  revalidatePath('/contabilidad/equipo');
}

export async function guardarRazonSocial(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, 'id');
    const nombre = texto(f, 'nombre', 80).replace(/\s+/g, ' ');
    if (nombre.length < 2) falla('Poné el nombre de la razón social.');
    const cuit = limpiarCuit(texto(f, 'cuit', 20));
    if (cuit && cuit.length !== 11) falla('El CUIT tiene que tener 11 números.');
    const sql = db();
    const [otra] = await sql`select id from razones_sociales where lower(nombre) = lower(${nombre}) and id <> ${id ?? 0}`;
    if (otra) falla('Ya hay una razón social con ese nombre.');
    if (id) {
      const activo = tilde(f, 'activo');
      if (!activo && !(await sql`select 1 from razones_sociales where activo and id <> ${id}`).length) falla('Tiene que quedar al menos una razón social activa.');
      await sql`update razones_sociales set nombre = ${nombre}, cuit = ${cuit}, activo = ${activo} where id = ${id}`;
    } else {
      await sql`insert into razones_sociales (nombre, cuit, orden) values (${nombre}, ${cuit}, (select coalesce(max(orden), 0) + 1 from razones_sociales))`;
    }
    listo();
    return { ok: 'Guardado.' };
  });
}

/** Da acceso al contador (o le genera una clave nueva si ya tenía). La clave se muestra una sola vez. */
export async function darAccesoContador(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, 'id');
    const sql = db();
    const clave = claveContador();
    if (id) {
      const r = await sql`update contadores set clave_hash = ${hashClave(clave)}, activo = true where id = ${id} returning email`;
      if (!r.length) falla('No se encontró el acceso.');
      revalidatePath('/contabilidad/accesos');
      return { ok: r[0].email as string, clave };
    }
    const nombre = texto(f, 'nombre', 80);
    const email = texto(f, 'email', 120).toLowerCase();
    if (nombre.length < 2) falla('Poné el nombre del contador o del estudio.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) falla('Revisá el mail.');
    await sql`
      insert into contadores (nombre, email, clave_hash) values (${nombre}, ${email}, ${hashClave(clave)})
      on conflict (email) do update set nombre = excluded.nombre, clave_hash = excluded.clave_hash, activo = true`;
    revalidatePath('/contabilidad/accesos');
    return { ok: email, clave };
  });
}

export async function quitarAccesoContador(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id');
  if (id) await db()`update contadores set activo = false, clave_hash = null where id = ${id}`;
  revalidatePath('/contabilidad/accesos');
}

// ---------- ingreso del contador ----------
const HASH_VACIO = 'AAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export async function ingresarContador(_: Estado, f: FormData): Promise<Estado> {
  const email = texto(f, 'email', 120).toLowerCase();
  const clave = texto(f, 'clave', 40).toLowerCase().replace(/\s+/g, '');
  if (!email || !clave) return { error: 'Completá tu mail y tu clave.' };
  if (!permitir(`cont:${await ip()}`, 12, 600) || !permitir(`cont-mail:${email}`, 6, 600)) return { error: 'Demasiados intentos. Probá en unos minutos.' };
  const [c] = await db()`select id, clave_hash from contadores where email = ${email} and activo`;
  // Se calcula igual aunque el mail no exista, para no delatar qué mails tienen acceso.
  const bien = claveCorrecta(clave.includes('-') ? clave : `${clave.slice(0, 4)}-${clave.slice(4)}`, (c?.clave_hash as string | null) ?? HASH_VACIO);
  if (!c || !c.clave_hash || !bien) return { error: 'El mail o la clave no son correctos. Si no tenés clave, pedísela a Bruno Brown.' };
  await db()`update contadores set ultimo_ingreso = now() where id = ${c.id as number}`;
  await escribir(COOKIE_CONTADOR, `${c.id}.${versionClave(c.clave_hash as string)}`);
  redirect('/contabilidad');
}

export async function salirContador() {
  await borrar(COOKIE_CONTADOR);
  redirect('/contador');
}
