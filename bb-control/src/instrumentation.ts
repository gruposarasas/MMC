// Al arrancar el servidor:
// - si Contabilium está conectado y la sincronización automática activada, trae las ventas de los últimos 35 días
//   cada 6 horas (la primera vez, 2 minutos después de arrancar);
// - el dólar BNA (si está en automático), al arrancar y cada 30 minutos.
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

  const dolar = async () => {
    try {
      const { actualizarDolar } = await import('./lib/dolar');
      const r = await actualizarDolar();
      if (r.ok) console.log(`[dolar] BNA ${r.dolar!.valor} (${r.dolar!.fecha})`);
      else if (r.error !== 'El dólar está en manual.') console.error(`[dolar] ${r.error}`);
    } catch (e) {
      console.error('[dolar] no se pudo actualizar', e);
    }
  };
  setTimeout(async () => {
    await dolar();
    setInterval(dolar, 30 * 60 * 1000).unref();
    try {
      const { completarHistorial } = await import('./lib/dolar');
      const n = await completarHistorial();
      if (n) console.log(`[dolar] historial: ${n} días`);
    } catch (e) {
      console.error('[dolar] no se pudo traer el historial', e instanceof Error ? e.message : e);
    }
  }, 10 * 1000).unref();
}
