"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Detection } from "@mediapipe/tasks-vision";
import { useObjectDetector } from "@/hooks/useObjectDetector";

const PALETTE = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E",
  "#14B8A6", "#3B82F6", "#8B5CF6", "#EC4899",
  "#F43F5E", "#06B6D4",
];

const labelColour = (() => {
  const cache = new Map<string, string>();
  let idx = 0;
  return (label: string) => {
    if (!cache.has(label)) cache.set(label, PALETTE[idx++ % PALETTE.length]);
    return cache.get(label)!;
  };
})();

const TARGET_FPS = 15;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

interface DetectedObject {
  label: string;
  score: number;
  color: string;
}

export default function ObjectDetectionCamera() {
  const { detector, status, error } = useObjectDetector();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [detectedObjects, setDetectedObjects] = useState<DetectedObject[]>([]);
  const [videoSize, setVideoSize] = useState({ width: 640, height: 480 });

  const drawDetections = useCallback(
    (detections: Detection[], width: number, height: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, width, height);
      const objects: DetectedObject[] = [];

      for (const detection of detections) {
        const bbox = detection.boundingBox;
        if (!bbox) continue;

        const label = detection.categories[0]?.categoryName ?? "desconocido";
        const score = detection.categories[0]?.score ?? 0;
        const color = labelColour(label);

        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(bbox.originX, bbox.originY, bbox.width, bbox.height);

        const pct = Math.round(score * 100);
        const text = label + " " + pct + "%";
        ctx.font = "bold 14px Inter, sans-serif";
        const textMetrics = ctx.measureText(text);
        const padX = 6;
        const padY = 4;
        const labelH = 20;
        const labelY =
          bbox.originY > labelH + padY
            ? bbox.originY - labelH - padY
            : bbox.originY + padY;

        ctx.fillStyle = color;
        ctx.fillRect(bbox.originX, labelY - padY, textMetrics.width + padX * 2, labelH + padY);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, bbox.originX + padX, labelY + labelH - padY - 2);

        objects.push({ label, score, color });
      }

      const seen = new Map<string, DetectedObject>();
      for (const obj of objects) {
        const existing = seen.get(obj.label);
        if (!existing || obj.score > existing.score) seen.set(obj.label, obj);
      }
      const sorted = Array.from(seen.values()).sort((a, b) => b.score - a.score);
      setDetectedObjects(sorted);
    },
    []
  );

  const runDetection = useCallback(
    (timestamp: number) => {
      const video = videoRef.current;
      if (!video || !detector || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        rafRef.current = requestAnimationFrame(runDetection);
        return;
      }

      if (timestamp - lastFrameTimeRef.current >= FRAME_INTERVAL_MS) {
        lastFrameTimeRef.current = timestamp;
        try {
          const results = detector.detectForVideo(video, timestamp);
          drawDetections(results.detections, videoSize.width, videoSize.height);
        } catch (e) {
          console.warn("Detection frame skipped:", e);
        }
      }
      rafRef.current = requestAnimationFrame(runDetection);
    },
    [detector, drawDetections, videoSize]
  );

  useEffect(() => {
    if (cameraActive && status === "ready") {
      rafRef.current = requestAnimationFrame(runDetection);
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [cameraActive, status, runDetection]);

  const activateCamera = useCallback(async () => {
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError(
        "Tu navegador no soporta acceso a camara. Usa Chrome, Firefox o Safari en HTTPS."
      );
      return;
    }

    try {
      // Step 1: try with ideal resolution constraints
      let stream: MediaStream | null = null;
      let step1Error: unknown = null;

      try {
        console.log("[Camera] Trying getUserMedia with ideal constraints...");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        console.log("[Camera] Step 1 succeeded");
      } catch (e1) {
        step1Error = e1;
        console.warn("[Camera] Step 1 failed:", e1);
      }

      // Step 2: fallback to bare video:true
      if (!stream) {
        try {
          console.log("[Camera] Trying getUserMedia fallback { video: true }...");
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          console.log("[Camera] Step 2 (fallback) succeeded");
        } catch (e2) {
          console.error("[Camera] Step 2 (fallback) also failed:", e2);
          // Both attempts failed — throw the step1 error (more informative) if available
          throw step1Error ?? e2;
        }
      }

      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Error cargando video."));
      });

      await video.play();

      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      setVideoSize({ width: w, height: h });
      setCameraActive(true);
    } catch (err) {
      console.error("[Camera] Fatal error:", err);

      // Show the raw error name+message for diagnosis
      const errName = err instanceof DOMException ? err.name : (err instanceof Error ? err.constructor.name : "UnknownError");
      const errMsg = err instanceof Error ? err.message : String(err);

      let userMsg = "";
      if (err instanceof DOMException) {
        const n = err.name;
        if (n === "NotAllowedError" || n === "PermissionDeniedError") {
          userMsg = "Permiso de camara denegado. Habilita el acceso en la configuracion del navegador.";
        } else if (n === "NotFoundError" || n === "DevicesNotFoundError") {
          userMsg = "El navegador no encontro una camara disponible.";
        } else if (n === "NotReadableError" || n === "TrackStartError") {
          userMsg = "La camara esta siendo usada por otra aplicacion. Cierrala e intenta de nuevo.";
        } else if (n === "OverconstrainedError") {
          userMsg = "La camara no cumple los requisitos. Intenta de nuevo.";
        } else if (n === "NotSupportedError") {
          userMsg = "Acceso a camara no soportado. Asegurate de estar en HTTPS.";
        } else {
          userMsg = "Error de camara inesperado.";
        }
      } else if (err instanceof Error) {
        userMsg = err.message;
      } else {
        userMsg = "Error desconocido.";
      }

      // Include technical detail for diagnosis
      setCameraError(userMsg + " [" + errName + ": " + errMsg + "]");
    }
  }, []);

  const deactivateCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) video.srcObject = null;

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setDetectedObjects([]);
    setCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      deactivateCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {status === "loading" && (
        <div className="flex items-center gap-3 text-sm text-slate-400 bg-slate-800/60 px-4 py-2 rounded-full">
          <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
          Cargando modelo EfficientDet-Lite0...
        </div>
      )}

      {(status === "error" || error) && (
        <div className="text-sm text-red-400 bg-red-950/40 border border-red-800 px-4 py-2 rounded-lg max-w-md text-center">
          Error modelo: {error ?? "Error al inicializar el detector."}
        </div>
      )}

      {cameraError && (
        <div className="text-sm text-amber-300 bg-amber-950/40 border border-amber-700 px-4 py-2 rounded-lg max-w-xl text-center break-all">
          {cameraError}
        </div>
      )}

      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl bg-black border border-slate-700"
        style={{ width: videoSize.width, maxWidth: "100%" }}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          className="block w-full h-auto"
        />
        <canvas
          ref={canvasRef}
          width={videoSize.width}
          height={videoSize.height}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {!cameraActive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 gap-3">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-16 h-16 text-slate-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z"
              />
            </svg>
            <p className="text-slate-500 text-sm">Camara desactivada</p>
          </div>
        )}

        {cameraActive && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full text-xs font-semibold text-white backdrop-blur-sm">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            EN VIVO
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {!cameraActive ? (
          <button
            onClick={activateCamera}
            disabled={status === "loading" || status === "error"}
            aria-label="Activar camara"
            className="px-6 py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-900/40"
          >
            {status === "loading" ? "Cargando modelo..." : "Activar camara"}
          </button>
        ) : (
          <button
            onClick={deactivateCamera}
            aria-label="Detener camara"
            className="px-6 py-3 rounded-xl font-semibold text-sm bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-white transition-colors shadow-lg"
          >
            Detener camara
          </button>
        )}
      </div>

      {cameraActive && (
        <div className="w-full max-w-xl">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
            Objetos detectados
          </h2>
          {detectedObjects.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-4">
              Ningun objeto detectado...
            </p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {detectedObjects.map(({ label, score, color }) => (
                <li
                  key={label}
                  className="flex items-center gap-3 bg-slate-800/70 border border-slate-700 rounded-xl px-4 py-2.5"
                >
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="flex-1 capitalize text-sm text-slate-200 truncate">
                    {label}
                  </span>
                  <span className="text-xs font-mono font-semibold text-slate-400">
                    {Math.round(score * 100)}%
                  </span>
                  <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: Math.round(score * 100) + "%",
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
