import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // La app vive en una carpeta del repo de MMC: que no tome la raíz del repo como base.
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  // Queda fuera del bundle para que también lo use scripts/migrar.mjs en el contenedor.
  serverExternalPackages: ['postgres'],
  // Certificados médicos (fotos o PDF) y Excel de ventas ya leído en el navegador.
  experimental: { serverActions: { bodySizeLimit: '12mb' } },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
