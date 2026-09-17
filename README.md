# 🎯 Detección de objetos en tiempo real

App web de reconocimiento de objetos usando la cámara del dispositivo, **100% client-side**. Ningún dato sale de tu navegador.

## Stack

| Tecnología | Versión | Rol |
|---|---|---|
| Next.js (App Router) | 14.2 | Framework web |
| TypeScript | 5.4 | Tipado estático |
| @mediapipe/tasks-vision | 0.10.14 | Motor de detección (WASM) |
| EfficientDet-Lite2 | float32 | Modelo de detección (CDN oficial) |
| Tailwind CSS | 3.4 | Estilos |

## Funcionalidad

- Botón **"Activar cámara"** — solicita permiso `getUserMedia`
- Detección sobre cada frame con `requestAnimationFrame`, limitada a **~15 FPS**
- **Canvas superpuesto** con bounding boxes coloridos, nombre del objeto y porcentaje de confianza
- **Lista de objetos detectados** debajo del video con barras de confianza
- Manejo de errores de cámara (permiso denegado, cámara no encontrada, etc.)
- Indicador de estado del modelo (cargando / listo / error)

## Modelo

**EfficientDet-Lite2 (float32)** — detecta **80 clases COCO** (personas, coches, animales, muebles, electrodomésticos, etc.)

| Modelo | Tamaño | Precisión | Velocidad |
|---|---|---|---|
| EfficientDet-Lite0 | ~4 MB | Base | Muy rápido |
| **EfficientDet-Lite2** | **~7 MB** | **Mejor** | **Rápido** |
| EfficientDet-Lite4 | ~20 MB | Máxima | Moderado |

- Cargado desde `storage.googleapis.com/mediapipe-models` (se cachea en el navegador tras la primera carga).
- Runtime WASM desde `cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm`.
- GPU delegate activado, con fallback automático a CPU.

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

> **Nota:** `getUserMedia` requiere HTTPS. En desarrollo, `localhost` funciona sin TLS. En producción Vercel lo gestiona automáticamente.

## Deploy en Vercel

### Opción 1 — Dashboard (recomendado)

1. Sube el proyecto a GitHub.
2. En [vercel.com/new](https://vercel.com/new), importa el repositorio.
3. Sin configuración adicional — Vercel detecta Next.js automáticamente.
4. Haz clic en **Deploy**.

Vercel redesplegará automáticamente con cada push a `main`.

### Opción 2 — CLI

```bash
npm install -g vercel
vercel --prod
```

## Estructura del proyecto

```
src/
├── app/
│   ├── layout.tsx               # Root layout con metadata
│   ├── page.tsx                 # Página principal
│   └── globals.css              # Tailwind base styles
├── components/
│   └── ObjectDetectionCamera.tsx  # Cámara + canvas overlay + UI
└── hooks/
    └── useObjectDetector.ts     # Inicialización del modelo MediaPipe
```

## Privacidad

La aplicación no envía datos a ningún servidor. Todo el procesamiento ocurre localmente en el navegador del usuario mediante WebAssembly.
