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
// El cierre de las 20 hs es interno: al público solo se le dice "a partir de las 18 hs".
export const SORTEO_DESDE = '2026-10-04T18:00:00-03:00';
export const SORTEO_HASTA = '2026-10-04T20:00:00-03:00';
export const SORTEO_TEXTO = 'Sorteo: domingo 4 de octubre, 18 hs';
export const SORTEO_PRESENTE = 'Poné "Estoy presente" a partir de las 18 hs';

export type Ventana = 'antes' | 'abierta' | 'cerrada';
export const ventanaSorteo = (ahora = Date.now()): Ventana =>
  ahora < Date.parse(SORTEO_DESDE) ? 'antes' : ahora < Date.parse(SORTEO_HASTA) ? 'abierta' : 'cerrada';
export const SORTEO_DNI = '* Para ganar el premio hay que presentar el DNI.';

// Votaciones del público (stand más lindo y barista favorito): se vota hasta el domingo a las 20 hs
// y a partir de ese momento se muestran los ganadores en la app.
export const VOTOS_CIERRE = '2026-10-04T20:00:00-03:00';
export const votosAbiertos = (ahora = Date.now()) => ahora < Date.parse(VOTOS_CIERRE);
export const VOTOS_TEXTO = 'El ganador se conoce el domingo 4 a las 20 hs.';
export const LINK_BARISTA = `${URL_PUBLICA}/barista`;
