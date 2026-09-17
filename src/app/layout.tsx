import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Detección de objetos en tiempo real",
  description:
    "App web de reconocimiento de objetos usando MediaPipe Tasks Vision y EfficientDet-Lite0, 100% client-side.",
  openGraph: {
    title: "Detección de objetos en tiempo real",
    description:
      "Reconocimiento de objetos en tiempo real usando tu cámara, sin servidores.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* Inter font — only weights used in the app */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
