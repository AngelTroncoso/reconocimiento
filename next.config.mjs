/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the MediaPipe WASM files served from CDN — no local bundling needed.
  // Cross-Origin headers are required so SharedArrayBuffer (used by WASM) works.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
  webpack(config) {
    // Prevent Next.js from trying to bundle the MediaPipe WASM binary.
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    return config;
  },
};

export default nextConfig;
