# Design: Real-Time Object Detection

## Architecture Overview

The application is a single-page Next.js 14 App Router project. The root page (`app/page.tsx`) is a server component that renders the shell. All interactive logic lives in a single client component: `ObjectDetector`. No API routes exist. MediaPipe WASM and the model file are loaded from public CDNs at runtime.

```
app/
├── layout.tsx              # Root layout (fonts, metadata, Tailwind)
├── page.tsx                # Server component — renders <ObjectDetectorView />
├── globals.css             # Tailwind base directives
components/
└── ObjectDetectorView.tsx  # "use client" — all camera + detection logic
```

---

## Component Design: `ObjectDetectorView`

### State

| State variable     | Type                       | Description |
|--------------------|----------------------------|-------------|
| `modelStatus`      | `'idle' \| 'loading' \| 'ready' \| 'error'` | Tracks model initialization |
| `cameraActive`     | `boolean`                  | Whether the camera stream is live |
| `cameraError`      | `string \| null`           | User-facing camera error message |
| `detections`       | `Detection[]`              | Latest detection results for the list |

### Refs

| Ref               | Type                    | Description |
|-------------------|-------------------------|-------------|
| `videoRef`        | `RefObject<HTMLVideoElement>` | Live video feed |
| `canvasRef`       | `RefObject<HTMLCanvasElement>` | Overlay canvas |
| `detectorRef`     | `RefObject<ObjectDetector>` | MediaPipe detector instance |
| `streamRef`       | `RefObject<MediaStream>` | Active camera stream (for cleanup) |
| `rafIdRef`        | `RefObject<number>`      | Active RAF id (for cancellation) |
| `lastDetectRef`   | `RefObject<number>`      | Timestamp of last detection (for throttle) |

---

## MediaPipe Initialization

```
useEffect (mount) →
  FilesetResolver.forVisionTasks(WASM_CDN)
  → ObjectDetector.createFromOptions({
      baseOptions: { modelAssetPath: MODEL_CDN, delegate: 'GPU' },
      runningMode: 'VIDEO',
      scoreThreshold: 0.4,
      maxResults: 10,
    })
  → detectorRef.current = detector
  → setModelStatus('ready')
```

CDN constants (in a `lib/mediapipe-config.ts` helper):
```ts
export const WASM_CDN =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm';
export const MODEL_CDN =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite';
```

---

## Detection Loop

```
startCamera() →
  getUserMedia({ video: { facingMode: 'environment' } })
  → attach stream to videoRef
  → setCameraActive(true)
  → requestAnimationFrame(detect)

detect(timestamp) →
  if (!cameraActive || !detector || video.readyState < 2) → reschedule
  if (timestamp - lastDetect < 50ms) → reschedule    // ~20 FPS throttle
  lastDetect = timestamp
  results = detector.detectForVideo(video, timestamp)
  drawOverlay(results)
  setDetections(results.detections)
  rafIdRef.current = requestAnimationFrame(detect)

stopCamera() →
  cancelAnimationFrame(rafIdRef.current)
  stream.getTracks().forEach(t => t.stop())
  clearCanvas()
  setCameraActive(false)
  setDetections([])
```

---

## Canvas Overlay Drawing

```
drawOverlay(results) →
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for each detection:
    boundingBox = detection.boundingBox  // { originX, originY, width, height }
    // normalize to canvas pixel coords
    x = boundingBox.originX * scaleX
    y = boundingBox.originY * scaleY
    w = boundingBox.width * scaleX
    h = boundingBox.height * scaleY
    ctx.strokeRect(x, y, w, h)
    ctx.fillText(`${label} ${score}%`, x, y - 4)
```

Canvas and video share the same CSS `position: relative` container. Canvas is `position: absolute, inset-0`.

Bounding box style: `strokeStyle = '#00FFAA'`, `lineWidth = 2`, label background `rgba(0,0,0,0.5)`.

---

## UI Layout (Tailwind)

```
<div class="min-h-screen bg-gray-950 text-white flex flex-col items-center p-6 gap-6">

  <!-- Header -->
  <h1 class="text-2xl font-bold tracking-tight">Detección de Objetos en Tiempo Real</h1>

  <!-- Status bar (aria-live="polite") -->
  <p>Loading… / Ready / Error message</p>

  <!-- Video + Canvas container -->
  <div class="relative w-full max-w-2xl aspect-video bg-gray-800 rounded-xl overflow-hidden">
    <video autoplay muted playsinline class="w-full h-full object-cover" />
    <canvas class="absolute inset-0 w-full h-full" />
    <!-- Placeholder when inactive -->
    <div class="absolute inset-0 flex items-center justify-center text-gray-500">
      Cámara inactiva
    </div>
  </div>

  <!-- Control button -->
  <button aria-label="Activar cámara" class="px-6 py-3 rounded-lg font-semibold ...">
    Activar cámara / Detener cámara
  </button>

  <!-- Detections list -->
  <section aria-label="Objetos detectados">
    <ul>{ detections.map(...) }</ul>
    <p>No se detectaron objetos</p>
  </section>

</div>
```

---

## Next.js Configuration

`next.config.js` must add appropriate headers for SharedArrayBuffer (required by some WASM runtimes):

```js
headers: [
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
]
```

> Note: These headers may conflict with loading external CDN assets. If COEP causes issues with CDN model loading, use `credentialless` instead of `require-corp`, or disable COEP and verify WASM still initializes correctly via feature detection.

---

## TypeScript Types

```ts
// Mirrors MediaPipe Detection shape
interface DetectionResult {
  categories: Array<{ categoryName: string; score: number }>;
  boundingBox: { originX: number; originY: number; width: number; height: number } | null;
}
```

---

## Vercel Deployment Notes

- No server-side routes → static export or standard Next.js deployment both work.
- `next.config.js` must NOT set `output: 'export'` since response headers are needed for WASM.
- Vercel's default Next.js preset handles the build; no custom build command required.
- The `.tflite` model and WASM binary are fetched at runtime from external CDNs; no assets need to be bundled.

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Load MediaPipe from CDN (not npm bundle) | Avoids WASM bundling complexity in Next.js; CDN assets are cached by the browser |
| RAF throttle at 50 ms (~20 FPS) | Balances detection latency with main-thread CPU usage |
| Single client component | The feature is self-contained; splitting into multiple components adds complexity without benefit |
| `delegate: 'GPU'` with fallback | Enables hardware acceleration where available; MediaPipe falls back to CPU automatically |
| No state management library | React `useState` + `useRef` is sufficient for this feature scope |
