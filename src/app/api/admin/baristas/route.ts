import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { soloAdmin } from '@/lib/admin';
import { estadoTorneo, generarLlaves, volverAClasificacion, cargarResultado } from '@/lib/torneo';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (v: unknown, max: number) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

/** Puntaje de 1 a 10 con un decimal ("8,5" o "8.5"). null si viene vacío; NaN si es inválido. */
function puntaje(v: unknown, min = 1): number | null {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < min || n > 10) return NaN;
  return Math.round(n * 10) / 10;
}

export async function GET() {
  const no = await soloAdmin();
  if (no) return no;
  return NextResponse.json(await estadoTorneo(), { headers: { 'cache-control': 'no-store' } });
}

export async function POST(req: Request) {
  const no = await soloAdmin();
  if (no) return no;
  const j = await req.json().catch(() => ({}));
  const mal = (error: string, status = 400) => NextResponse.json({ error }, { status });
  const ok = async () => NextResponse.json(await estadoTorneo());

  switch (j.accion) {
    case 'agregar': {
      // Una línea por barista: "Nombre" o "Nombre - Cafetería".
      const filas = String(j.lista ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 64);
      if (!filas.length) return mal('Escribí al menos un nombre.');
      const { count } = await db().from('baristas').select('id', { count: 'exact', head: true });
      if ((count || 0) + filas.length > 64) return mal('Son demasiados participantes.');
      const base = Date.now();
      const nuevos = filas.map((l, i) => {
        const [n, ...c] = l.split(/\s+[-–|]\s+|\t/);
        return { nombre: texto(n, 80), cafeteria: texto(c.join(' '), 80), created_at: new Date(base + i).toISOString() };
      }).filter((x) => x.nombre);
      const { error } = await db().from('baristas').insert(nuevos);
      if (error) return mal('No se pudieron agregar.', 500);
      return ok();
    }
    case 'editar': {
      if (!UUID.test(String(j.id))) return mal('Datos inválidos.');
      const nombre = texto(j.nombre, 80);
      if (!nombre) return mal('El nombre no puede quedar vacío.');
      const { error } = await db().from('baristas').update({ nombre, cafeteria: texto(j.cafeteria, 80) }).eq('id', j.id);
      if (error) return mal('No se pudo guardar.', 500);
      return ok();
    }
    case 'borrar': {
      if (!UUID.test(String(j.id))) return mal('Datos inválidos.');
      const { error } = await db().from('baristas').delete().eq('id', j.id);
      if (error) return mal('No se pudo borrar.', 500);
      return ok();
    }
    case 'puntaje': {
      if (!UUID.test(String(j.id))) return mal('Datos inválidos.');
      const p = puntaje(j.puntaje);
      if (Number.isNaN(p)) return mal('El puntaje va de 1 a 10, con un decimal. Por ejemplo: 8,5.');
      const desempate = Math.max(-99, Math.min(99, Math.round(Number(j.desempate) || 0)));
      const { data: antes } = await db().from('baristas').select('puntaje').eq('id', j.id).maybeSingle();
      const cambios: Record<string, unknown> = { puntaje: p, desempate };
      // La hora de puntuación se fija al cargar el primer puntaje (sirve para desempatar y para resaltarlo en pantalla).
      if (p == null) cambios.puntuado_at = null;
      else if (antes?.puntaje == null || Number(antes.puntaje) !== p) cambios.puntuado_at = new Date().toISOString();
      const { error } = await db().from('baristas').update(cambios).eq('id', j.id);
      if (error) return mal('No se pudo guardar el puntaje.', 500);
      return ok();
    }
    case 'generar': {
      const err = await generarLlaves();
      if (err) return mal(err, 409);
      return ok();
    }
    case 'clasificacion': {
      await volverAClasificacion();
      return ok();
    }
    case 'resultado': {
      const pa = puntaje(j.puntaje_a, 0), pb = puntaje(j.puntaje_b, 0);
      if (Number.isNaN(pa) || Number.isNaN(pb)) return mal('Los puntajes van de 0 a 10, con un decimal.');
      const g = j.ganador === undefined ? undefined : j.ganador === null ? null : String(j.ganador);
      const err = await cargarResultado(String(j.partido), pa, pb, g);
      if (err) return mal(err, 409);
      return ok();
    }
    case 'pantalla': {
      if (!['auto', 'clasificacion', 'llaves'].includes(j.valor)) return mal('Datos inválidos.');
      await db().from('torneo').update({ pantalla: j.valor, updated_at: new Date().toISOString() }).eq('id', 1);
      return ok();
    }
  }
  return mal('Acción desconocida.');
}
