"use client";

import { useState, type ReactNode } from "react";
import {
  Check,
  FileQuestion,
  Handshake,
  Scale,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useBackClose } from "@/hooks/use-back-close";

type PrivacyNoticeProps = {
  /** Estilo del botón que abre el aviso. */
  className?: string;
  /** Texto del botón (si no se pasan children). */
  label?: string;
  /** Contenido del botón (para tarjetas con ícono y descripción). */
  children?: ReactNode;
};

/**
 * Aviso de privacidad de RutaViva: qué envían los usuarios, qué SÍ y qué NO
 * podemos hacer (usuarios y administradores), deslinde de responsabilidad
 * sobre el contenido subido y los derechos de quien participa.
 *
 * El botón que lo abre se coloca en el panel Guía, en los formularios donde
 * se envían fotos/datos y en el panel de administración, para que usuarios
 * y administradores compartan las mismas reglas claras.
 */
export function PrivacyNotice({ className, label = "Aviso de privacidad", children }: PrivacyNoticeProps) {
  const [open, setOpen] = useState(false);
  // El botón ◀ del móvil también cierra el aviso y regresa a la pantalla anterior.
  useBackClose(open, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children ?? label}
      </button>

      <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-2xl p-0">
        <div className="p-5 pb-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <DialogTitle className="text-lg font-black leading-tight text-stone-800">
                Aviso de privacidad
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-stone-500">
                RutaViva · guía de Manzanillo escrita por viajeros como tú.
              </DialogDescription>
            </div>
          </div>

          <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm leading-relaxed text-emerald-900">
            <strong>En una frase:</strong> publicamos lo que la comunidad envía. Cada quien es
            responsable de sus fotos y textos; nosotros solo los revisamos, cuidamos y usamos para
            mejorar la guía.
          </p>

          <p className="mt-3 text-xs leading-relaxed text-stone-500">
            Lo que los viajeros nos envían: <strong>fotos</strong>, <strong>reseñas</strong>,{" "}
            <strong>tu nombre</strong> (opcional), <strong>lugares sugeridos</strong> y{" "}
            <strong>tu ubicación</strong> — solo mientras usas la app.
          </p>
        </div>

        <div className="space-y-4 px-5 pb-5">
          <section aria-labelledby="rv-priv-si">
            <h3 id="rv-priv-si" className="flex items-center gap-1.5 text-sm font-bold text-emerald-800">
              <Check className="h-4 w-4" aria-hidden />
              Lo que SÍ podemos hacer
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-stone-600">
              <Li>Revisar todo antes de publicar: nada llega al mapa sin pasar por el equipo RutaViva.</Li>
              <Li>Editar textos por claridad, o rechazar y eliminar lo que rompa las reglas o la ley, incluso después de publicado.</Li>
              <Li>Mostrar el nombre que escribas junto a tus fotos y reseñas.</Li>
              <Li>Usar tu ubicación solo para ordenar los lugares cercanos: no se publica ni te identifica.</Li>
              <Li>Como administrador: moderar los aportes (aprobar, corregir, rechazar, eliminar) bajo estas mismas reglas.</Li>
            </ul>
          </section>

          <section aria-labelledby="rv-priv-no">
            <h3 id="rv-priv-no" className="flex items-center gap-1.5 text-sm font-bold text-stone-800">
              <X className="h-4 w-4 text-red-600" aria-hidden />
              Lo que NO podemos (ni vamos a) hacer
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-stone-600">
              <Li>No pedimos correo, teléfono ni datos de pago. Si alguien te los pide diciendo ser RutaViva, no somos nosotros.</Li>
              <Li>No vendemos, rentamos ni compartimos tu información con nadie.</Li>
              <Li>No te rastreamos: tu GPS solo se usa cuando tú lo activas en la app.</Li>
              <Li>No garantizamos el contenido: horarios, precios y datos cambian; usa la guía como referencia (información “tal cual”).</Li>
              <Li>No respondemos legalmente por lo que suben los usuarios: cada foto y cada texto es responsabilidad exclusiva de quien lo envió.</Li>
            </ul>
          </section>

          <section aria-labelledby="rv-priv-trato" className="rounded-xl bg-amber-50 px-3 py-2.5">
            <h3 id="rv-priv-trato" className="flex items-center gap-1.5 text-sm font-bold text-amber-900">
              <Handshake className="h-4 w-4" aria-hidden />
              Tu parte del trato al subir contenido
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-amber-900/90">
              <Li>Las fotos son tuyas o tienes permiso de quien las tomó.</Li>
              <Li>Si aparece una persona reconocible, tienes su consentimiento.</Li>
              <Li>Nada de menores de edad en situaciones privadas, ni contenido ofensivo, violento o ilegal.</Li>
              <Li>Tu reseña es veraz y de primera mano.</Li>
            </ul>
          </section>

          <section aria-labelledby="rv-priv-derechos" className="rounded-xl border border-stone-200 px-3 py-2.5">
            <h3 id="rv-priv-derechos" className="flex items-center gap-1.5 text-sm font-bold text-stone-800">
              <FileQuestion className="h-4 w-4 text-emerald-600" aria-hidden />
              Tus derechos
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-stone-600">
              Puedes pedirnos ver, corregir o eliminar lo que publicaste (y tu nombre) en cualquier
              momento, sin costo. Escríbenos por el canal donde conseguiste la app y lo atendemos a
              la brevedad.
            </p>
          </section>

          <section aria-labelledby="rv-priv-legal">
            <h3 id="rv-priv-legal" className="flex items-center gap-1.5 text-xs font-bold text-stone-500">
              <Scale className="h-3.5 w-3.5" aria-hidden />
              Marco legal
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-stone-400">
              Seguimos los principios de los marcos internacionales de protección de datos (como el
              RGPD de la Unión Europea: consentimiento, finalidad, minimización) y respetamos las
              leyes nacionales y locales de cada país donde se use la app — en México, la LFPDPPP y
              su marco vigente 2025, además de las normas aplicables del estado de Colima. Podemos
              actualizar este aviso: la versión publicada en la app es la vigente.
            </p>
          </section>

          <p className="text-center text-xs text-stone-400">
            Al enviar fotos, reseñas o sugerencias aceptas este aviso. · Última actualización:
            octubre 2025
          </p>

          <Button
            onClick={() => setOpen(false)}
            className="h-11 w-full rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
          >
            Entendido
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Li({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-stone-300" />
      <span>{children}</span>
    </li>
  );
}
