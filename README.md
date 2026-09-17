# 🎯 Detección de objetos en tiempo real

App web de reconocimiento de objetos usando la cámara del dispositivo, **100% client-side**. Ningún dato sale de tu navegador.

## Stack

| Tecnología | Versión | Rol |
|---|---|---|
| Next.js (App Router) | 14.2 | Framework web |
| TypeScript | 5.4 | Tipado estático |
| @mediapipe/tasks-vision | 0.10.14 | Motor de detección (WASM) |
| EfficientDet-Lite0 | float16 | Modelo de detección (CDN oficial) |
| Tailwind CSS | 3.4 | Estilos |

## Funcionalidad

- Botón **"Activar cámara"** — solicita permiso `getUserMedia`
- Detección sobre cada frame con `requestAnimationFrame`, limitada a **~15 FPS**
- **Canvas superpuesto** con bounding boxes coloridos, nombre del objeto y porcentaje de confianza
- **Lista de objetos detectados** debajo del video con barras de confianza
- Manejo de errores de cámara (permiso denegado, cámara no encontrada, etc.)
- Indicador de estado del modelo (cargando / listo / error)

## Requisitos

- Node.js ≥ 18
- npm ≥ 9

## Desarrollo local

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

> **Nota sobre HTTPS:** `getUserMedia` requiere un contexto seguro. En desarrollo, `localhost` funciona sin HTTPS. En producción necesitas un dominio con TLS (Vercel lo gestiona automáticamente).

## Deploy en Vercel

### Opción 1 — CLI de Vercel

```bash
npm install -g vercel
vercel
```

Sigue el asistente interactivo. Vercel detectará Next.js automáticamente.

### Opción 2 — Dashboard de Vercel

1. Sube el proyecto a un repositorio de GitHub / GitLab / Bitbucket.
2. En [vercel.com/new](https://vercel.com/new), importa el repositorio.
3. Sin cambios de configuración — Vercel detecta Next.js y construye con `next build`.
4. Haz clic en **Deploy**.

### Opción 3 — Un solo comando

```bash
npx vercel --yes
```

## Notas técnicas

### Headers COOP/COEP

El runtime WASM de MediaPipe usa `SharedArrayBuffer`, que requiere un contexto de [aislamiento cross-origin](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements). `next.config.mjs` añade automáticamente:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Vercel respeta esta configuración de Next.js sin ajustes adicionales.

### Modelo

- **EfficientDet-Lite0 (float16)** — detecta **80 clases COCO** (personas, coches, animales, muebles, etc.)
- Cargado desde `storage.googleapis.com/mediapipe-models` la primera vez; el navegador lo cachea.
- Runtime WASM desde `cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm`.
- Delegación a GPU habilitada (`delegate: "GPU"`), con fallback automático a CPU.

### Estructura de archivos

```
src/
├── app/
│   ├── layout.tsx          # Root layout con metadata
│   ├── page.tsx            # Página principal
│   └── globals.css         # Tailwind base styles
├── components/
│   └── ObjectDetectionCamera.tsx   # Lógica de cámara + canvas + UI
└── hooks/
    └── useObjectDetector.ts        # Inicialización del modelo MediaPipe
```

## Privacidad

La aplicación no envía datos a ningún servidor. Todo el procesamiento ocurre localmente en el navegador del usuario mediante WebAssembly.
