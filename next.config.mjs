/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  serverExternalPackages: ['mongoose', 'bcryptjs']
};

export default nextConfig;
