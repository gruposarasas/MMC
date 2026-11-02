'use server';
// Fichaje y horas: fichar desde la app del equipo (GPS + QR + su teléfono) y lo que hace administración.
import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { guardarAjuste } from '@/lib/ajustes';
import { db } from '@/lib/db';
import { reglasFichaje } from '@/lib/fichaje';
import { type Estado, entero, falla, intentar, numero, texto, tilde, volver } from '@/lib/form';
import { esFecha } from '@/lib/formato';
import { distanciaM } from '@/lib/geo';
import { corteSalida, fechaDe, formatoHoras, horaDe, instante, limpiarHorario, minutosTarde, redondear, type Tramo } from '@/lib/horas';
import { COOKIE_PANTALLA, huella, leerQR } from '@/lib/qr';
import { empleadoSesion, exigirAdmin } from '@/lib/sesion';

const COOKIE_TELEFONO = 'bb_t';
const DOS_ANIOS = 2 * 365 * 24 * 60 * 60;
const cookieSegura = (maxAge: number) => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge });
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const ms = (x: unknown) => new Date(x as string).getTime();

const listo = () => {
  revalidatePath('/equipo', 'layout');
  revalidatePath('/mi');
};

// ---------- equipo ----------
type Resultado = { ok: string; tipo: 'entrada' | 'salida' } | { error: string };

/** Marca la entrada o la salida. El servidor valida el QR, la ubicación y el teléfono con su hora. */
export async function fichar(datos: { qr: string; lat: number; lng: number; precision: number; tipo?: 'entrada' | 'salida' }): Promise<Resultado> {
  const id = await empleadoSesion();
  if (!id) return { error: 'Tu sesión venció. Volvé a entrar a la app.' };
  const sql = db();
  const [e] = await sql<{ id: number; nombre: string; horario: unknown; telefono_ficha: string | null; activo: boolean }[]>`
    select id, nombre, horario, telefono_ficha, activo from empleados where id = ${id}`;
  if (!e?.activo) return { error: 'Tu usuario no está activo.' };
  const rechazar = async (motivo: string): Promise<Resultado> => {
    await sql`insert into fichajes_rechazados (empleado_id, motivo) values (${id}, ${motivo})`.catch(() => {});
    return { error: motivo };
  };
  const ahora = Date.now();

  const q = leerQR(datos?.qr, ahora);
  if ('error' in q) return rechazar(q.error);
  const [lugar] = await sql<{ id: number; nombre: string; lat: number | null; lng: number | null; radio_m: number }[]>`
    select id, nombre, lat, lng, radio_m from lugares where id = ${q.lugarId} and activo`;
  if (!lugar) return rechazar('Ese lugar no está habilitado para fichar.');

  const lat = Number(datos.lat);
  const lng = Number(datos.lng);
  const precision = Number(datos.precision);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return rechazar('No llegó tu ubicación. Activá el GPS y volvé a intentar.');
  if (lugar.lat == null || lugar.lng == null) return rechazar(`${lugar.nombre} todavía no tiene la ubicación cargada. Avisale a administración.`);
  if (!(precision <= 150)) return rechazar(`La señal de ubicación es imprecisa (± ${Math.round(precision)} m). Activá el GPS y volvé a intentar.`);
  const distancia = distanciaM(lat, lng, lugar.lat, lugar.lng);
  if (distancia > lugar.radio_m) return rechazar(`Estás a ${distancia} m de ${lugar.nombre}. Acercate para fichar.`);

  // Un teléfono por persona: el primero con el que ficha queda como el suyo.
  const jar = await cookies();
  let token = jar.get(COOKIE_TELEFONO)?.value ?? '';
  if (!/^[\w-]{24,64}$/.test(token)) {
    token = randomBytes(24).toString('base64url');
    jar.set(COOKIE_TELEFONO, token, cookieSegura(DOS_ANIOS));
  }
  const telefono = huella(token);
  if (e.telefono_ficha && e.telefono_ficha !== telefono) return rechazar('Fichá desde tu teléfono. Si cambiaste de teléfono, pedile a administración que habilite el nuevo.');
  if (!e.telefono_ficha) {
    const [otro] = await sql<{ nombre: string }[]>`select nombre from empleados where telefono_ficha = ${telefono} and id <> ${id}`;
    if (otro) return rechazar(`Este teléfono ya ficha para ${otro.nombre}. Cada persona ficha desde su propio teléfono.`);
  }

  const horario = limpiarHorario(e.horario);
  const reglas = await reglasFichaje();
  const geo = { lat, lng, precision: Math.round(precision), distancia };
  const r = await sql.begin(async (tx): Promise<Resultado> => {
    await tx`select pg_advisory_xact_lock(7001, ${id})`;
    if (!e.telefono_ficha) await tx`update empleados set telefono_ficha = ${telefono} where id = ${id}`;
    const abiertas = await tx<{ id: number; fecha: string; entrada: Date }[]>`
      select id, fecha, entrada from fichajes where empleado_id = ${id} and salida is null and not rechazada and pedido_salida is null
      and entrada > ${new Date(ahora - 2 * 864e5)} order by entrada desc`;
    const abierta = abiertas.find((a) => corteSalida(horario, a.fecha, ms(a.entrada), reglas) > ahora);
    const tipo = abierta ? 'salida' : 'entrada';
    if (datos.tipo && datos.tipo !== tipo) {
      return { error: tipo === 'salida' ? 'Ya tenés la entrada marcada: ahora corresponde la salida.' : 'No tenés una entrada abierta: ahora corresponde la entrada.' };
    }
    if (abierta) {
      if (ahora - ms(abierta.entrada) < 60_000) return { error: 'Acabás de marcar la entrada. La salida se marca cuando te vas.' };
      await tx`update fichajes set salida = ${new Date(ahora)}, salida_por = 'qr', geo_salida = ${tx.json(geo)} where id = ${abierta.id}`;
      const horas = redondear((ahora - ms(abierta.entrada)) / 36e5, reglas.redondeoMin);
      return { ok: `Salida marcada a las ${horaDe(ahora)}. Hoy: ${formatoHoras(horas)} h.`, tipo };
    }
    const fecha = fechaDe(ahora);
    const tarde = minutosTarde(horario, fecha, ahora);
    await tx`insert into fichajes ${tx({ empleado_id: id, lugar_id: lugar.id, fecha, entrada: new Date(ahora), minutos_tarde: tarde, geo_entrada: tx.json(geo) })}`;
    return { ok: `Entrada marcada a las ${horaDe(ahora)} en ${lugar.nombre}.${tarde != null && tarde > reglas.toleranciaMin ? ` Quedó como llegada tarde (${tarde} min).` : ''}`, tipo };
  });
  if ('ok' in r) revalidatePath('/mi');
  return r;
}

