/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    // MediaPipe Tasks Vision loads WASM via eval() internally.
    // unsafe-eval is required for the WASM runtime to work.
    // unsafe-inline is required for Next.js inline scripts.
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "connect-src 'self' https://storage.googleapis.com https://cdn.jsdelivr.net",
      "worker-src 'self' blob:",
      "wasm-src 'self' https://cdn.jsdelivr.net",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
