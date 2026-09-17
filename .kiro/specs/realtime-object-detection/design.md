# Design Document

## Overview

Aplicación web 100% client-side de reconocimiento de objetos en tiempo real. Utiliza Next.js 14 App Router con TypeScript, MediaPipe Tasks Vision corriendo en WebAssembly directamente en el navegador, y Tailwind CSS para estilos. No tiene backend, base de datos ni autenticación. El despliegue objetivo es Vercel.

## Architecture

### High-Level Architecture

```
Browser (Client-Side Only)
├── Next.js 14 App Router (SSR shell → hydration → pure client)
│   └── app/
│       ├── layout.tsx          # Root layout con metadata
│       └── page.tsx            # Entry point → renders <ObjectDetectionApp>
├── components/
│   └── ObjectDetectionApp.tsx  # "use client" — componente principal
├── hooks/
│   ├── useObjectDetector.ts    # Inicialización del modelo MediaPipe
│   └── useCamera.ts            # getUserMedia + VideoStream lifecycle
├── lib/
│   └── drawDetections.ts       # Lógica de dibujo en canvas
└── types/
    └── detection.ts            # Tipos TypeScript compartidos
```

### Data Flow

```
getUserMedia → <video> element → requestAnimationFrame loop
    → detectForVideo(videoEl, timestamp)
        → DetectionResult
            → drawDetections(canvas, result, videoEl)   [canvas overlay]
            → setDetections(result.detections)           [React state → DetectionList]
```

### Component Hierarchy

```
ObjectDetectionApp (use client)
├── CameraButton          — Botón Activar/Desactivar cámara
├── LoadingIndicator      — Spinner durante carga del modelo
├── VideoSection
│   ├── <video>           — VideoStream (muted, autoplay, playsInline)
│   └── <canvas>          — OverlayCanvas (posición absoluta, z-index > video)
└── DetectionList         — Lista de objetos detectados con confianza
```

## Components and Interfaces

### TypeScript Types (`types/detection.ts`)

```typescript
export interface DetectedObject {
  label: string;
  score: number;         // 0.0 – 1.0
  boundingBox: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  };
}

export type CameraState = "idle" | "loading-model" | "requesting-camera" | "active" | "error";
```

### Hook: `useObjectDetector`

Responsibilities:
- Instanciar `FilesetResolver` y `ObjectDetector` de `@mediapipe/tasks-vision`
- Gestionar el ciclo de vida: `null` → `loading` → `ready` | `error`
- Exponer `{ detector, isLoading, error }`

```typescript
interface UseObjectDetectorReturn {
  detector: ObjectDetector | null;
  isLoading: boolean;
  error: string | null;
}
```

Initialization sequence:
1. `FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm")`
2. `ObjectDetector.createFromOptions(vision, { baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite", delegate: "GPU" }, runningMode: "VIDEO", scoreThreshold: 0.4 })`
3. On error: set `error` string, `detector` remains `null`

### Hook: `useCamera`

Responsibilities:
- Llamar `getUserMedia` y asignar el stream al `<video>` ref
- Gestionar parada del stream al desmontar o al desactivar
- Exponer el estado del stream y funciones de control

```typescript
interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  isStreaming: boolean;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  cameraError: string | null;
}
```

### Component: `ObjectDetectionApp`

State:
- `cameraState: CameraState`
- `detections: DetectedObject[]`
- `lastFrameTime: number` — for FPS throttle

Detection loop (via `useEffect` + `requestAnimationFrame`):
```typescript
const TARGET_FPS = 20;
const MS_PER_FRAME = 1000 / TARGET_FPS;

function detectionLoop(timestamp: number) {
  if (timestamp - lastFrameTimeRef.current >= MS_PER_FRAME) {
    const result = detector.detectForVideo(videoRef.current, timestamp);
    drawDetections(canvasRef.current, result, videoRef.current);
    setDetections(mapDetections(result.detections));
    lastFrameTimeRef.current = timestamp;
  }
  animFrameRef.current = requestAnimationFrame(detectionLoop);
}
```

Cleanup: `cancelAnimationFrame` on unmount or stream stop.

### Utility: `drawDetections`

```typescript
function drawDetections(
  canvas: HTMLCanvasElement,
  result: ObjectDetectorResult,
  video: HTMLVideoElement
): void
```

Algorithm:
1. Sync canvas dimensions to `video.offsetWidth` / `video.offsetHeight`
2. `ctx.clearRect(0, 0, canvas.width, canvas.height)`
3. For each detection:
   - Scale bounding box coordinates from model output (normalized 0-1) to canvas pixels
   - `ctx.strokeRect` with `BOX_COLOR` (`#00FF88`) and `lineWidth: 2`
   - Fill label background rectangle above the box
   - `ctx.fillText` with `"label XX%"` in white on dark background