/** Hora (HH:MM) de una jornada: si es antes de la entrada, es del día siguiente. */
function horaDeJornada(fecha: string, entradaMs: number, hora: string, topeH: number) {
  if (!HORA.test(hora)) falla('Poné la hora de salida.');
  let s = instante(fecha, hora);
  if (s <= entradaMs) s += 864e5;
  if (s - entradaMs > topeH * 36e5) falla(`Desde la entrada (${horaDe(entradaMs)}) son más de ${topeH} horas. Revisá la hora.`);
  if (s > Date.now()) falla('Esa hora todavía no pasó.');
  return s;
}

/** La persona se olvidó de marcar la salida: pide la hora y administración la confirma o la corrige. */
export async function pedirSalida(_: Estado, f: FormData): Promise<Estado> {
  const id = await empleadoSesion();
  if (!id) return { error: 'Tu sesión venció. Volvé a entrar a la app.' };
  return intentar(async () => {
    const sql = db();
    const [j] = await sql<{ id: number; fecha: string; entrada: Date; salida: Date | null; rechazada: boolean; horario: unknown }[]>`
      select f.id, f.fecha, f.entrada, f.salida, f.rechazada, e.horario from fichajes f join empleados e on e.id = f.empleado_id
      where f.id = ${entero(f, 'id') ?? 0} and f.empleado_id = ${id}`;
    if (!j || j.salida || j.rechazada) falla('Esa jornada ya está resuelta.');
    const reglas = await reglasFichaje();
    if (corteSalida(limpiarHorario(j!.horario), j!.fecha, ms(j!.entrada), reglas) > Date.now()) falla('Todavía podés marcar la salida con el QR.');
    const salida = horaDeJornada(j!.fecha, ms(j!.entrada), texto(f, 'hora', 5), reglas.topeH);
    await sql`update fichajes set pedido_salida = ${new Date(salida)}, pedido_nota = ${texto(f, 'nota', 300)} where id = ${j!.id}`;
    listo();
    return { ok: 'Listo: administración la va a revisar.' };
  });
}

