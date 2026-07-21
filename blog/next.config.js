const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/blog',
  // Em produção, os assets precisam apontar para o domínio do projeto do blog
  // (multi-zones): o projeto principal só faz rewrite das rotas /blog/*.
  assetPrefix:
    process.env.VERCEL_ENV === 'production'
      ? 'https://auracomex-blog.vercel.app'
      : undefined,
  experimental: {
    mdxRs: true,
    // Trava a raiz do projeto nesta pasta — sem isso, o Next pode inferir a raiz
    // como uma pasta pai (ex: onde fica o projeto principal, ou até a raiz do
    // drive C:\ no Windows) e tentar rastrear/observar arquivos fora daqui.
    outputFileTracingRoot: path.join(__dirname),
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
  },
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/node_modules/**', '**/.git/**', 'C:/pagefile.sys', 'C:/hiberfil.sys', 'C:/swapfile.sys', 'C:/DumpStack.log.tmp'],
    };
    return config;
  },
};

module.exports = nextConfig;
