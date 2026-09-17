# Requirements Document

## Introduction

Aplicación web de reconocimiento de objetos en tiempo real que utiliza la cámara del dispositivo. Construida con Next.js 14 (App Router), TypeScript, MediaPipe Tasks Vision con WebAssembly 100% client-side, y Tailwind CSS. El modelo EfficientDet-Lite0 se carga desde la CDN oficial de MediaPipe. La aplicación está lista para desplegar en Vercel sin necesidad de backend, autenticación ni base de datos.

## Glossary

- **App**: La aplicación web Next.js 14 de reconocimiento de objetos en tiempo real.
- **ObjectDetector**: El componente de MediaPipe Tasks Vision que ejecuta inferencia de detección de objetos sobre frames de video.
- **EfficientDet-Lite0**: El modelo de detección de objetos ligero cargado desde la CDN oficial de MediaPipe (`https://storage.googleapis.com/mediapipe-models/`).
- **BoundingBox**: Rectángulo dibujado sobre el canvas que enmarca un objeto detectado, acompañado del nombre de la clase y porcentaje de confianza.
- **DetectionResult**: Estructura de datos devuelta por el ObjectDetector con la lista de objetos detectados, sus BoundingBoxes y puntuaciones de confianza.
- **VideoStream**: El flujo de video en vivo obtenido mediante `getUserMedia` desde la cámara del dispositivo.
- **OverlayCanvas**: El elemento `<canvas>` superpuesto sobre el elemento `<video>` donde se dibujan los BoundingBoxes.
- **DetectionList**: Lista de objetos detectados en el frame actual, renderizada debajo del video.
- **CDN**: Content Delivery Network; en este contexto, el endpoint oficial de Google para modelos y assets de MediaPipe.
- **WASM**: WebAssembly; el runtime de inferencia de MediaPipe que ejecuta el modelo directamente en el navegador.

## Requirements

### Requirement 1: Estructura del Proyecto y Configuración

**User Story:** Como desarrollador, quiero una estructura de proyecto Next.js 14 con App Router, TypeScript y Tailwind CSS correctamente configurados, para poder desplegar la aplicación en Vercel sin pasos adicionales.

#### Acceptance Criteria

1. THE App SHALL utilizar Next.js 14 con App Router (`app/` directory) y TypeScript.
2. THE App SHALL incluir Tailwind CSS configurado mediante `tailwind.config.ts` y `postcss.config.js`.
3. THE App SHALL incluir un archivo `next.config.ts` con los headers CORS necesarios para servir los assets WASM de MediaPipe desde la CDN.
4. THE App SHALL incluir un archivo `vercel.json` o configuración equivalente que garantice que la aplicación se despliega correctamente en Vercel sin configuración adicional.
5. THE App SHALL declarar `@mediapipe/tasks-vision` como dependencia en `package.json` con versión exacta.
6. THE App SHALL incluir un archivo `README.md` con instrucciones de instalación, desarrollo local y despliegue en Vercel.

### Requirement 2: Carga del Modelo de Detección

**User Story:** Como usuario, quiero que el modelo de detección se cargue automáticamente desde la CDN al iniciar la sesión de cámara, para no tener que instalar ni descargar nada manualmente.

#### Acceptance Criteria

1. WHEN la aplicación inicializa el detector, THE ObjectDetector SHALL cargarse utilizando `FilesetResolver.forVisionTasks` apuntando a la CDN oficial de MediaPipe (`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm`).
2. WHEN el ObjectDetector se crea, THE App SHALL especificar el modelo EfficientDet-Lite0 desde la URL `https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite`.
3. WHEN el modelo se está cargando, THE App SHALL mostrar un indicador visual de carga (spinner o mensaje) al usuario.
4. IF el modelo no puede cargarse debido a un error de red, THEN THE App SHALL mostrar un mensaje de error descriptivo al usuario e indicar que verifique su conexión a internet.
5. THE ObjectDetector SHALL configurarse con `runningMode: "VIDEO"` para procesar frames de video en tiempo real.

### Requirement 3: Activación de la Cámara

**User Story:** Como usuario, quiero activar la cámara con un botón explícito, para controlar cuándo se accede a mi dispositivo de captura.

#### Acceptance Criteria

1. THE App SHALL mostrar un botón "Activar cámara" en la página principal antes de que el usuario haya concedido acceso a la cámara.
2. WHEN el usuario hace clic en el botón "Activar cámara", THE App SHALL solicitar acceso a la cámara mediante `navigator.mediaDevices.getUserMedia({ video: true })`.
3. WHEN el acceso a la cámara es concedido, THE App SHALL mostrar el VideoStream en un elemento `<video>` con autoplay y reproducción silenciosa (`muted`).
4. IF el usuario deniega el permiso de cámara, THEN THE App SHALL mostrar un mensaje de error indicando que el permiso fue denegado y proporcionando instrucciones para habilitarlo.
5. IF `getUserMedia` no está disponible en el navegador o el contexto no es seguro (no HTTPS), THEN THE App SHALL mostrar un mensaje de error indicando que se requiere un navegador moderno con HTTPS.
6. WHILE el VideoStream está activo, THE App SHALL mostrar el botón de desactivar cámara en lugar del botón "Activar cámara".

### Requirement 4: Detección de Objetos en Tiempo Real

