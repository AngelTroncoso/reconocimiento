"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ObjectDetector,
  ObjectDetectorOptions,
} from "@mediapipe/tasks-vision";

// EfficientDet-Lite2 (float32) — better accuracy than Lite0, still fast enough for real-time.
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float32/1/efficientdet_lite2.tflite";

// WASM runtime files are served from the same CDN so no local files are needed.
const WASM_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

export type DetectorStatus = "idle" | "loading" | "ready" | "error";

export interface UseObjectDetectorReturn {
  detector: ObjectDetector | null;
  status: DetectorStatus;
  error: string | null;
}

export function useObjectDetector(): UseObjectDetectorReturn {
  const detectorRef = useRef<ObjectDetector | null>(null);
  const [status, setStatus] = useState<DetectorStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function initDetector() {
      setStatus("loading");
      setError(null);

      try {
        // Dynamic import so the heavy WASM module is only loaded client-side.
        const vision = await import("@mediapipe/tasks-vision");
        const { FilesetResolver, ObjectDetector: MPObjectDetector } = vision;

        const filesetResolver = await FilesetResolver.forVisionTasks(
          WASM_BASE_URL,
        );

        const options: ObjectDetectorOptions = {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          maxResults: 10,
          scoreThreshold: 0.35,
        };

        const objectDetector = await MPObjectDetector.createFromOptions(
          filesetResolver,
          options,
        );

        if (!cancelled) {
          detectorRef.current = objectDetector;
          setStatus("ready");
        } else {
          objectDetector.close();
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to initialise ObjectDetector:", err);
          setError(
            err instanceof Error
              ? err.message
              : "Error al cargar el modelo de detección.",
          );
          setStatus("error");
        }
      }
    }

    initDetector();

    return () => {
      cancelled = true;
      detectorRef.current?.close();
      detectorRef.current = null;
    };
  }, []);

  return { detector: detectorRef.current, status, error };
}
