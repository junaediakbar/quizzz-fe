import type { NextConfig } from 'next';
import { execSync } from 'node:child_process';
import pkg from './package.json';

const commit = (() => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'dev';
  }
})();

const nextConfig: NextConfig = {
  output: 'standalone',
  env: { NEXT_PUBLIC_APP_VERSION: `v${pkg.version} (${commit})` },
  outputFileTracingRoot: process.cwd(),
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'imgbb.com',
        port: '',
        pathname: '/**', // ganti jadi /**
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        port: '',
        pathname: '/**', // ganti jadi /**
      },
    ],
  },
};

export default nextConfig;
