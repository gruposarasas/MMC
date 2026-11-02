// Datos del fichaje y de las horas (lo puro está en horas.ts). Solo servidor.
import { leerAjuste } from './ajustes';
import { db } from './db';
import {
  corteSalida, fechaDe, horaDe, type Horario, horasDelMes, type Jornada, type Licencia, limpiarHorario, type Reglas, REGLAS_DEFECTO, sumarDia,
  textoTramos, tramosDe, ultimoDia,
} from './horas';

export const reglasFichaje = async (): Promise<Reglas> => ({ ...REGLAS_DEFECTO, ...((await leerAjuste<Partial<Reglas>>('fichaje')) ?? {}) });

export type FilaFichaje = {
  id: number; empleado_id: number; lugar_id: number | null; fecha: string; entrada: Date | string; salida: Date | string | null;
  salida_por: 'qr' | 'admin' | null; minutos_tarde: number | null; pedido_salida: Date | string | null; pedido_nota: string;
  rechazada: boolean; manual: boolean; nota: string;
};
const ms = (x: Date | string | null) => (x == null ? null : new Date(x).getTime());
export const aJornada = (f: FilaFichaje): Jornada => ({
  id: Number(f.id), fecha: f.fecha, lugarId: f.lugar_id, entradaMs: ms(f.entrada)!, salidaMs: ms(f.salida), salidaPor: f.salida_por,
  minutosTarde: f.minutos_tarde, pedidoMs: ms(f.pedido_salida), pedidoNota: f.pedido_nota, rechazada: f.rechazada, manual: f.manual, nota: f.nota,
});

type Persona = { id: number; nombre: string; apellido: string; puesto: string; horario: unknown; ingreso: string | null; egreso: string | null; activo: boolean; tiene_telefono: boolean };

/** Horas del mes de cada persona (o de una). */
export async function horasDelEquipo(mes: string, soloId?: number) {
  const sql = db();
  const desde = `${mes}-01`;
  const hasta = ultimoDia(mes);
  const [gente, fichajes, feriados, vacaciones, certificados, reglas, lugares] = await Promise.all([
    sql<Persona[]>`
      select id, nombre, apellido, puesto, horario, ingreso, egreso, activo, telefono_ficha is not null tiene_telefono from empleados
      where ${soloId ? sql`id = ${soloId}` : sql`(activo or id in (select empleado_id from fichajes where fecha between ${desde} and ${hasta}))`}
      order by lower(nombre), lower(apellido)`,
    sql<FilaFichaje[]>`select * from fichajes where fecha between ${desde} and ${hasta} ${soloId ? sql`and empleado_id = ${soloId}` : sql``} order by entrada`,
    sql<{ fecha: string; nombre: string }[]>`select fecha, nombre from feriados where fecha between ${desde} and ${hasta}`,
    sql<{ empleado_id: number; desde: string; hasta: string }[]>`select empleado_id, desde, hasta from vacaciones where estado = 'aprobada' and desde <= ${hasta} and hasta >= ${desde}`,
    sql<{ empleado_id: number; desde: string; hasta: string }[]>`select empleado_id, desde, hasta from certificados where desde <= ${hasta} and hasta >= ${desde}`,
    reglasFichaje(),
    sql<{ id: number; nombre: string }[]>`select id, nombre from lugares`,
  ]);
  const mapaFeriados = new Map(feriados.map((f) => [f.fecha, f.nombre]));
  const ahoraMs = Date.now();
  const filas = gente.map((e) => {
    const horario = limpiarHorario(e.horario);
    const licencias: Licencia[] = [
      ...vacaciones.filter((v) => v.empleado_id === e.id).map((v) => ({ desde: v.desde, hasta: v.hasta, tipo: 'vacaciones' as const })),
      ...certificados.filter((c) => c.empleado_id === e.id).map((c) => ({ desde: c.desde, hasta: c.hasta, tipo: 'certificado' as const })),
    ];
    const r = horasDelMes({
      mes, horario, feriados: mapaFeriados, licencias, ingreso: e.ingreso, egreso: e.egreso, reglas, ahoraMs,
      jornadas: fichajes.filter((f) => f.empleado_id === e.id).map(aJornada),
    });
    return { e, horario, licencias, r };
  });
  return { reglas, feriados: mapaFeriados, lugares: new Map(lugares.map((l) => [l.id, l.nombre])), filas, desde, hasta };
}

