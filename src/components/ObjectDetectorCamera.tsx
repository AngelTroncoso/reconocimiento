"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  ObjectDetector,
  FilesetResolver,
  Detection,
} from "@mediapipe/tasks-vision";

// EfficientDet-Lite0 model — loaded from the official MediaPipe CDN
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite";

// WASM binaries hosted on the MediaPipe CDN
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

// Target frame interval — roughly 20 FPS max
const FRAME_INTERVAL_MS = 50;

type AppState = "idle" | "loading-model" | "requesting-camera" | "running" | "error";

// Distinct colours per detected label to make boxes easier to read
const LABEL_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899",
];
const labelColorMap = new Map<string, string>();
let colorIndex = 0;
function getColorForLabel(label: string): string {
  if (!labelColorMap.has(label)) {
    labelColorMap.set(label, LABEL_COLORS[colorIndex % LABEL_COLORS.length]);
    colorIndex++;
  }
  return labelColorMap.get(label)!;
}

export default function ObjectDetectorCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<ObjectDetector | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);

  const [appState, setAppState] = useState<AppState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [detections, setDetections] = useState<Detection[]>([]);

  // Load the MediaPipe ObjectDetector (WASM + model from CDN)
  const loadModel = useCallback(async () => {
    setAppState("loading-model");
    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      const detector = await ObjectDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "GPU", // falls back to CPU automatically if WebGL unavailable
        },
        scoreThreshold: 0.4,
        runningMode: "VIDEO",
        maxResults: 10,
      });
      detectorRef.current = detector;
    } catch (err) {
      console.error("Failed to load model:", err);
      setErrorMsg(
        "No se pudo cargar el modelo de detección. Verifica tu conexión e intenta de nuevo."
      );
      setAppState("error");
    }
  }, []);

  // Start the camera stream
  const startCamera = useCallback(async () => {
    setAppState("requesting-camera");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setAppState("running");
    } catch (err) {
      console.error("Camera error:", err);
      const domError = err as DOMException;
      if (
        domError.name === "NotAllowedError" ||
        domError.name === "PermissionDeniedError"
      ) {
        setErrorMsg(
          "Permiso de cámara denegado. Habilita el acceso en la configuración de tu navegador."
        );
      } else if (
        domError.name === "NotFoundError" ||
        domError.name === "DevicesNotFoundError"
      ) {
        setErrorMsg(
          "No se encontró ninguna cámara en este dispositivo."
        );
      } else {
        setErrorMsg(
          "No se pudo acceder a la cámara. Verifica que no esté en uso por otra aplicación."
        );
      }
      setAppState("error");
    }
  }, []);

  // Draw bounding boxes on the canvas overlay
  const drawDetections = useCallback(
    (dets: Detection[], videoWidth: number, videoHeight: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Keep canvas dimensions in sync with the video element's rendered size
      canvas.width = videoWidth;
      canvas.height = videoHeight;
      ctx.clearRect(0, 0, videoWidth, videoHeight);

      for (const det of dets) {
        if (!det.boundingBox) continue;
        const { originX, originY, width, height } = det.boundingBox;
        const label = det.categories[0]?.categoryName ?? "objeto";
        const score = det.categories[0]?.score ?? 0;
        const color = getColorForLabel(label);

        // Bounding box
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.strokeRect(originX, originY, width, height);

        // Label pill background
        const text = `${label} ${(score * 100).toFixed(0)}%`;
        ctx.font = "bold 14px sans-serif";
        const textMetrics = ctx.measureText(text);
        const pillW = textMetrics.width + 12;
        const pillH = 22;
        const pillX = originX;
        const pillY = originY > pillH ? originY - pillH : originY + 2;

        ctx.fillStyle = color;
        ctx.beginPath();
        // roundRect is not available in all browsers — use manual path as fallback
        const r = 4;
        ctx.moveTo(pillX + r, pillY);
        ctx.lineTo(pillX + pillW - r, pillY);
        ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + r);
        ctx.lineTo(pillX + pillW, pillY + pillH - r);
        ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - r, pillY + pillH);
        ctx.lineTo(pillX + r, pillY + pillH);
        ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - r);
        ctx.lineTo(pillX, pillY + r);
        ctx.quadraticCurveTo(pillX, pillY, pillX + r, pillY);
        ctx.closePath();
        ctx.fill();

        // Label text
        ctx.fillStyle = "#ffffff";
        ctx.fillText(text, pillX + 6, pillY + 15);
      }
    },
    []
  );

  // Main detection loop — throttled to ~20 FPS
  const runDetectionLoop = useCallback(() => {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (!video || !detector || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(runDetectionLoop);
      return;
    }

    const now = performance.now();
    if (now - lastFrameTimeRef.current >= FRAME_INTERVAL_MS) {
      lastFrameTimeRef.current = now;
      try {
        const result = detector.detectForVideo(video, now);
        drawDetections(
          result.detections,
          video.videoWidth,
          video.videoHeight
        );
        setDetections(result.detections);
      } catch (err) {
        // Swallow individual frame errors — don't crash the loop
        console.warn("Detection frame error:", err);
      }
    }

    rafRef.current = requestAnimationFrame(runDetectionLoop);
  }, [drawDetections]);

  // Kick off the detection loop once the app is running
  useEffect(() => {
    if (appState === "running") {
      rafRef.current = requestAnimationFrame(runDetectionLoop);
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [appState, runDetectionLoop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      detectorRef.current?.close();
    };
  }, []);

  // Main CTA handler: load model then start camera
  const handleActivate = useCallback(async () => {
    await loadModel();
    // Only proceed if model loaded successfully
    if (detectorRef.current) {
      await startCamera();
    }
  }, [loadModel, startCamera]);

  const handleRetry = useCallback(() => {
    setErrorMsg("");
    setDetections([]);
    setAppState("idle");
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-white tracking-tight">
        Detección de Objetos en Tiempo Real
      </h1>
      <p className="text-slate-400 text-sm text-center">
        Powered by MediaPipe EfficientDet-Lite0 · 100% en el navegador
      </p>

      {/* ---- Video + Canvas overlay ---- */}
      {(appState === "running" || appState === "requesting-camera") && (
        <div className="relative w-full rounded-xl overflow-hidden bg-black shadow-2xl">
          <video
            ref={videoRef}
            className="w-full block"
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />
        </div>
      )}

      {/* ---- Idle state: big activate button ---- */}
      {appState === "idle" && (
        <div className="flex flex-col items-center gap-4 mt-8">
          <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center text-5xl">
            📷
          </div>
          <button
            onClick={handleActivate}
            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold rounded-xl text-lg transition-colors duration-150 shadow-lg"
          >
            Activar cámara
          </button>
          <p className="text-slate-500 text-xs text-center max-w-xs">
            Se pedirá permiso de cámara. El modelo se carga desde la CDN de
            MediaPipe (~5 MB). No se envía ningún dato al servidor.
          </p>
        </div>
      )}

      {/* ---- Loading states ---- */}
      {(appState === "loading-model" || appState === "requesting-camera") && (
        <div className="flex flex-col items-center gap-3 mt-8">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-300 text-sm">
            {appState === "loading-model"
              ? "Cargando modelo de detección…"
              : "Iniciando cámara…"}
          </p>
        </div>
      )}

      {/* ---- Error state ---- */}
      {appState === "error" && (
        <div className="flex flex-col items-center gap-4 mt-4 max-w-sm text-center">
          <div className="text-4xl">⚠️</div>
          <p className="text-red-400 text-sm">{errorMsg}</p>
          <button
            onClick={handleRetry}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ---- Detections list ---- */}
      {appState === "running" && (
        <div className="w-full">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Objetos detectados
          </h2>
          {detections.length === 0 ? (
            <p className="text-slate-600 text-sm">
              Apunta la cámara a objetos comunes…
            </p>
          ) : (
            <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {detections.map((det, i) => {
                const label = det.categories[0]?.categoryName ?? "objeto";
                const score = det.categories[0]?.score ?? 0;
                const color = getColorForLabel(label);
                return (
                  <li
                    key={i}
                    className="flex items-center gap-2 bg-slate-800 rounded-lg px-3 py-2 text-sm"
                  >
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-white truncate">{label}</span>
                    <span className="ml-auto text-slate-400 flex-shrink-0">
                      {(score * 100).toFixed(0)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
