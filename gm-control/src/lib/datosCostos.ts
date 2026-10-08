// Carga insumos, recetas y dólar para calcular costos. Solo servidor.
import { leerDolar } from './ajustes';
import { type Insumo, type LineaReceta } from './costos';
import { db } from './db';

export async function datosCostos() {
  const sql = db();
  const [insumos, receta, dolar] = await Promise.all([
    sql<(Insumo & { categoria: string; actualizado: string; notas: string; usos: number })[]>`
      select i.*, (select count(*) from receta r where r.insumo_id = i.id)::int usos from insumos i order by i.categoria, i.nombre`,
    sql<(LineaReceta & { producto_id: number })[]>`select * from receta order by orden, id`,
    leerDolar(),
  ]);
  return { insumos, mapa: new Map(insumos.map((i) => [i.id, i])), receta, dolar };
}

export const estadoMargen = (m: number | null, objetivo: number) =>
  m == null ? '' : m >= objetivo ? 'bien' : m >= objetivo - 10 ? 'alerta' : 'mal';
