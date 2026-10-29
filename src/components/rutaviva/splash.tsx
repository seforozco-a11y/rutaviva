"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Compass, MapPin, Navigation, ShieldCheck, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type SplashProps = {
  onExplore: () => void;
  onDemo: () => void;
  locating: boolean;
};

export function Splash({ onExplore, onDemo, locating }: SplashProps) {
  return (
    <section
      aria-label="Portada de RutaViva"
      className="relative flex min-h-dvh flex-col overflow-hidden bg-gradient-to-b from-emerald-950 via-emerald-900 to-teal-800 text-emerald-50"
    >
      {/* Fondo fotográfico de Manzanillo + velo para legibilidad */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <Image
          src="/hero-manzanillo.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/85 via-emerald-950/75 to-teal-900/90" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:22px_22px]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6 py-12 text-center">
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 16 }}
          className="relative"
        >
          <div className="absolute -inset-2 rounded-3xl bg-amber-300/20 blur-xl" aria-hidden />
          <div className="relative overflow-hidden rounded-3xl border border-white/20 shadow-2xl shadow-emerald-950/60">
            <Image
              src="/icon-1024.png"
              alt="Logotipo de RutaViva"
              width={112}
              height={112}
              priority
              className="h-28 w-28 object-cover"
            />
          </div>
        </motion.div>

        {/* Título */}
        <motion.div
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="space-y-3"
        >
          <p className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-medium tracking-wide text-amber-200">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Disponible hoy en tu ciudad
          </p>
          <h1 className="text-5xl font-black tracking-tight">
            Ruta
            <span className="bg-gradient-to-r from-amber-300 via-amber-200 to-lime-200 bg-clip-text text-transparent">
              Viva
            </span>
          </h1>
          <p className="mx-auto max-w-sm text-balance text-sm leading-relaxed text-emerald-100/85 sm:text-base">
            Descubre los <strong className="font-semibold text-white">lugares singulares</strong> de
            tu ciudad — playas, miradores, sabor local — y encuentra todo lo esencial: farmacias,
            gasolineras, tiendas y más.
          </p>
        </motion.div>

        {/* Beneficios */}
        <motion.ul
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-2 text-xs"
        >
          {[
            { icon: MapPin, label: "Lugares únicos cerca" },
            { icon: Compass, label: "Mapa en vivo" },
            { icon: ShieldCheck, label: "Sin registro" },
          ].map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 font-medium text-emerald-50 backdrop-blur"
            >
              <Icon className="h-3.5 w-3.5 text-amber-300" aria-hidden />
              {label}
            </li>
          ))}
        </motion.ul>

        {/* CTAs */}
        <motion.div
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="mt-2 flex w-full max-w-xs flex-col gap-3"
        >
          <div className="relative">
            <span
              aria-hidden
              className="absolute inset-0 animate-ping rounded-2xl bg-amber-400/30 [animation-duration:2.2s]"
            />
            <Button
              size="lg"
              onClick={onExplore}
              disabled={locating}
              className="relative h-14 w-full gap-2 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 text-base font-bold text-emerald-950 shadow-xl shadow-amber-500/25 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-80"
            >
              {locating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                  Localizándote…
                </>
              ) : (
                <>
                  <Navigation className="h-5 w-5" aria-hidden />
                  Explorar cerca de mí
                </>
              )}
            </Button>
          </div>
          <Button
            size="lg"
            variant="ghost"
            onClick={onDemo}
            disabled={locating}
            className="h-11 w-full rounded-2xl border border-white/20 text-sm font-semibold text-emerald-100 hover:bg-white/10 hover:text-white"
          >
            <MapPin className="h-4 w-4" aria-hidden />
            Explorar la ciudad (ubicación demo)
          </Button>
        </motion.div>
      </div>

      {/* Pie de portada */}
      <footer className="relative px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center">
        <p className="text-[11px] leading-relaxed text-emerald-200/70">
          Empezamos en <span className="font-semibold text-amber-200">tu ciudad</span> · Pronto por
          todo el estado · <span className="font-semibold text-amber-200">Android</span> hoy, iOS muy
          pronto · Datos de mapa de OpenStreetMap
        </p>
      </footer>
    </section>
  );
}
