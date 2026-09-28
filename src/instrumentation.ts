export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const { sincronizarLogosSemilla } = await import('./lib/logos');
  sincronizarLogosSemilla().catch((e) => console.error('[logos]', e));
}
