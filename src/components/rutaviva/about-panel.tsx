"use client";

import {
  BookOpen,
  Database,
  Globe2,
  ImagePlay,
  MapPinned,
  ShieldCheck,
  Smartphone,
  Star,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { COMMON_TYPES, SINGULAR_CATEGORIES } from "@/lib/geo";
import type { SingularPlaceDTO } from "@/lib/place-types";
import { PrivacyNotice } from "@/components/rutaviva/privacy-notice";

type AboutPanelProps = {
  places: SingularPlaceDTO[];
  onShowSplash: () => void;
};

export function AboutPanel({ places, onShowSplash }: AboutPanelProps) {
  const categoriesUsed = new Set(places.map((p) => p.category)).size;

  return (
    <div className="mx-auto w-full max-w-md space-y-5 px-4 pb-24 pt-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-black tracking-tight text-stone-800">Guía de la app</h1>
        <p className="text-sm text-stone-500">
          RutaViva es tu guía turística de Manzanillo: lugares singulares + servicios esenciales.
        </p>
      </header>

      {/* Estadísticas */}
      <section
        aria-label="Estadísticas del catálogo"
        className="grid grid-cols-3 gap-3 text-center"
      >
        <Stat value={String(places.length)} label="Lugares singulares" />
        <Stat value={String(categoriesUsed)} label="Categorías activas" />
        <Stat value={String(COMMON_TYPES.length)} label="Servicios en vivo" />
      </section>

      {/* Flujo de publicación */}
      <section
        aria-label="Cómo funciona la publicación"
        className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm"
      >
        <h2 className="flex items-center gap-2 text-sm font-bold text-stone-800">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <ShieldCheck className="h-4 w-4" aria-hidden />
          </span>
          ¿Cómo funciona la publicación?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-500">
          Los viajeros sugieren lugares, reseñas y fotos → el equipo RutaViva las revisa → solo
          lo validado se publica en la app.
        </p>
        <ol className="mt-3 space-y-2.5">
          <PublishStep
            n={1}
            icon={UserPlus}
            title="Sugieres"
            text="Envías lugares y reseñas con tus fotos desde la app; todo entra a revisión."
          />
          <PublishStep
            n={2}
            icon={ShieldCheck}
            title="Validamos"
            text="Previo estudio, el equipo RutaViva revisa cada aporte con los formatos de publicación."
          />
          <PublishStep
            n={3}
            icon={MapPinned}
            title="Se publica"
            text="Lo aprobado aparece en el mapa y en las reseñas del lugar, para toda la comunidad."
          />
        </ol>
      </section>

      {/* Aviso de privacidad: reglas compartidas entre usuarios y administradores */}
      <PrivacyNotice
        className="flex w-full items-start gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/50"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <ShieldCheck className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-stone-800">Aviso de privacidad</span>
          <span className="mt-0.5 block text-xs leading-relaxed text-stone-500">
            Qué podemos y qué no podemos hacer con las fotos y la información que se comparte en
            RutaViva. Léelo antes de publicar: aplica a viajeros y administradores.
          </span>
        </span>
      </PrivacyNotice>

      <div className="space-y-3">
        <InfoCard
          icon={Database}
          title="Escalable por diseño"
          text="Los lugares singulares viven en una base de datos (Prisma + SQLite, migre a Postgres cuando quieras). Agrega lugares desde el botón + sin tocar código, o conecta un panel de administración con roles."
        />
        <InfoCard
          icon={MapPinned}
          title="De Manzanillo a todo Colima"
          text="Arrancamos en Manzanillo. Siguientes paradas: Armería y Tecomán en la costa; luego Colima, Comala, Villa de Álvarez, Coquimatlán, Cuauhtémoc, Ixtlahuacán y Minatitlán. Cada municipio llega con su propio catálogo de lugares singulares, sin cambiar una línea de código."
        />
        <InfoCard
          icon={Globe2}
          title="Datos abiertos en vivo"
          text="Farmacias, gasolineras, tiendas, cajeros y más provienen de OpenStreetMap (Overpass API): gratis, sin API key y siempre actualizados por la comunidad. Si mañana agregas una categoría nueva, solo añades su filtro."
        />
        <InfoCard
          icon={Smartphone}
          title="Una base de código, dos plataformas"
          text="Esta app web se convierte en APK/AAB con Capacitor para Google Play y, más adelante, en app iOS. La misma interfaz, la misma lógica, sin reescribir nada."
        />
        <InfoCard
          icon={ImagePlay}
          title="Categorías ampliables"
          text={`Hoy: ${SINGULAR_CATEGORIES.map((c) => c.label).join(", ")}. Nuevas categorías (lanchas, ruinas, vida nocturna…) son un cambio pequeño en el catálogo.`}
        />
        <InfoCard
          icon={BookOpen}
          title="Consejo de curaduría"
          text="Un buen lugar singular tiene foto, descripción de 2–3 líneas y un tip práctico (horarios, mejor hora, cómo llegar). Eso hace que la gente vuelva."
        />
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <p className="flex items-start gap-2 text-sm leading-relaxed text-emerald-900">
          <Star className="mt-0.5 h-4 w-4 shrink-0 fill-amber-400 text-amber-400" aria-hidden />
          Los lugares con estrella son <strong>destacados</strong>: aparecen primero en el mapa y en
          la lista. Márcalos con <code className="rounded bg-emerald-100 px-1">featured</code> en la
          base de datos.
        </p>
      </div>

      <Button
        variant="outline"
        onClick={onShowSplash}
        className="w-full rounded-2xl border-emerald-300 text-emerald-800 hover:bg-emerald-50"
      >
        Ver la portada otra vez
      </Button>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
      <p className="text-2xl font-black text-emerald-700">{value}</p>
      <p className="mt-0.5 text-[11px] font-medium leading-tight text-stone-500">{label}</p>
    </div>
  );
}

function PublishStep({
  n,
  icon: Icon,
  title,
  text,
}: {
  n: number;
  icon: typeof Database;
  title: string;
  text: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-sm font-black text-white"
      >
        {n}
      </span>
      <div>
        <p className="flex items-center gap-1.5 text-sm font-bold text-stone-800">
          <Icon className="h-4 w-4 text-emerald-600" aria-hidden />
          {title}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-stone-500">{text}</p>
      </div>
    </li>
  );
}

function InfoCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Database;
  title: string;
  text: string;
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-bold text-stone-800">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-stone-500">{text}</p>
    </section>
  );
}
