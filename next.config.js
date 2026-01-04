/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // Use environment variable if set, otherwise default to localhost
    // To use cloud API, create .env.local file with: NEXT_PUBLIC_API_URL=https://your-api-domain.com
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  },
}

module.exports = nextConfig


