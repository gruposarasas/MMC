// Logos en Supabase Storage (bucket público 'logos'). Solo servidor.
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { db } from './supabase';

const MAX = 1024 * 1024;

function tipo(buf: Buffer): string | null {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

/** Sube un logo recibido como data URL. Devuelve el path en el bucket. */
export const subirLogo = (marcaId: string, dataUrl: string) => subirImagen(`marcas/${marcaId}`, dataUrl, 'El logo');

/** Sube una imagen (data URL PNG, JPG o WebP, hasta 1 MB) al bucket público. Devuelve el path. */
export async function subirImagen(prefijo: string, dataUrl: string, que = 'La imagen'): Promise<string> {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw new Error(`${que} tiene que ser PNG, JPG o WebP.`);
  const buf = Buffer.from(m[2], 'base64');
  if (buf.length > MAX) throw new Error(`${que} pesa más de 1 MB.`);
  const t = tipo(buf);
  if (!t) throw new Error('El archivo no es una imagen válida.');
  const p = `${prefijo}-${randomBytes(4).toString('hex')}.${EXT[t]}`;
  const { error } = await db().storage.from('logos').upload(p, buf, { contentType: t, cacheControl: '31536000', upsert: false });
  if (error) throw new Error(`No se pudo subir ${que.toLowerCase()}.`);
  return p;
}

/**
 * Sube a Storage los logos iniciales del prototipo (semilla/logos) que todavía
 * no estén. Corre al arrancar el servidor y es idempotente.
 */
export async function sincronizarLogosSemilla() {
  const dir = path.join(process.cwd(), 'semilla/logos');
  let archivos: string[];
  try {
    archivos = await fs.readdir(dir);
  } catch {
    return;
  }
  const { data, error } = await db().storage.from('logos').list('semilla', { limit: 1000 });
  if (error) {
    console.error('[logos] no se pudo listar el bucket:', error.message);
    return;
  }
  const ya = new Set((data || []).map((o) => o.name));
  let subidos = 0;
  for (const a of archivos) {
    if (ya.has(a)) continue;
    const buf = await fs.readFile(path.join(dir, a));
    const t = tipo(buf);
    if (!t) continue;
    const { error: e } = await db().storage.from('logos').upload(`semilla/${a}`, buf, { contentType: t, cacheControl: '31536000', upsert: true });
    if (e) console.error('[logos]', a, e.message);
    else subidos++;
  }
  if (subidos) console.log(`[logos] ${subidos} logos iniciales subidos a Storage`);
}
