/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/app2',
  assetPrefix: '/app2',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  output: 'standalone',
}

export default nextConfig
