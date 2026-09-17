# Tasks: Real-Time Object Detection

## Implementation Plan

---

### Task 1 — Project Scaffold

Set up the Next.js 14 project with TypeScript, Tailwind CSS, and all required dependencies.

- [ ] 1.1 Bootstrap project with `create-next-app` using App Router, TypeScript, Tailwind CSS, and ESLint
- [ ] 1.2 Install `@mediapipe/tasks-vision` as a dev/type-only dependency (for TypeScript types); confirm it is listed in `package.json`
- [ ] 1.3 Configure `tsconfig.json` for strict mode (`"strict": true`)
- [ ] 1.4 Remove boilerplate content from `app/page.tsx` and `app/globals.css` (keep only Tailwind directives)
- [ ] 1.5 Verify `next build` runs without errors on the empty scaffold

---

### Task 2 — Next.js Configuration for WASM & CDN

Configure `next.config.js` so the app can load external WASM assets and deploy correctly on Vercel.

- [ ] 2.1 Add `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` response headers in `next.config.js` (apply to all routes)
- [ ] 2.2 Ensure `output` is NOT set to `'export'` (response headers require the default Next.js server mode)
- [ ] 2.3 Confirm `next build` still passes after config changes

---

### Task 3 — MediaPipe Config Helper

Create a small constants/config file to centralize CDN URLs and detection parameters.

- [ ] 3.1 Create `lib/mediapipe-config.ts` exporting:
  - `WASM_CDN` — `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm`
  - `MODEL_CDN` — `https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite`
  - `SCORE_THRESHOLD` — `0.4`
  - `MAX_RESULTS` — `10`
  - `DETECT_INTERVAL_MS` — `50`
- [ ] 3.2 Export a `DetectionResult` TypeScript interface matching the MediaPipe `Detection` shape (categories array + boundingBox)

---

### Task 4 — `ObjectDetectorView` Client Component — Skeleton & State

Create the main client component with all state, refs, and the basic JSX structure.

- [ ] 4.1 Create `components/ObjectDetectorView.tsx` with `"use client"` directive
- [ ] 4.2 Declare all state variables: `modelStatus`, `cameraActive`, `cameraError`, `detections`
- [ ] 4.3 Declare all refs: `videoRef`, `canvasRef`, `detectorRef`, `streamRef`, `rafIdRef`, `lastDetectRef`
- [ ] 4.4 Add the root layout JSX using Tailwind (`min-h-screen bg-gray-950 text-white flex flex-col items-center p-6 gap-6`)
- [ ] 4.5 Add the `<video>` + `<canvas>` overlay container with `relative` positioning; canvas uses `absolute inset-0`
- [ ] 4.6 Add a conditional placeholder ("Cámara inactiva") shown when `cameraActive` is false
- [ ] 4.7 Add the `<button>` that toggles between "Activar cámara" and "Detener cámara"; include `aria-label`
- [ ] 4.8 Add the `aria-live="polite"` status bar paragraph driven by `modelStatus` and `cameraError`
- [ ] 4.9 Add the detections `<ul>` / empty-state section with `aria-label="Objetos detectados"`

---

### Task 5 — MediaPipe Model Initialization

Wire up `useEffect` to load MediaPipe and initialize the `ObjectDetector` on mount.

- [ ] 5.1 In a `useEffect` with empty dependency array, call `FilesetResolver.forVisionTasks(WASM_CDN)`
- [ ] 5.2 Call `ObjectDetector.createFromOptions` with `runningMode: 'VIDEO'`, `delegate: 'GPU'`, `scoreThreshold`, `maxResults`
- [ ] 5.3 Store the detector in `detectorRef.current` and set `modelStatus` to `'ready'`
- [ ] 5.4 Handle errors: set `modelStatus` to `'error'` and log to console
- [ ] 5.5 Set `modelStatus` to `'loading'` before the async call begins
- [ ] 5.6 Return a cleanup function that calls `detector.close()` if the detector was created

---

### Task 6 — Camera Start / Stop Logic

Implement `startCamera` and `stopCamera` functions.

