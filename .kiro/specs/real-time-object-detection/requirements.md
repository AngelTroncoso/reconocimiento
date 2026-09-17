# Requirements: Real-Time Object Detection

## Overview
A client-side web application that uses the device camera and MediaPipe Tasks Vision (WASM) with an EfficientDet-Lite0 model to perform real-time object detection. The app runs entirely in the browser with no backend or authentication. It is built with Next.js 14 App Router, TypeScript, and Tailwind CSS, and is ready to deploy on Vercel.

---

## Functional Requirements

### FR-1: Camera Activation
- **FR-1.1** The user must be presented with an "Activar cámara" (Activate Camera) button on initial load.
- **FR-1.2** Clicking the button must request camera access via `navigator.mediaDevices.getUserMedia({ video: true })`.
- **FR-1.3** If the user denies camera access, an error message must be shown explaining the permission was denied.
- **FR-1.4** Once activated, the live camera feed must be rendered in a `<video>` element.
- **FR-1.5** The user must be able to stop the camera and return to the initial state via a "Detener cámara" (Stop Camera) button.

### FR-2: Object Detection Pipeline
- **FR-2.1** The MediaPipe `ObjectDetector` must be initialized using the Tasks Vision package loaded from CDN.
- **FR-2.2** The EfficientDet-Lite0 model (`.tflite`) must be loaded from a public CDN URL at runtime.
- **FR-2.3** Detection must run using the `VIDEO` running mode and `detectForVideo`.
- **FR-2.4** Detection must be triggered on every animation frame via `requestAnimationFrame` (RAF), throttled to approximately 20 FPS (one detection every ≥50 ms).
- **FR-2.5** Detection must stop when the camera is deactivated.

### FR-3: Visual Overlay — Bounding Boxes & Labels
- **FR-3.1** A `<canvas>` element must be overlaid on top of the `<video>` element, matching its dimensions.
- **FR-3.2** For each detection result, a bounding box must be drawn on the canvas.
- **FR-3.3** Each bounding box must display the object category name and confidence score (e.g., "person 94%").
- **FR-3.4** The canvas must be cleared and redrawn on every detection frame.
- **FR-3.5** Bounding box colors must be visually distinct (e.g., a fixed accent color or per-category color).

### FR-4: Detected Objects List
- **FR-4.1** Below the video feed, a real-time list of currently detected objects must be shown.
- **FR-4.2** Each list item must include the category name and confidence percentage.
- **FR-4.3** The list must update on every detection frame.
- **FR-4.4** When no objects are detected, the list must show a neutral empty state message.

### FR-5: UI & Accessibility
- **FR-5.1** The application must be responsive and centered on all screen sizes.
- **FR-5.2** The camera toggle button must have a visible focus indicator and a descriptive `aria-label`.
- **FR-5.3** A loading indicator must be shown while the MediaPipe model is being initialized.
- **FR-5.4** All status messages (loading, error, idle) must be surfaced to screen readers via `aria-live`.

---

## Non-Functional Requirements

### NFR-1: Performance
- **NFR-1.1** Detection loop must not exceed ~20 FPS to avoid saturating the main thread.
- **NFR-1.2** The RAF loop must be cancelled on component unmount to prevent memory leaks.

### NFR-2: Deployment
- **NFR-2.1** The application must be deployable on Vercel with no server-side routes (pure static/edge-friendly).
- **NFR-2.2** No backend API routes are required or allowed.
- **NFR-2.3** No authentication or session management is required.

### NFR-3: Architecture
- **NFR-3.1** All detection logic must run exclusively client-side (browser).
- **NFR-3.2** The component containing camera and detection logic must use `"use client"`.
- **NFR-3.3** The MediaPipe WASM runtime and model file must be loaded from a public CDN (e.g., `cdn.jsdelivr.net` or `storage.googleapis.com`).

### NFR-4: Technology Stack
- **NFR-4.1** Framework: Next.js 14 with App Router.
- **NFR-4.2** Language: TypeScript (strict mode).
- **NFR-4.3** Styling: Tailwind CSS v3.
- **NFR-4.4** Object detection: `@mediapipe/tasks-vision` (WASM, loaded from CDN).
- **NFR-4.5** Model: EfficientDet-Lite0 (loaded from CDN at runtime).

---

## Acceptance Criteria

| ID     | Criterion |
|--------|-----------|
| AC-1   | On page load, only the activate button is visible; camera feed is not shown. |
| AC-2   | Clicking activate requests camera permission and shows the live feed. |
| AC-3   | Bounding boxes and labels appear on the canvas overlay during live detection. |
| AC-4   | The detected objects list updates in near-real-time alongside the canvas overlay. |
| AC-5   | Detection runs at no more than ~20 FPS. |
| AC-6   | Stopping the camera clears the canvas, stops the RAF loop, and releases the media stream. |
| AC-7   | A loading state is shown until the model is ready. |
| AC-8   | A user-friendly error is shown if camera access is denied. |
| AC-9   | The app builds successfully with `next build` and deploys to Vercel without errors. |
