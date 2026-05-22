/** @type {import('next').NextConfig} */
const nextConfig = {
  // output:"export" is required for Netlify/Capacitor static builds (npm run build).
  // It must NOT be set in dev — it causes all /_next/static/ chunks to 404 on macOS.
  ...(process.env.NODE_ENV === "production" ? { output: "export" } : {}),
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
};

module.exports = nextConfig;
