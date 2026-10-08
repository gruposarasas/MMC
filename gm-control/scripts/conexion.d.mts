export type Opciones = { host: string; port: number; database: string; username: string; password: string; ssl: false | 'require' };
export function opcionesConexion(url: string | undefined): Opciones;
export function describirConexion(o: Opciones): string;
export function explicarError(e: unknown): string;
