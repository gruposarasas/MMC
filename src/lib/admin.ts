// Utilidades del back office. Solo servidor.
import { randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from './supabase';
import { esAdmin } from './datos';
import { EMBLEMAS, EVENTO_FIN } from './config';

export async function soloAdmin() {
  return (await esAdmin()) ? null : NextResponse.json({ error: 'Tu sesión venció. Volvé a entrar.' }, { status: 401 });
}

// Misma regla que la semilla del prototipo: primera palabra con sentido del nombre.
const SALTA = ['EL', 'LA', 'LOS', 'LAS', 'DEL', 'DE', 'UNA', 'UN', 'CO', 'CHOCOLATES', 'CAFE', 'HELADOS', 'TIENDA'];
const base = (nombre: string) => {
  const ws = (nombre || '').normalize('NFD').replace(/[^A-Za-z ]/g, '').toUpperCase().split(' ').filter(Boolean);
  return ((ws.find((w) => w.length > 2 && !SALTA.includes(w)) || ws[0] || 'MARCA').slice(0, 10));
};

const ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Clave nueva, única: NOMBRE-XXXX. Sirve para marcas y para baristas. */
export async function nuevaClave(nombre: string, tabla: 'marcas' | 'baristas' | 'jurados' = 'marcas') {
  for (let i = 0; i < 20; i++) {
    const c = `${base(nombre)}-${Array.from({ length: 4 }, () => ALFA[randomInt(ALFA.length)]).join('')}`;
    const { data } = await db().from(tabla).select('id').eq('clave', c).maybeSingle();
    if (!data) return c;
  }
  throw new Error('No se pudo generar una clave');
}

/** Código de caja nuevo, único entre marcas. */
export async function nuevoCodigo() {
  const { data } = await db().from('marcas').select('codigo');
  const usados = new Set((data || []).map((x) => x.codigo));
  for (let i = 0; i < 200; i++) {
    const c = String(randomInt(1000, 10000));
    if (!usados.has(c)) return c;
  }
  throw new Error('No se pudo generar un código');
}

export type CamposMarca = {
  nombre: string;
  stand: string;
  beneficio: string;
  condiciones: string;
  creditos: number;
  codigo: string;
  emblema: string;
  activa: boolean;
  en_votacion: boolean;
  vence: string;
  sucursales: string;
  responsable: string;
  tel_responsable: string;
};

/** Valida lo que manda el formulario de marca. Devuelve los campos limpios o un error. */
export function validarMarca(j: Record<string, unknown>): { ok: CamposMarca } | { error: string } {
  const s = (k: string, max: number) => String(j[k] ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
  const nombre = s('nombre', 80);
  const beneficio = s('beneficio', 34);
  if (!nombre) return { error: 'Completá el nombre de la marca.' };
  const codigo = s('codigo', 4);
  if (!/^\d{4}$/.test(codigo)) return { error: 'El código de caja tiene que ser de 4 números.' };
  const vence = s('vence', 10) || EVENTO_FIN;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(vence) || isNaN(Date.parse(vence)) || vence < EVENTO_FIN)
    return { error: 'El vencimiento no puede ser antes del final del Mundial (4 de octubre).' };
  const emblema = (EMBLEMAS as readonly string[]).includes(String(j.emblema)) ? String(j.emblema) : 'taza';
  return {
    ok: {
      nombre,
      stand: s('stand', 40),
      beneficio,
      condiciones: String(j.condiciones ?? '').trim().slice(0, 240),
      creditos: Math.max(1, Math.min(10, Math.round(Number(j.creditos)) || 1)),
      codigo,
      emblema,
      activa: j.activa === true,
      en_votacion: j.en_votacion === true,
      vence,
      sucursales: String(j.sucursales ?? '').trim().slice(0, 300),
      responsable: s('responsable', 80),
      tel_responsable: String(j.tel_responsable ?? '').replace(/\D/g, '').slice(0, 13),
    },
  };
}

/** Traduce errores de unicidad de Postgres a un mensaje para administración. */
export function errorUnico(e: { code?: string; message?: string } | null) {
  if (e?.code !== '23505') return null;
  if (e.message?.includes('codigo')) return 'Ese código ya lo usa otra cafetería. Elegí otro.';
  if (e.message?.includes('nombre')) return 'Ya hay una marca con ese nombre.';
  if (e.message?.includes('clave')) return 'Esa clave ya existe. Probá de nuevo.';
  return 'Ese dato ya existe en otra marca.';
}
