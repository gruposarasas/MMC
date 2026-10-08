'use server';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { type Estado, texto } from '@/lib/form';
import { ip, permitir } from '@/lib/limite';
import { COOKIE_ADMIN, COOKIE_EQUIPO, borrar, claveCorrecta, escribir, igualSeguro } from '@/lib/sesion';
import { soloDigitos } from '@/lib/formato';

export async function ingresarAdmin(_: Estado, f: FormData): Promise<Estado> {
  const esperada = process.env.ADMIN_PASSWORD;
  if (!esperada) return { error: 'Falta configurar ADMIN_PASSWORD en el servidor.' };
  if (!permitir(`adm:${await ip()}`, 8, 600)) return { error: 'Demasiados intentos. Probá en unos minutos.' };
  const clave = texto(f, 'clave', 200);
  if (!clave || !igualSeguro(clave, esperada)) return { error: 'La contraseña no es correcta.' };
  await escribir(COOKIE_ADMIN, 'admin');
  redirect('/kpi');
}

export async function salirAdmin() {
  await borrar(COOKIE_ADMIN);
  redirect('/ingresar');
}

const HASH_VACIO = 'AAAAAAAAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export async function ingresarEquipo(_: Estado, f: FormData): Promise<Estado> {
  const dni = soloDigitos(texto(f, 'dni', 20));
  const clave = soloDigitos(texto(f, 'clave', 20));
  if (!dni || !clave) return { error: 'Completá tu DNI y tu clave.' };
  const dir = await ip();
  if (!permitir(`eq:${dir}`, 15, 600) || !permitir(`eq-dni:${dni}`, 6, 600))
    return { error: 'Demasiados intentos. Probá en unos minutos.' };
  const [e] = await db()`select id, clave_hash from empleados where dni = ${dni} and activo`;
  // Se calcula igual aunque el DNI no exista, para no delatar qué DNIs están cargados.
  const bien = claveCorrecta(clave, (e?.clave_hash as string | null) ?? HASH_VACIO);
  if (!e || !e.clave_hash || !bien)
    return { error: 'El DNI o la clave no son correctos. Si no tenés clave, pedísela a administración.' };
  await escribir(COOKIE_EQUIPO, String(e.id));
  redirect('/mi');
}

export async function salirEquipo() {
  await borrar(COOKIE_EQUIPO);
  redirect('/mi');
}