// ---------- administración: jornadas ----------
/** Resuelve una salida sin marcar: confirma la hora pedida, pone otra o la rechaza (el día suma 0). */
export async function resolverSalida(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const sql = db();
    const [j] = await sql<{ id: number; fecha: string; entrada: Date; pedido_salida: Date | null }[]>`
      select id, fecha, entrada, pedido_salida from fichajes where id = ${entero(f, 'id') ?? 0}`;
    if (!j) falla('No se encontró la jornada.');
    const accion = texto(f, 'accion', 20);
    if (accion === 'rechazar') {
      await sql`update fichajes set rechazada = true, salida = null, salida_por = null where id = ${j!.id}`;
    } else {
      const reglas = await reglasFichaje();
      const salida = accion === 'confirmar' && j!.pedido_salida ? ms(j!.pedido_salida) : horaDeJornada(j!.fecha, ms(j!.entrada), texto(f, 'hora', 5), reglas.topeH);
      await sql`update fichajes set salida = ${new Date(salida)}, salida_por = 'admin', rechazada = false where id = ${j!.id}`;
    }
    listo();
    return { ok: 'Resuelta.' };
  });
}

/** Carga o corrige una jornada a mano (por ejemplo, si alguien se quedó sin teléfono). */
export async function guardarJornada(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const sql = db();
    const id = entero(f, 'id');
    const empleado = entero(f, 'empleado_id') ?? falla('Elegí la persona.');
    const fecha = texto(f, 'fecha', 10);
    if (!esFecha(fecha)) falla('Poné la fecha.');
    const hEntrada = texto(f, 'entrada', 5);
    if (!HORA.test(hEntrada)) falla('Poné la hora de entrada.');
    const entrada = instante(fecha, hEntrada);
    if (entrada > Date.now()) falla('La entrada todavía no pasó.');
    const reglas = await reglasFichaje();
    const hSalida = texto(f, 'salida', 5);
    const salida = hSalida ? horaDeJornada(fecha, entrada, hSalida, reglas.topeH) : null;
    const [e] = await sql<{ horario: unknown }[]>`select horario from empleados where id = ${empleado}`;
    if (!e) falla('No se encontró la persona.');
    const fila = {
      empleado_id: empleado, fecha, entrada: new Date(entrada), salida: salida ? new Date(salida) : null, salida_por: salida ? ('admin' as const) : null,
      lugar_id: entero(f, 'lugar_id'), minutos_tarde: minutosTarde(limpiarHorario(e!.horario), fecha, entrada), nota: texto(f, 'nota', 300), rechazada: false,
    };
    if (id) {
      const [antes] = await sql<{ salida: Date | null; salida_por: string | null }[]>`select salida, salida_por from fichajes where id = ${id}`;
      if (!antes) falla('No se encontró la jornada.');
      // Si la salida no cambió, se mantiene cómo se marcó (con el QR o por administración).
      if (antes!.salida && salida === ms(antes!.salida)) fila.salida_por = antes!.salida_por as 'admin';
      await sql`update fichajes set ${sql(fila)} where id = ${id}`;
    } else {
      await sql`insert into fichajes ${sql({ ...fila, manual: true })}`;
    }
    listo();
    redirect(volver(f, `/equipo/horas/${empleado}?p=${fecha.slice(0, 7)}`));
  });
}

export async function borrarJornada(f: FormData) {
  await exigirAdmin();
  await db()`delete from fichajes where id = ${entero(f, 'id') ?? 0}`;
  listo();
}