/** Salidas sin marcar de los últimos 60 días que administración tiene que resolver (pedidas o vencidas). */
export async function salidasPendientes() {
  const sql = db();
  const [filas, reglas] = await Promise.all([
    sql<(FilaFichaje & { nombre: string; apellido: string; horario: unknown })[]>`
      select f.*, e.nombre, e.apellido, e.horario from fichajes f join empleados e on e.id = f.empleado_id
      where f.salida is null and not f.rechazada and f.fecha >= ${sumarDia(fechaDe(Date.now()), -60)} order by f.entrada`,
    reglasFichaje(),
  ]);
  const ahora = Date.now();
  return filas
    .map((f) => ({ ...f, j: aJornada(f), corte: corteSalida(limpiarHorario(f.horario), f.fecha, ms(f.entrada)!, reglas) }))
    .filter((f) => f.j.pedidoMs != null || f.corte <= ahora);
}

/** Lo que necesita la app del equipo para fichar. */
export async function estadoFichaje(id: number) {
  const sql = db();
  const ahora = Date.now();
  const hoy = fechaDe(ahora);
  const [[e], abiertas, lugares, reglas, deHoy] = await Promise.all([
    sql<{ horario: unknown; lugar_id: number | null }[]>`select horario, lugar_id from empleados where id = ${id}`,
    sql<FilaFichaje[]>`select * from fichajes where empleado_id = ${id} and salida is null and not rechazada and pedido_salida is null
                       and fecha >= ${sumarDia(hoy, -60)} order by entrada desc`,
    sql<{ id: number; nombre: string; lat: number | null; lng: number | null; radio_m: number }[]>`
      select id, nombre, lat, lng, radio_m from lugares where activo order by nombre`,
    reglasFichaje(),
    sql<(FilaFichaje & { lugar: string | null })[]>`
      select f.*, l.nombre lugar from fichajes f left join lugares l on l.id = f.lugar_id where f.empleado_id = ${id} and f.fecha = ${hoy} order by f.entrada`,
  ]);
  const horario: Horario | null = limpiarHorario(e?.horario);
  const conCorte = abiertas.map((a) => ({ a, corte: corteSalida(horario, a.fecha, ms(a.entrada)!, reglas) }));
  const enCurso = conCorte.find((x) => x.corte > ahora);
  const nombreLugar = (lid: number | null) => lugares.find((l) => l.id === lid)?.nombre ?? '';
  return {
    tipo: enCurso ? ('salida' as const) : ('entrada' as const),
    enCurso: enCurso ? { id: Number(enCurso.a.id), entrada: horaDe(ms(enCurso.a.entrada)!), lugar: nombreLugar(enCurso.a.lugar_id), corte: `${fechaDe(enCurso.corte) > hoy ? 'mañana a ' : ''}las ${horaDe(enCurso.corte)}` } : null,
    sinSalida: conCorte.filter((x) => x.corte <= ahora).map((x) => ({ id: Number(x.a.id), fecha: x.a.fecha, entrada: horaDe(ms(x.a.entrada)!), lugar: nombreLugar(x.a.lugar_id) })),
    lugares: lugares.filter((l) => l.lat != null && l.lng != null).map((l) => ({ id: l.id, nombre: l.nombre, lat: l.lat!, lng: l.lng!, radio: l.radio_m })),
    hayLugares: lugares.length > 0,
    lugarHabitual: e?.lugar_id ?? null,
    horarioHoy: textoTramos(tramosDe(horario, hoy)),
    hoy: deHoy.map((f) => ({ entrada: horaDe(ms(f.entrada)!), salida: f.salida ? horaDe(ms(f.salida)!) : null, lugar: f.lugar ?? '' })),
  };
}
export type EstadoFichaje = Awaited<ReturnType<typeof estadoFichaje>>;
