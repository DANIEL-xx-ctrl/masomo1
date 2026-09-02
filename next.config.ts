import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1", "localhost", "21.0.12.15", "21.0.10.146", "space-z.ai", "preview-chat-15bf4e86-5baa-4754-a2a7-d1c1bb2ceee6.space-z.ai"],
  // Ensure the Prisma engine binary is included in the standalone output.
  // Without this, the bundled server crashes on startup with
  // "Query engine library not found" when run inside Tauri.
  outputFileTracingIncludes: {
    "/": ["./node_modules/.prisma/client/**/*", "./node_modules/@prisma/client/**/*"],
  },
  // Allow large file uploads (videos up to 50MB) via API routes.
  // Vercel's default body size limit is 4.5MB; this raises it to 50MB.
  // NOTE: On Vercel Hobby plan, the actual limit is 4.5MB for serverless
  // function body. For larger uploads, use Vercel Blob or direct-to-storage.
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
