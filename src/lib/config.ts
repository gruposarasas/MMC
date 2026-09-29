// Datos fijos del evento. Se usan en el servidor y en el cliente.
export const URL_PUBLICA = 'https://mmc.saraimagineers.com';
export const LINK_PANEL = `${URL_PUBLICA}/marca`;
export const EVENTO_FIN = '2026-10-04';
export const ZONA = 'America/Argentina/Mendoza';

export const EMBLEMAS = ['taza', 'flor', 'planta', 'chemex', 'grano', 'copa', 'reloj', 'jarra', 'estrella', 'ondas'] as const;
export type Emblema = (typeof EMBLEMAS)[number];

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Se lee en tiempo de ejecución (no se incrusta en el build). Solo servidor.
export const envRuntime = (k: string) => process.env[k];

export const urlLogo = (path: string | null | undefined) =>
  path ? `${envRuntime('NEXT_PUBLIC_SUPABASE_URL')}/storage/v1/object/public/logos/${path}` : '';

// Sorteo de la camiseta: "Estoy presente" solo se puede tocar en esta ventana (hora de Mendoza).
export const SORTEO_DESDE = '2026-10-04T18:00:00-03:00';
export const SORTEO_HASTA = '2026-10-04T20:00:00-03:00';
export const SORTEO_TEXTO = 'Sorteo para presentes: domingo 4 de octubre, 18 hs';

export type Ventana = 'antes' | 'abierta' | 'cerrada';
export const ventanaSorteo = (ahora = Date.now()): Ventana =>
  ahora < Date.parse(SORTEO_DESDE) ? 'antes' : ahora < Date.parse(SORTEO_HASTA) ? 'abierta' : 'cerrada';
