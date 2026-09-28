// Cliente de Supabase con la service role. Solo se usa en el servidor.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { envRuntime } from './config';

let cliente: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (typeof window !== 'undefined') throw new Error('db() es solo del servidor');
  if (!cliente) {
    const url = envRuntime('NEXT_PUBLIC_SUPABASE_URL');
    const key = envRuntime('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
    cliente = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return cliente;
}
