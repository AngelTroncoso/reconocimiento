# Implementation Plan: Real-Time Object Detection App

## Overview

Implementación incremental de la aplicación web de detección de objetos en tiempo real. El orden de las tareas garantiza que cada paso compila y es funcional antes de avanzar al siguiente: primero la infraestructura del proyecto, luego los tipos y utilidades, después los hooks de cámara y modelo, y finalmente el ensamblado de componentes con visualización y lista de detecciones.

## Tasks

- [ ] 1. Inicializar proyecto Next.js 14 con TypeScript y Tailwind CSS
  - Crear el proyecto con `create-next-app` o manualmente con las dependencias exactas del design
  - Configurar `tsconfig.json` con `strict: true` y paths de App Router
  - Configurar `tailwind.config.ts` apuntando a `app/**` y `components/**`
  - Configurar `postcss.config.js` con `tailwindcss` y `autoprefixer`
  - Añadir `@mediapipe/tasks-vision@0.10.14` a `package.json`
  - _Requirements: 1.1, 1.2, 1.5_

- [ ] 2. Configurar archivos de proyecto para Vercel
  - [ ] 2.1 Crear `next.config.ts` con headers COOP/COEP `same-origin` / `require-corp` para todos los paths
    - Implementar la función `headers()` asíncrona que devuelve los response headers necesarios para WASM
    - _Requirements: 1.3, 8.2_
  - [ ] 2.2 Crear `vercel.json` con los mismos headers COOP/COEP para garantizar que Vercel los sirva en producción
    - _Requirements: 1.4, 8.1, 8.2_
  - [ ]* 2.3 Verificar que `next build` compila sin errores TypeScript
    - _Requirements: 8.4_

- [ ] 3. Definir tipos TypeScript y utilidad de dibujo
  - [ ] 3.1 Crear `types/detection.ts` con las interfaces `DetectedObject`, `CameraState` y cualquier tipo auxiliar compartido
    - Definir `DetectedObject` con campos `label`, `score`, `boundingBox`
    - Definir `CameraState` como union type: `"idle" | "loading-model" | "requesting-camera" | "active" | "error"`
    - _Requirements: 4.4, 5.2, 6.2_
  - [ ] 3.2 Crear `lib/drawDetections.ts` con la función `drawDetections(canvas, result, video)`
    - Sincronizar dimensiones del canvas con `video.offsetWidth` / `video.offsetHeight`
    - Limpiar canvas con `clearRect` al inicio de cada llamada
    - Escalar coordenadas de bounding box usando `video.videoWidth` / `video.videoHeight` como referencia
    - Dibujar rectángulos con color `#00FF88` y etiqueta con nombre y porcentaje de confianza
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6, 5.7_
  - [ ]* 3.3 Escribir tests unitarios para `drawDetections`
    - Verificar que `clearRect` se llama antes de cualquier `strokeRect`
    - Verificar la fórmula de escalado de coordenadas con datos de ejemplo
    - _Requirements: 5.4, 5.7_

- [ ] 4. Implementar hook `useCamera`
  - [ ] 4.1 Crear `hooks/useCamera.ts` con la lógica de `getUserMedia` y ciclo de vida del stream
    - Exponer `videoRef`, `isStreaming`, `startCamera()`, `stopCamera()`, `cameraError`
    - Manejar `NotAllowedError` (permiso denegado) y ausencia de `navigator.mediaDevices`
    - Detener todas las tracks del stream al llamar `stopCamera()` o al desmontar
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_
  - [ ]* 4.2 Escribir tests unitarios para `useCamera`
    - Mock de `navigator.mediaDevices.getUserMedia`
    - Verificar estado `cameraError` ante permiso denegado y ante API no disponible
    - _Requirements: 3.4, 3.5_

- [ ] 5. Implementar hook `useObjectDetector`
  - [ ] 5.1 Crear `hooks/useObjectDetector.ts` con la inicialización de `FilesetResolver` y `ObjectDetector`
    - Usar la URL CDN de jsDelivr para los assets WASM de MediaPipe
    - Usar la URL de GCS para el modelo EfficientDet-Lite0
    - Configurar `runningMode: "VIDEO"` y `scoreThreshold: 0.4`
    - Exponer `{ detector, isLoading, error }`
    - Manejar errores de red en la carga del modelo con mensaje descriptivo
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [ ]* 5.2 Escribir tests unitarios para `useObjectDetector`
    - Mock de `@mediapipe/tasks-vision` para verificar el flujo de estados: `isLoading: true` → `detector` no null
    - Verificar que `error` se establece ante fallo de red
    - _Requirements: 2.3, 2.4_

