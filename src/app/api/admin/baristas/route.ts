import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { soloAdmin } from '@/lib/admin';
import { estadoTorneo, puntuar, cerrarRonda, volverARonda } from '@/lib/torneo';
import { RONDAS, type Fase } from '@/lib/rondas';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const texto = (v: unknown, max: number) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
const FASES = RONDAS.map((r) => r.fase) as string[];

/** Puntaje de 1 a 9 con un decimal ("8,5" o "8.5"). null si viene vacío; NaN si es inválido. */
function puntaje(v: unknown): number | null {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const n = Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 1 || n > 9) return NaN;
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
      const { data: ult } = await db().from('baristas').select('orden').order('orden', { ascending: false }).limit(1).maybeSingle();
      const base = Date.now();
      let orden = Math.min((ult?.orden as number) || 0, 999);
      const nuevos = filas.map((l, i) => {
        const [n, ...c] = l.split(/\s+[-–|]\s+|\t/);
        return { nombre: texto(n, 80), cafeteria: texto(c.join(' '), 80), orden: ++orden, created_at: new Date(base + i).toISOString() };
      }).filter((x) => x.nombre);
      const { error } = await db().from('baristas').insert(nuevos);
      if (error) return mal('No se pudieron agregar.', 500);
      return ok();
    }
    case 'editar': {
      if (!UUID.test(String(j.id))) return mal('Datos inválidos.');
      const nombre = texto(j.nombre, 80);
      if (!nombre) return mal('El nombre no puede quedar vacío.');
      const { error } = await db().from('baristas').update({ nombre, cafeteria: texto(j.cafeteria, 80), turno: texto(j.turno, 40) }).eq('id', j.id);
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
      const n = Number(j.ronda);
      if (![1, 2, 3, 4].includes(n)) return mal('Ronda inválida.');
      const p = puntaje(j.puntaje);
      if (Number.isNaN(p)) return mal('El puntaje va de 1 a 9, con un decimal. Por ejemplo: 8,5.');
      const esp = puntaje(j.espresso);
      if (Number.isNaN(esp)) return mal('El puntaje del espresso va de 1 a 9, con un decimal.');
      const desempate = Math.max(-99, Math.min(99, Math.round(Number(j.desempate) || 0)));
      const err = await puntuar(j.id, n, p, esp, desempate);
      if (err) return mal(err, 409);
      return ok();
    }
    case 'cerrar': {
      const err = await cerrarRonda();
      if (err) return mal(err, 409);
      return ok();
    }
    case 'volver': {
      if (!FASES.includes(j.fase)) return mal('Ronda inválida.');
      const err = await volverARonda(j.fase as Fase);
      if (err) return mal(err, 409);
      return ok();
    }
    case 'pantalla': {
      if (!['auto', ...FASES].includes(j.valor)) return mal('Datos inválidos.');
      await db().from('torneo').update({ pantalla: j.valor, updated_at: new Date().toISOString() }).eq('id', 1);
      return ok();
    }
  }
  return mal('Acción desconocida.');
}