// ---------- administración: horario y teléfono de cada persona ----------
export async function guardarHorario(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, 'empleado_id') ?? falla('Falta la persona.');
    const horario: Record<string, Tramo[]> = {};
    for (let d = 0; d < 7; d++) {
      if (!tilde(f, `d${d}`)) continue;
      const tramos: Tramo[] = [];
      for (const s of ['', '2']) {
        const a = texto(f, `d${d}_desde${s}`, 5);
        const b = texto(f, `d${d}_hasta${s}`, 5);
        if (!a && !b) continue;
        if (!HORA.test(a) || !HORA.test(b) || a === b) falla('Revisá los horarios: cada tramo necesita desde y hasta (por ejemplo 09:00 a 17:00).');
        tramos.push([a, b]);
      }
      if (!tramos.length) falla('Un día tildado necesita al menos un horario.');
      horario[String(d)] = tramos;
    }
    await db()`update empleados set horario = ${Object.keys(horario).length ? db().json(horario) : null}, lugar_id = ${entero(f, 'lugar_id')} where id = ${id}`;
    listo();
    return { ok: 'Horario guardado.' };
  });
}

export async function habilitarOtroTelefono(f: FormData) {
  await exigirAdmin();
  await db()`update empleados set telefono_ficha = null where id = ${entero(f, 'empleado_id') ?? 0}`;
  listo();
}

// ---------- administración: lugares, pantallas, feriados y reglas ----------
/** "-32.89, -68.84" (como lo copia Google Maps) */
function coordenadas(s: string) {
  if (!s) return null;
  const m = s.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (!m) falla('Las coordenadas van como las copia Google Maps: -32.8895, -68.8458');
  const lat = Number(m![1]);
  const lng = Number(m![2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) falla('Revisá las coordenadas.');
  return { lat, lng };
}

export async function guardarLugar(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const id = entero(f, 'id');
    const nombre = texto(f, 'nombre', 80) || falla('Poné el nombre del lugar.');
    const c = coordenadas(texto(f, 'coordenadas', 60));
    const fila = {
      nombre, direccion: texto(f, 'direccion', 200), radio_m: Math.round(numero(f, 'radio_m', { min: 20, max: 2000, requerido: 'Poné el radio en metros.' })),
      activo: id ? tilde(f, 'activo') : true, ...(c ?? {}),
    };
    const sql = db();
    if (id) await sql`update lugares set ${sql(fila)} where id = ${id}`;
    else await sql`insert into lugares ${sql(fila)}`;
    listo();
    redirect('/equipo/fichaje');
  });
}

