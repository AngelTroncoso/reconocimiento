/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // COOP is safe and recommended for WASM isolation.
          // COEP (require-corp) is intentionally omitted: it blocks getUserMedia
          // in some browsers and is not required by MediaPipe Tasks Vision 0.10.x.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
