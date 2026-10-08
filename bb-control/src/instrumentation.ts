// Al arrancar el servidor: si Contabilium está conectado y la sincronización automática activada,
// trae las ventas de los últimos 35 días cada 6 horas (la primera vez, 2 minutos después de arrancar).
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || !process.env.DATABASE_URL) return;
  const SEIS_HORAS = 6 * 60 * 60 * 1000;
  const correr = async () => {
    try {
      const { credenciales, leerConfig, rangoAutomatico, sincronizarVentas } = await import('./lib/contabilium');
      if (!(await credenciales()) || !(await leerConfig()).auto) return;
      const { desde, hasta } = rangoAutomatico();
      const r = await sincronizarVentas(desde, hasta);
      console.log(`[contabilium] ${r.ok ? r.mensaje : `error: ${r.error}`}`);
    } catch (e) {
      console.error('[contabilium] no se pudo sincronizar', e);
    }
  };
  setTimeout(() => {
    correr();
    setInterval(correr, SEIS_HORAS).unref();
  }, 2 * 60 * 1000).unref();
}
