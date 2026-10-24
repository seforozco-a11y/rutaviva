import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RutaViva — Tu guía turística local",
  description:
    "Descubre lugares singulares cerca de ti (miradores, plazas, gastronomía) y encuentra servicios esenciales: farmacias, gasolineras, tiendas y más. Guía turística para Android e iOS.",
  keywords: [
    "guía turística",
    "lugares singulares",
    "turismo local",
    "mapa",
    "Android",
    "iOS",
    "RutaViva",
  ],
  applicationName: "RutaViva",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
  openGraph: {
    title: "RutaViva — Tu guía turística local",
    description:
      "Descubre lo singular, encuentra lo esencial. Tu ciudad al instante, en tu idioma y a tu ritmo.",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#065f46",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
        <Toaster />
        {/* Notificaciones de sonner (p. ej. confirmación de reporte de reseñas). */}
        <SonnerToaster position="top-center" richColors />
      </body>
    </html>
  );
}