- [ ] 6. Implementar componentes de UI secundarios
  - [ ] 6.1 Crear `components/CameraButton.tsx` con botón "Activar cámara" / "Desactivar cámara"
    - El botón cambia de texto según `isStreaming`
    - El botón se deshabilita mientras `isLoading` del modelo sea `true`
    - Incluir atributo `aria-label` descriptivo
    - _Requirements: 3.1, 3.6, 7.2, 7.4_
  - [ ] 6.2 Crear `components/LoadingIndicator.tsx` con spinner animado (Tailwind `animate-spin`) y texto "Cargando modelo…"
    - Se renderiza condicionalmente cuando el modelo está cargando
    - _Requirements: 2.3_
  - [ ] 6.3 Crear `components/DetectionList.tsx` que recibe `DetectedObject[]` y renderiza la lista ordenada por score
    - Ordenar por `score` descendente antes de renderizar
    - Si la lista está vacía, mostrar "No se detectaron objetos en el frame actual"
    - Formato de cada ítem: `"${label} — ${Math.round(score * 100)}%"`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 7. Implementar componente principal `ObjectDetectionApp`
  - [ ] 7.1 Crear `components/ObjectDetectionApp.tsx` con directiva `"use client"`
    - Componer `useCamera`, `useObjectDetector`, `canvasRef`, estado `detections: DetectedObject[]`
    - Implementar el bucle `requestAnimationFrame` con throttle a 20 FPS usando `performance.now()`
    - Invocar `detector.detectForVideo(videoEl, timestamp)` dentro del bucle y manejar excepciones sin detener el loop
    - Invocar `drawDetections(canvas, result, videoEl)` y actualizar `setDetections` con cada resultado
    - Cancelar `requestAnimationFrame` al desmontar o al detener la cámara
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 7.5_
  - [ ] 7.2 Integrar el OverlayCanvas sobre `<video>` con posición absoluta y `pointer-events: none`
    - El contenedor padre debe ser `position: relative`
    - El canvas debe tener `position: absolute`, `top: 0`, `left: 0`, y mismas dimensiones que el video
    - _Requirements: 5.1_
  - [ ] 7.3 Integrar `CameraButton`, `LoadingIndicator` y `DetectionList` en `ObjectDetectionApp`
    - Mostrar `LoadingIndicator` mientras `isLoading` sea true
    - Mostrar banner de error (rojo) si `error` o `cameraError` está presente
    - Pasar `detections` a `DetectionList`
    - _Requirements: 2.3, 2.4, 3.4, 3.5, 6.1, 7.1, 7.3_

- [ ] 8. Configurar `app/layout.tsx` y `app/page.tsx`
  - [ ] 8.1 Crear `app/layout.tsx` con metadata (título "Detección de Objetos en Tiempo Real"), importar `globals.css`
    - _Requirements: 7.3_
  - [ ] 8.2 Crear `app/page.tsx` que renderiza `<ObjectDetectionApp>` centrado en la página
    - Mostrar nombre de la app y descripción breve en la parte superior
    - _Requirements: 7.3_

- [ ] 9. Checkpoint — Verificar integración completa
  - Asegurarse de que `next build` pasa sin errores TypeScript ni de compilación.
  - Asegurarse de que todos los tests (si existen) pasan.
  - Pedir al usuario que confirme si hay alguna duda antes de continuar.

- [ ] 10. Crear `README.md`
  - [ ] 10.1 Documentar instalación (`npm install`), desarrollo local (`npm run dev`), y build (`npm run build`)
    - Incluir nota sobre HTTPS requerido para `getUserMedia` en producción
    - Documentar el comando de despliegue: `vercel deploy` o `vercel --prod`
    - _Requirements: 1.6, 8.5_

- [ ] 11. Checkpoint final — Proyecto listo para deploy
  - Verificar que todos los archivos del proyecto están en su lugar según la estructura del design.
  - Confirmar que `vercel.json` y `next.config.ts` tienen los headers COOP/COEP correctos.
  - Pedir al usuario confirmación antes del deploy.

## Notes

- Las tareas marcadas con `*` son opcionales y pueden omitirse para un MVP más rápido.
- El lenguaje de implementación es **TypeScript** con **Next.js 14 App Router**.
- Todas las tareas de testing son sub-tareas opcionales que complementan la implementación.
- Los checkpoints (tareas 9 y 11) garantizan validación incremental antes de avanzar.
- Los headers COOP/COEP se definen en dos lugares (`next.config.ts` y `vercel.json`) para garantizar que funcionan tanto en desarrollo como en producción Vercel.
- MediaPipe EfficientDet-Lite0 devuelve coordenadas absolutas en píxeles relativos al frame intrínseco del video, no normalizadas — la función `drawDetections` debe escalar usando `video.videoWidth` / `video.videoHeight`.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "2.2", "3.1"] },
    { "id": 1, "tasks": ["2.3", "3.2", "4.1", "5.1"] },
    { "id": 2, "tasks": ["3.3", "4.2", "5.2", "6.1", "6.2", "6.3"] },
    { "id": 3, "tasks": ["7.1", "7.2", "8.1"] },
    { "id": 4, "tasks": ["7.3", "8.2"] },
    { "id": 5, "tasks": ["10.1"] }
  ]
}
```
