/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static export for Capacitor wrapping. Produces /out directory.
  // Middleware (middleware.ts) is kept for reference but does not run
  // against the static export — AuthGuard.tsx handles client-side auth.
  output: "export",
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
};

module.exports = nextConfig;
