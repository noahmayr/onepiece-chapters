import withPlaiceholder from '@plaiceholder/next';
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.*.com',
        port: '',
        pathname: '**',
      },
    ],
  },
};

export default withPlaiceholder(nextConfig);
