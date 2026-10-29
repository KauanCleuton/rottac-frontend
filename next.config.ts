import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permitir imagens do backend local
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: 'localhost', port: '3001', pathname: '/uploads/**' },
    ],
  },
  // Proxy de API — evita CORS em dev
  async rewrites() {
    // BACKEND_URL (só no servidor) permite NEXT_PUBLIC_API_URL relativo ("/api/v1") atrás de um túnel
    const backendBase = process.env.BACKEND_URL
      || (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1').replace('/api/v1', '');
    return [
      {
        source: '/api/v1/:path*',
        destination: `${backendBase}/api/v1/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendBase}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;