- [ ] 6.1 `startCamera`: call `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`, assign stream to `videoRef.current.srcObject` and `streamRef.current`
- [ ] 6.2 Wait for `video.onloadeddata` before starting the RAF loop to ensure the video has valid dimensions
- [ ] 6.3 Set `cameraActive` to `true` and call `requestAnimationFrame(detect)` after video is ready
- [ ] 6.4 Catch `NotAllowedError` and set `cameraError` to a user-friendly Spanish message
- [ ] 6.5 `stopCamera`: cancel `rafIdRef.current` with `cancelAnimationFrame`
- [ ] 6.6 Call `stream.getTracks().forEach(t => t.stop())` to release the camera hardware
- [ ] 6.7 Clear `videoRef.current.srcObject` and reset `streamRef.current`
- [ ] 6.8 Set `cameraActive` to `false`, clear `detections`, and clear the canvas

---

### Task 7 — Detection Loop with RAF Throttle

Implement the `detect` callback that runs the MediaPipe inference on each frame.

- [ ] 7.1 Define `detect` as a `useCallback` (or stable ref) taking a `DOMHighResTimeStamp`
- [ ] 7.2 Guard: if detector is not ready or video `readyState < 2`, reschedule via RAF and return
- [ ] 7.3 Throttle: if `timestamp - lastDetectRef.current < DETECT_INTERVAL_MS`, reschedule and return
- [ ] 7.4 Update `lastDetectRef.current = timestamp`
- [ ] 7.5 Call `detectorRef.current.detectForVideo(videoRef.current, timestamp)` and capture results
- [ ] 7.6 Call `drawOverlay(results)` with the canvas context
- [ ] 7.7 Update `detections` state with `results.detections`
- [ ] 7.8 Schedule the next frame: `rafIdRef.current = requestAnimationFrame(detect)`

---

### Task 8 — Canvas Overlay Drawing

Implement the `drawOverlay` function that renders bounding boxes and labels.

- [ ] 8.1 Get the 2D context from `canvasRef.current`; return early if unavailable
- [ ] 8.2 Sync canvas `width` and `height` attributes to the video's `videoWidth` / `videoHeight`
- [ ] 8.3 Call `ctx.clearRect(0, 0, canvas.width, canvas.height)` at the start of each frame
- [ ] 8.4 Compute `scaleX = canvas.width / video.videoWidth` and `scaleY` (should be 1:1 after step 8.2, but guard against 0)
- [ ] 8.5 For each detection with a valid `boundingBox`, draw `ctx.strokeRect` with `strokeStyle = '#00FFAA'` and `lineWidth = 2`
- [ ] 8.6 Draw label background: `ctx.fillStyle = 'rgba(0,0,0,0.55)'` filled rect above the box
- [ ] 8.7 Draw label text: category name + `Math.round(score * 100)` + `%`, in white, `font = '13px sans-serif'`
- [ ] 8.8 Handle edge cases: skip detections where `boundingBox` is null; clamp label position to stay within canvas bounds

---

### Task 9 — Root Page & Layout

Wire the client component into the App Router page and configure the layout.

- [ ] 9.1 In `app/page.tsx`, import and render `<ObjectDetectorView />` (no props needed)
- [ ] 9.2 In `app/layout.tsx`, set `<title>` to "Detección de Objetos" and add a descriptive `<meta name="description">`
- [ ] 9.3 Set `lang="es"` on the `<html>` element in the root layout
- [ ] 9.4 Ensure Tailwind dark background is applied to `<body>` (add `bg-gray-950` or rely on component)

---

### Task 10 — Vercel Deployment Readiness

Validate the application builds and is configured correctly for Vercel.

- [ ] 10.1 Run `next build` locally and confirm zero TypeScript errors and zero build errors
- [ ] 10.2 Verify that the COEP/COOP headers appear in the `next build` output (or test via `next start`)
- [ ] 10.3 Add a `vercel.json` (optional) only if custom routes or overrides are needed; otherwise leave absent
- [ ] 10.4 Confirm `package.json` `scripts.build` is `"next build"` (Vercel default)
- [ ] 10.5 Test the production build locally with `next start` and verify the full detection flow works end-to-end

---

### Task 11 — Cleanup & Polish

Final quality pass before shipping.

- [ ] 11.1 Add a `useEffect` cleanup in `ObjectDetectorView` to call `stopCamera()` on component unmount (prevents stream leak)
- [ ] 11.2 Disable the "Activar cámara" button while `modelStatus !== 'ready'`; show a spinner or "Cargando modelo…" message
- [ ] 11.3 Add button hover/active Tailwind states and focus ring for keyboard accessibility
- [ ] 11.4 Ensure the detections list uses `key={index}` or a stable key on each `<li>`
- [ ] 11.5 Remove all `console.log` debug statements; keep `console.error` for actual errors
- [ ] 11.6 Run ESLint (`next lint`) and fix all reported issues
