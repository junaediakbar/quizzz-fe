import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