/** Toma la ubicación del teléfono de administración parado en el lugar. */
export async function fijarUbicacion(datos: { id: number; lat: number; lng: number; precision: number }): Promise<{ ok?: string; error?: string }> {
  await exigirAdmin();
  const lat = Number(datos.lat);
  const lng = Number(datos.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { error: 'No llegó la ubicación.' };
  if (!(Number(datos.precision) <= 100)) return { error: `La ubicación es imprecisa (± ${Math.round(Number(datos.precision))} m). Activá el GPS y probá de nuevo al aire libre.` };
  await db()`update lugares set lat = ${lat}, lng = ${lng} where id = ${Number(datos.id) || 0}`;
  listo();
  return { ok: `Ubicación guardada (± ${Math.round(Number(datos.precision))} m).` };
}

export async function borrarLugar(f: FormData) {
  await exigirAdmin();
  const id = entero(f, 'id') ?? 0;
  const sql = db();
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int n from fichajes where lugar_id = ${id}`;
  if (n) await sql`update lugares set activo = false where id = ${id}`;
  else await sql`delete from lugares where id = ${id}`;
  listo();
}

const codigoNuevo = () => randomBytes(9).toString('base64url');

export async function crearPantalla(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const lugar = entero(f, 'lugar_id') ?? falla('Elegí el lugar.');
    await db()`insert into pantallas (lugar_id, nombre, codigo, codigo_vence) values (${lugar}, ${texto(f, 'nombre', 60)}, ${codigoNuevo()}, now() + interval '2 days')`;
    listo();
    return { ok: 'Pantalla creada: abrí el link de activación en la tablet o la PC del lugar.' };
  });
}

/** Nuevo link de activación (para otra tablet): la anterior deja de mostrar el QR cuando se active la nueva. */
export async function nuevoLinkPantalla(f: FormData) {
  await exigirAdmin();
  await db()`update pantallas set codigo = ${codigoNuevo()}, codigo_vence = now() + interval '2 days', activa = true where id = ${entero(f, 'id') ?? 0}`;
  listo();
}

export async function borrarPantalla(f: FormData) {
  await exigirAdmin();
  await db()`delete from pantallas where id = ${entero(f, 'id') ?? 0}`;
  listo();
}

/** Desde la tablet: activa la pantalla con el código del link (un solo uso) y la deja reconocida con una cookie. */
export async function activarPantalla(_: Estado, f: FormData): Promise<Estado> {
  return intentar(async () => {
    const codigo = texto(f, 'codigo', 40);
    const token = randomBytes(24).toString('base64url');
    const [p] = await db()<{ id: number }[]>`
      update pantallas set token_hash = ${huella(token)}, codigo = null, codigo_vence = null, activa = true, visto = now()
      where codigo = ${codigo} and codigo_vence > now() returning id`;
    if (!p) falla('El link venció o ya se usó. Pedile a administración uno nuevo.');
    (await cookies()).set(COOKIE_PANTALLA, token, cookieSegura(DOS_ANIOS));
    redirect('/pantalla');
  });
}

export async function agregarFeriado(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const fecha = texto(f, 'fecha', 10);
    if (!esFecha(fecha)) falla('Poné la fecha.');
    await db()`insert into feriados (fecha, nombre) values (${fecha}, ${texto(f, 'nombre', 80)}) on conflict (fecha) do update set nombre = excluded.nombre`;
    listo();
    return { ok: 'Feriado agregado.' };
  });
}

export async function borrarFeriado(f: FormData) {
  await exigirAdmin();
  await db()`delete from feriados where fecha = ${texto(f, 'fecha', 10)}`;
  listo();
}

/** Feriados nacionales del año (api.argentinadatos.com; FERIADOS_URL para pruebas). Los de Mendoza se agregan a mano. */
export async function traerFeriados(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  const anio = Number(texto(f, 'anio', 4));
  if (!(anio >= 2020 && anio <= 2100)) return { error: 'Revisá el año.' };
  const base = (process.env.FERIADOS_URL || 'https://api.argentinadatos.com/v1/feriados').replace(/\/+$/, '');
  let lista: { fecha?: string; nombre?: string }[];
  try {
    const r = await fetch(`${base}/${anio}`, { signal: AbortSignal.timeout(15_000), headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(String(r.status));
    lista = (await r.json()) as typeof lista;
  } catch {
    return { error: 'No se pudieron traer los feriados. Cargalos a mano o probá más tarde.' };
  }
  const filas = (Array.isArray(lista) ? lista : []).filter((x) => esFecha(String(x.fecha)) && String(x.fecha).startsWith(String(anio)))
    .map((x) => ({ fecha: String(x.fecha), nombre: String(x.nombre ?? '').slice(0, 80) }));
  if (!filas.length) return { error: `No vinieron feriados de ${anio}.` };
  const sql = db();
  await sql`insert into feriados ${sql(filas)} on conflict (fecha) do update set nombre = excluded.nombre`;
  listo();
  return { ok: `${filas.length} feriados de ${anio} cargados.` };
}

export async function guardarReglas(_: Estado, f: FormData): Promise<Estado> {
  await exigirAdmin();
  return intentar(async () => {
    const reglas = {
      toleranciaMin: Math.round(numero(f, 'toleranciaMin', { min: 0, max: 60 })),
      redondeoMin: [1, 5, 10, 15, 30].includes(Number(texto(f, 'redondeoMin', 3))) ? Number(texto(f, 'redondeoMin', 3)) : 15,
      margenSalidaMin: Math.round(numero(f, 'margenSalidaMin', { min: 15, max: 720 })),
      topeH: numero(f, 'topeH', { min: 4, max: 24 }),
    };
    await guardarAjuste('fichaje', reglas);
    listo();
    return { ok: 'Reglas guardadas. Las horas ya están recalculadas.' };
  });
}