4. Coordinate scaling formula:
   ```
   x = originX * canvas.width
   y = originY * canvas.height
   w = width   * canvas.width
   h = height  * canvas.height
   ```

Note: MediaPipe EfficientDet-Lite0 devuelve coordenadas absolutas en píxeles relativos al frame de video intrínseco, no normalizadas. Se debe escalar usando `video.videoWidth` / `video.videoHeight` como referencia.

### Component: `DetectionList`

Props:
```typescript
interface DetectionListProps {
  detections: DetectedObject[];
}
```

Behavior:
- Ordena por `score` descendente
- Si vacío: muestra "No se detectaron objetos"
- Cada ítem: `"${label} — ${Math.round(score * 100)}%"`

## Project Structure

```
realtime-object-detection/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ObjectDetectionApp.tsx
│   ├── DetectionList.tsx
│   ├── CameraButton.tsx
│   └── LoadingIndicator.tsx
├── hooks/
│   ├── useObjectDetector.ts
│   └── useCamera.ts
├── lib/
│   └── drawDetections.ts
├── types/
│   └── detection.ts
├── public/
│   └── (vacío o favicon)
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
├── package.json
├── vercel.json
└── README.md
```

## Configuration Files

### `next.config.ts`

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
```

### `vercel.json`

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

### `package.json` (dependencies)

```json
{
  "dependencies": {
    "next": "14.2.29",
    "@mediapipe/tasks-vision": "0.10.14",
    "react": "^18",
    "react-dom": "^18"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "tailwindcss": "^3",
    "postcss": "^8",
    "autoprefixer": "^10"
  }
}
```

## Error Handling Strategy

| Error Scenario | State | UI Feedback |
|---|---|---|
| Model load failure (network) | `cameraState = "error"` | Banner rojo: "Error al cargar el modelo. Verifica tu conexión." |
| Camera permission denied | `cameraState = "error"` | Banner rojo: "Permiso de cámara denegado. Habilítalo en la configuración del navegador." |
| getUserMedia not available | `cameraState = "error"` | Banner rojo: "Tu navegador no soporta acceso a cámara o no estás en HTTPS." |
| detectForVideo exception | console.error + continue loop | Sin interrupción de UI |
| requestAnimationFrame not supported | Render note | Mensaje: "Tu navegador no es compatible." |

## UI/UX Design

### Layout (Mobile-first, Tailwind)

```
┌─────────────────────────────────────┐
│  🎯 Detección de Objetos en Tiempo  │
│       Real                          │
│  [descripción breve]                │
│                                     │
│  [Spinner / Error Banner]           │
│                                     │
│  ┌─────────────────────────────┐    │
│  │   <video>                   │    │
│  │   <canvas overlay>          │    │
│  └─────────────────────────────┘    │
│                                     │
│  [Activar cámara] / [Desactivar]    │
│                                     │
│  Objetos detectados:                │
│  • person — 92%                     │
│  • laptop — 87%                     │
│  • cup    — 54%                     │
└─────────────────────────────────────┘
```

### Visual Style
- Fondo oscuro: `bg-gray-900` / `bg-gray-950`
- Texto claro: `text-white` / `text-gray-300`
- Botón primario: `bg-green-500 hover:bg-green-600`
- Botón destructivo: `bg-red-500 hover:bg-red-600`
- BoundingBox color: `#00FF88` (verde brillante)
- Label background: `rgba(0, 0, 0, 0.7)`
- Canvas `mix-blend-mode: normal` con `pointer-events: none`

## Correctness Properties

### Property 1: FPS Throttle Invariant

Para cada par de frames consecutivos procesados, la diferencia de timestamp MUST ser ≥ 50ms (1000ms / 20 FPS).

```
∀ t₁, t₂ ∈ processedFrames, t₁ < t₂ → t₂ - t₁ ≥ 50
```

Validates: Requirement 4.2

### Property 2: Canvas Coordinate Scaling

Para cualquier detección con bounding box `(ox, oy, w, h)` en coordenadas de video intrínseco `(vW, vH)` y canvas de tamaño `(cW, cH)`, las coordenadas dibujadas satisfacen:

```
drawnX = ox * (cW / vW)
drawnY = oy * (cH / vH)
drawnW = w  * (cW / vW)
drawnH = h  * (cH / vH)
```

Validates: Requirement 5.7

### Property 3: Detection List Ordering

La DetectionList MUST estar ordenada por score descendente:

```
∀ i < j → detections[i].score ≥ detections[j].score
```

Validates: Requirement 6.5

### Property 4: Canvas Cleared Per Frame

Para cada frame procesado, el canvas se limpia antes de dibujar nuevas detecciones, garantizando que no hay artefactos de frames anteriores:

```
∀ frame f: clearRect(0, 0, cW, cH) precedes any strokeRect in f
```

Validates: Requirement 5.4
