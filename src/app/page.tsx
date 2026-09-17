import dynamic from "next/dynamic";

// Load the camera component only on the client — it uses browser APIs.
const ObjectDetectionCamera = dynamic(
  () => import("@/components/ObjectDetectionCamera"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        Iniciando…
      </div>
    ),
  },
);

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center py-12 px-4">
      {/* Header */}
      <header className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-950/60 border border-indigo-800/50 text-indigo-300 text-xs font-semibold px-3 py-1 rounded-full mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
          100% client-side · MediaPipe · WASM
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-br from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
          Detección de objetos
          <br />
          en tiempo real
        </h1>
        <p className="mt-4 text-slate-400 max-w-md mx-auto text-sm leading-relaxed">
          Powered by{" "}
          <a
            href="https://developers.google.com/mediapipe"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:text-indigo-300 transition-colors underline underline-offset-2"
          >
            MediaPipe Tasks Vision
          </a>{" "}
          y EfficientDet-Lite2. El modelo corre completamente en tu navegador,
          ningún dato sale de tu dispositivo.
        </p>
      </header>

      {/* Camera + detection UI */}
      <div className="w-full max-w-3xl">
        <ObjectDetectionCamera />
      </div>

      {/* Footer */}
      <footer className="mt-16 text-slate-600 text-xs text-center">
        <p>
          Modelo: EfficientDet-Lite2 (float32) · 80 clases COCO ·{" "}
          <span className="text-slate-500">~15 FPS</span>
        </p>
        <p className="mt-1">
          No se almacenan imágenes ni datos de ningún tipo.
        </p>
      </footer>
    </main>
  );
}
