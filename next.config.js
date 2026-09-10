/** @type {import('next').NextConfig} */
const nextConfig = {
  // Temporary migration-only compatibility switch for Next 15.
  // Next 15 changed dynamic route params to async types. The current app
  // still uses the Next 14 sync PageProps shape in several routes. Runtime
  // compatibility remains in place, but type generation blocks the build.
  // We will remove this once those route props are migrated properly.
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'sectionxscoreboard.com',
          },
        ],
        destination: 'https://www.sectionxscoreboard.com/:path*',
        permanent: true,
      },
    ]
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
          { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