**User Story:** Como usuario, quiero que los objetos sean detectados automáticamente en el video en vivo, para ver los resultados sin ninguna interacción adicional.

#### Acceptance Criteria

1. WHEN el VideoStream está activo y el ObjectDetector está listo, THE App SHALL iniciar el bucle de detección usando `requestAnimationFrame`.
2. THE App SHALL limitar la frecuencia de detección a un máximo de 20 FPS mediante control de tiempo entre frames (`performance.now()`).
3. WHEN se procesa un frame, THE ObjectDetector SHALL invocar `detectForVideo` con el elemento `<video>` y el timestamp actual en milisegundos.
4. WHEN el ObjectDetector devuelve un DetectionResult, THE App SHALL actualizar el estado de detecciones con la lista de objetos encontrados.
5. WHILE el VideoStream está activo, THE App SHALL continuar el bucle de detección hasta que el usuario desactive la cámara.
6. IF `detectForVideo` lanza una excepción durante el procesamiento de un frame, THEN THE App SHALL registrar el error en consola y continuar el bucle de detección sin interrumpir la experiencia del usuario.

### Requirement 5: Visualización de BoundingBoxes en Canvas

**User Story:** Como usuario, quiero ver los objetos detectados enmarcados con rectángulos sobre el video, para identificar visualmente qué elementos están siendo reconocidos.

#### Acceptance Criteria

1. THE App SHALL renderizar un OverlayCanvas superpuesto sobre el elemento `<video>` con posición absoluta y las mismas dimensiones que el video.
2. WHEN el DetectionResult contiene detecciones, THE App SHALL dibujar un BoundingBox por cada objeto detectado sobre el OverlayCanvas.
3. WHEN se dibuja un BoundingBox, THE App SHALL renderizar el nombre de la clase del objeto y el porcentaje de confianza (redondeado a número entero) encima del rectángulo.
4. THE App SHALL limpiar el OverlayCanvas al inicio de cada frame antes de dibujar las nuevas detecciones.
5. WHEN el DetectionResult no contiene detecciones, THE App SHALL limpiar el OverlayCanvas sin dibujar ningún rectángulo.
6. THE App SHALL usar colores diferenciados o consistentes para los BoundingBoxes de modo que sean claramente visibles sobre el video.
7. WHEN el tamaño del elemento `<video>` no coincide con el tamaño intrínseco del VideoStream, THE App SHALL escalar las coordenadas de los BoundingBoxes proporcionalmente a las dimensiones del elemento `<video>` visible.

### Requirement 6: Lista de Objetos Detectados

**User Story:** Como usuario, quiero ver una lista textual de los objetos detectados debajo del video, para tener una referencia rápida de todos los elementos reconocidos en el frame actual.

#### Acceptance Criteria

1. THE App SHALL renderizar la DetectionList debajo del elemento de video y canvas.
2. WHEN el DetectionResult contiene detecciones, THE App SHALL mostrar en la DetectionList el nombre de cada objeto detectado y su porcentaje de confianza.
3. WHEN el DetectionResult no contiene detecciones, THE App SHALL mostrar un mensaje indicando que no se detectaron objetos en el frame actual.
4. THE DetectionList SHALL actualizarse en cada frame procesado, reflejando únicamente los objetos presentes en el frame más reciente.
5. THE App SHALL ordenar la DetectionList por puntuación de confianza de mayor a menor.

### Requirement 7: Experiencia de Usuario y Accesibilidad

**User Story:** Como usuario, quiero una interfaz clara y responsiva, para poder usar la aplicación cómodamente en dispositivos de escritorio y móviles modernos.

#### Acceptance Criteria

1. THE App SHALL presentar una interfaz responsiva que funcione correctamente en pantallas de escritorio y dispositivos móviles modernos.
2. THE App SHALL incluir atributos `aria-label` en los controles interactivos (botones) para accesibilidad básica.
3. THE App SHALL mostrar el nombre de la aplicación y una descripción breve en la página principal.
4. WHILE el modelo se está cargando, THE App SHALL deshabilitar el botón "Activar cámara" para evitar interacciones prematuras.
5. IF el navegador no soporta `requestAnimationFrame`, THEN THE App SHALL mostrar un mensaje indicando que el navegador no es compatible.

### Requirement 8: Despliegue en Vercel

**User Story:** Como desarrollador, quiero que la aplicación esté lista para desplegar en Vercel con un solo comando, para minimizar el tiempo desde el código hasta la producción.

#### Acceptance Criteria

1. THE App SHALL funcionar correctamente bajo HTTPS, que es el protocolo predeterminado de Vercel, garantizando que `getUserMedia` esté disponible.
2. THE App SHALL incluir en `next.config.ts` los response headers `Cross-Origin-Opener-Policy` y `Cross-Origin-Embedder-Policy` con valores `same-origin` para habilitar el contexto aislado requerido por WASM con SharedArrayBuffer si fuera necesario.
3. THE App SHALL no requerir variables de entorno, base de datos, ni servicios externos de backend para funcionar en producción.
4. THE App SHALL construirse exitosamente con `next build` sin errores de TypeScript ni de compilación.
5. THE README SHALL documentar el comando `vercel deploy` o `vercel --prod` para desplegar la aplicación desde la CLI de Vercel.
