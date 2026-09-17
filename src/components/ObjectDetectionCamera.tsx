"use client";

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Detection } from "@mediapipe/tasks-vision";
import { useObjectDetector } from "@/hooks/useObjectDetector";

// ------------------------------------------------------------------
// Colour palette — one colour per label for consistent bounding boxes
// ------------------------------------------------------------------
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

// ------------------------------------------------------------------
// Target frame rate
// ------------------------------------------------------------------
const TARGET_FPS = 15;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
interface DetectedObject {
  label: string;
  score: number;
  color: string;
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------
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

  // ----------------------------------------------------------------
  // Draw bounding boxes on canvas
  // ----------------------------------------------------------------
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

        const label =
          detection.categories[0]?.categoryName ?? "desconocido";
        const score = detection.categories[0]?.score ?? 0;
        const color = labelColour(label);

        // Bounding box
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(bbox.originX, bbox.originY, bbox.width, bbox.height);

        // Label background
        const text = `${label} ${Math.round(score * 100)}%`;
        ctx.font = "bold 14px Inter, sans-serif";
        const textMetrics = ctx.measureText(text);
        const padX = 6;
        const padY = 4;
        const labelH = 20;
        const labelY = bbox.originY > labelH + padY
          ? bbox.originY - labelH - padY
          : bbox.originY + padY;

        ctx.fillStyle = color;
        ctx.fillRect(
          bbox.originX,
          labelY - padY,
          textMetrics.width + padX * 2,
          labelH + padY,
        );

        // Label text
        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, bbox.originX + padX, labelY + labelH - padY - 2);

        objects.push({ label, score, color });
      }

      // Deduplicate by label (keep highest score)
      const seen = new Map<string, DetectedObject>();
      for (const obj of objects) {
        const existing = seen.get(obj.label);
        if (!existing || obj.score > existing.score) seen.set(obj.label, obj);
      }

      setDetectedObjects(Array.from(seen.values()).sort((a, b) => b.score - a.score));
    },
    [],
  );

  // ----------------------------------------------------------------
  // Detection loop
  // ----------------------------------------------------------------
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
          drawDetections(
            results.detections,
            videoSize.width,
            videoSize.height,
          );
        } catch (e) {
          // Silently ignore transient errors (e.g. frame not ready)
          console.warn("Detection frame skipped:", e);
        }
      }

      rafRef.current = requestAnimationFrame(runDetection);
    },
    [detector, drawDetections, videoSize],
  );

  // ----------------------------------------------------------------
  // Start / stop detection loop when camera + detector are ready
  // ----------------------------------------------------------------
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

  // ----------------------------------------------------------------
  // Activate camera
  // ----------------------------------------------------------------
  const activateCamera = useCallback(async () => {
    setCameraError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "environment",
        },
        audio: false,
      });

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
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Permiso de cámara denegado. Habilítalo en la configuración del navegador."
          : err instanceof DOMException && err.name === "NotFoundError"
            ? "No se encontró ninguna cámara en este dispositivo."
            : err instanceof Error
              ? err.message
              : "Error desconocido al acceder a la cámara.";
      setCameraError(msg);
    }
  }, []);

  // ----------------------------------------------------------------
  // Deactivate camera
  // ----------------------------------------------------------------
  const deactivateCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }

    setDetectedObjects([]);
    setCameraActive(false);
  }, []);

  // ----------------------------------------------------------------
  // Cleanup on unmount
  // ----------------------------------------------------------------
  useEffect(() => {
    return () => {
      deactivateCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------
  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {/* Model loading status */}
      {status === "loading" && (
        <div className="flex items-center gap-3 text-sm text-slate-400 bg-slate-800/60 px-4 py-2 rounded-full">
          <span className="inline-block w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
          Cargando modelo EfficientDet-Lite0…
        </div>
      )}

      {(status === "error" || error) && (
        <div className="text-sm text-red-400 bg-red-950/40 border border-red-800 px-4 py-2 rounded-lg max-w-md text-center">
          ⚠️ {error ?? "Error al inicializar el detector."}
        </div>
      )}

      {/* Camera error */}
      {cameraError && (
        <div className="text-sm text-amber-300 bg-amber-950/40 border border-amber-700 px-4 py-2 rounded-lg max-w-md text-center">
          📷 {cameraError}
        </div>
      )}

      {/* Video + canvas overlay */}
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl bg-black border border-slate-700"
        style={{ width: videoSize.width, maxWidth: "100%" }}
      >
        <video
          ref={videoRef}
          muted
          playsInline
          className="block w-full h-auto"
          style={{ aspectRatio: `${videoSize.width}/${videoSize.height}` }}
        />
        <canvas
          ref={canvasRef}
          width={videoSize.width}
          height={videoSize.height}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />

        {/* Placeholder when camera is off */}
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
            <p className="text-slate-500 text-sm">Cámara desactivada</p>
          </div>
        )}

        {/* Live indicator */}
        {cameraActive && (
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 px-2.5 py-1 rounded-full text-xs font-semibold text-white backdrop-blur-sm">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            EN VIVO
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        {!cameraActive ? (
          <button
            onClick={activateCamera}
            disabled={status === "loading" || status === "error"}
            className="px-6 py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-900/40"
          >
            {status === "loading" ? "Cargando modelo…" : "Activar cámara"}
          </button>
        ) : (
          <button
            onClick={deactivateCamera}
            className="px-6 py-3 rounded-xl font-semibold text-sm bg-slate-700 hover:bg-slate-600 active:bg-slate-800 text-white transition-colors shadow-lg"
          >
            Detener cámara
          </button>
        )}
      </div>

      {/* Detected objects list */}
      {cameraActive && (
        <div className="w-full max-w-xl">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-3">
            Objetos detectados
          </h2>

          {detectedObjects.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-4">
              Ningún objeto detectado…
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
                  {/* Confidence bar */}
                  <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.round(score * 100)}%`, backgroundColor: color }}
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
