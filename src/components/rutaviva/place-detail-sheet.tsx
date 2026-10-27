"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es as esLocale } from "date-fns/locale";
import {
  CheckCircle2,
  Flag,
  Lightbulb,
  Loader2,
  MapPin,
  Navigation,
  PenLine,
  ShieldCheck,
  Star,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PhotoUpload } from "./photo-upload";
import { PhotoLightbox } from "./photo-lightbox";
import { directionsUrl, formatDistance } from "@/lib/geo";
import type { PlaceDetail, PlaceDetailResponse } from "@/lib/place-types";

type PlaceDetailSheetProps = {
  detail: PlaceDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Bottom-sheet con el detalle de un lugar (singular o común). */
export function PlaceDetailSheet({ detail, open, onOpenChange }: PlaceDetailSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="rv-drawer-max">
        {detail && (
          <SheetBody
            key={detail.id}
            detail={detail}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DrawerContent>
    </Drawer>
  );
}

function SheetBody({ detail, onClose }: { detail: PlaceDetail; onClose: () => void }) {
  const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null);
  // En la APK (Capacitor) abrimos la app de Google Maps nativa; en navegador/PWA,
  // la ruta en una pestaña nueva.
  const isNative = Capacitor.isNativePlatform();

  /** Abre la ruta hacia este lugar en Google Maps. */
  const openRoute = async () => {
    const url = directionsUrl({ lat: detail.lat, lng: detail.lng }, detail.name);
    if (!isNative) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    try {
      const { value } = await CapApp.launcher({ url });
      if (!value) {
        toast.error("No encontramos una app de mapas en este dispositivo");
      }
    } catch {
      toast.error("No se pudo abrir Google Maps");
    }
  };
  // "idle" = botón | "form" = formulario | "done" = panel de éxito.
  // Vive aquí arriba para que "sé el primero" también pueda abrir el formulario.
  const [reviewStage, setReviewStage] = useState<"idle" | "form" | "done">("idle");
  const [submittedName, setSubmittedName] = useState("");

  // Detalle público (solo lugares singulares validados): calificación + reseñas.
  const detailQuery = useQuery({
    queryKey: ["place-detail", detail.id],
    queryFn: async (): Promise<PlaceDetailResponse> => {
      const res = await fetch(`/api/places/${detail.id}`);
      if (!res.ok) throw new Error("No se pudieron cargar las reseñas");
      return (await res.json()) as PlaceDetailResponse;
    },
    enabled: detail.kind === "singular",
    staleTime: 30 * 1000,
  });

  return (
    // flex-1 + min-h-0: la hoja ocupa hasta su alto máximo y la zona central
    // (reseñas) hace scroll por sí sola — el pie con "Cómo llegar" siempre es visible.
    <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">
      <DrawerHeader className="shrink-0 pb-2 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className="border-0 hover:opacity-90"
            style={
              detail.kind === "common" && detail.color
                ? { background: `${detail.color}1a`, color: detail.color }
                : { background: "#d1fae5", color: "#065f46" }
            }
          >
            {detail.categoryLabel}
          </Badge>
          {detail.distanceKm != null && (
            <span className="text-xs font-semibold text-emerald-700">
              a {formatDistance(detail.distanceKm)}
            </span>
          )}
        </div>
        <DrawerTitle className="pt-1 text-xl font-black leading-tight text-stone-800">
          {detail.name}
        </DrawerTitle>
        <DrawerDescription className="sr-only">
          Detalle del lugar, reseñas y opciones de navegación
        </DrawerDescription>
      </DrawerHeader>

      {/* Zona con scroll propio: descripción, fotos y reseñas nunca tapan el pie */}
      <div className="rv-scroll min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 pb-2">
        {detail.kind === "singular" && (
          <RatingSummary
            state={detailQuery.status}
            ratingAvg={detailQuery.data?.place.ratingAvg ?? null}
            ratingCount={detailQuery.data?.place.ratingCount ?? 0}
            onStartReview={() => setReviewStage("form")}
          />
        )}

        {detail.imageUrl && (
          <img
            src={detail.imageUrl}
            alt={`Imagen de ${detail.name}`}
            className="h-44 w-full rounded-2xl object-cover"
            loading="lazy"
          />
        )}

        {detail.description && (
          <p className="text-sm leading-relaxed text-stone-600">{detail.description}</p>
        )}

        {detail.tips && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm leading-relaxed text-amber-900">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
            <span>
              <strong className="font-semibold">Tip:</strong> {detail.tips}
            </span>
          </p>
        )}

        {detail.address && (
          <p className="flex items-start gap-2 text-sm text-stone-500">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-stone-400" aria-hidden />
            {detail.address}
          </p>
        )}

        <p className="text-xs text-stone-400">
          {detail.lat.toFixed(5)}, {detail.lng.toFixed(5)}
          {detail.kind === "common" && " · OpenStreetMap"}
        </p>

        {detail.kind === "singular" && (
          <ReviewsSection
            placeId={detail.id}
            placeName={detail.name}
            reviews={detailQuery.data?.reviews ?? []}
            loading={detailQuery.isPending}
            stage={reviewStage}
            onStageChange={setReviewStage}
            submittedName={submittedName}
            onSubmitted={(name) => {
              setSubmittedName(name);
              setReviewStage("done");
            }}
            onOpenPhoto={(url, alt) => setLightbox({ url, alt })}
          />
        )}
      </div>

      {/* Pie fijo: siempre visible sin depender del scroll de las reseñas */}
      <DrawerFooter className="flex-row gap-2 border-t border-stone-100 bg-background pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <Button
          onClick={openRoute}
          className="h-12 flex-[2] gap-2 bg-emerald-700 font-bold hover:bg-emerald-800"
        >
          <Navigation className="h-4 w-4" aria-hidden />
          Cómo llegar
        </Button>
        <Button
          variant="outline"
          className="h-12 flex-1 border-emerald-300 font-semibold text-emerald-800 hover:bg-emerald-50"
          onClick={onClose}
        >
          Cerrar
        </Button>
      </DrawerFooter>

      <PhotoLightbox
        url={lightbox?.url ?? null}
        alt={lightbox?.alt ?? "Foto de viajeros"}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}

/* ==================== Calificación resumida ==================== */

function RatingSummary(props: {
  state: "pending" | "error" | "success";
  ratingAvg: number | null;
  ratingCount: number;
  onStartReview: () => void;
}) {
  const { state, ratingAvg, ratingCount } = props;

  if (state === "pending") {
    return (
      <div className="flex items-center gap-2" aria-hidden>
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="h-4 w-20 rounded-full" />
      </div>
    );
  }
  if (state === "error") {
    return (
      <p className="text-xs font-medium text-stone-400">
        No pudimos cargar las reseñas de este lugar.
      </p>
    );
  }

  if (ratingCount === 0) {
    return (
      <button
        type="button"
        onClick={props.onStartReview}
        className="flex min-h-[32px] items-center gap-1.5 rounded-lg text-sm font-medium text-stone-500 transition hover:text-emerald-700"
      >
        <Star className="h-4 w-4 text-stone-300" aria-hidden />
        Aún sin reseñas · sé el primero
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-0.5" aria-hidden>
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={
              i <= Math.round(ratingAvg ?? 0)
                ? "h-4 w-4 fill-amber-400 text-amber-400"
                : "h-4 w-4 text-stone-300"
            }
          />
        ))}
      </span>
      <span className="text-sm font-bold text-stone-700">
        {(ratingAvg ?? 0).toFixed(1)}
      </span>
      <span className="text-sm text-stone-500">
        · {ratingCount} {ratingCount === 1 ? "reseña" : "reseñas"}
      </span>
    </div>
  );
}

/* ==================== Reseñas de viajeros ==================== */

function ReviewsSection(props: {
  placeId: string;
  placeName: string;
  reviews: PlaceDetailResponse["reviews"];
  loading: boolean;
  stage: "idle" | "form" | "done";
  onStageChange: (stage: "idle" | "form" | "done") => void;
  submittedName: string;
  onSubmitted: (authorName: string) => void;
  onOpenPhoto: (url: string, alt: string) => void;
}) {
  const { reviews, loading, stage } = props;
  const setStage = props.onStageChange;
  // Reseña a reportar (mecanismo "Reportar reseña" — política UGC de Google Play).
  const [reportTarget, setReportTarget] = useState<PlaceDetailResponse["reviews"][number] | null>(
    null
  );

  return (
    <section aria-label="Reseñas de viajeros" className="space-y-3 rounded-2xl bg-stone-50 p-3">
      <h3 className="text-sm font-black uppercase tracking-wide text-stone-500">
        Reseñas de viajeros
      </h3>

      {loading ? (
        <div className="space-y-2" aria-hidden>
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm leading-relaxed text-stone-500">
          Todavía no hay reseñas publicadas para este lugar. Tu experiencia puede ayudar
          a otros viajeros.
        </p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-1">
                <p className="text-sm font-bold text-stone-800">{r.authorName}</p>
                <span className="text-xs text-stone-400">
                  {formatDistanceToNow(new Date(r.createdAt), {
                    addSuffix: true,
                    locale: esLocale,
                  })}
                </span>
              </div>
              <span
                className="mt-0.5 flex items-center gap-0.5"
                role="img"
                aria-label={`${r.rating} de 5 estrellas`}
              >
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    aria-hidden
                    className={
                      i <= r.rating
                        ? "h-3.5 w-3.5 fill-amber-400 text-amber-400"
                        : "h-3.5 w-3.5 text-stone-300"
                    }
                  />
                ))}
              </span>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{r.comment}</p>
              {r.photos.length > 0 && (
                <div className="mt-2 grid grid-cols-3 gap-1.5">
                  {r.photos.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => props.onOpenPhoto(p.url, `Foto de ${r.authorName}`)}
                      className="aspect-square overflow-hidden rounded-lg border border-stone-200 transition hover:opacity-90"
                      aria-label={`Ver foto de ${r.authorName}`}
                    >
                      <img
                        src={p.url}
                        alt={`Foto de ${r.authorName}`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              )}
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setReportTarget(r)}
                  aria-label={`Reportar la reseña de ${r.authorName}`}
                  className="inline-flex h-8 min-w-[44px] items-center gap-1 rounded-lg px-2 text-xs font-medium text-stone-400 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
                >
                  <Flag className="h-3 w-3" aria-hidden />
                  Reportar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {stage === "idle" && (
        <Button
          type="button"
          onClick={() => setStage("form")}
          className="h-11 w-full gap-2 rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
        >
          <PenLine className="h-4 w-4" aria-hidden />
          Escribir reseña
        </Button>
      )}

      {stage === "form" && (
        <ReviewForm
          placeId={props.placeId}
          onCancel={() => setStage("idle")}
          onSubmitted={props.onSubmitted}
        />
      )}

      {stage === "done" && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" aria-hidden />
          <p className="mt-2 text-base font-black text-emerald-900">
            ¡Gracias, {props.submittedName || "viajero"}!
          </p>
          <p className="mt-1 text-sm leading-relaxed text-emerald-800">
            Tu reseña está en revisión. Cuando el equipo la valide aparecerá publicada aquí.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => setStage("form")}
            className="mt-3 h-11 rounded-xl border-emerald-300 font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            Escribir otra
          </Button>
        </div>
      )}

      {reportTarget && (
        <ReportReviewDialog
          key={reportTarget.id}
          review={reportTarget}
          placeId={props.placeId}
          onClose={() => setReportTarget(null)}
        />
      )}
    </section>
  );
}

/* ==================== Reportar reseña (política UGC) ==================== */

const MAX_REPORT_LENGTH = 300;

function ReportReviewDialog(props: {
  review: PlaceDetailResponse["reviews"][number];
  placeId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const queryClient = useQueryClient();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch(`/api/reviews/${props.review.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(json?.error ?? "No se pudo enviar el reporte");
      }
      toast.success("Gracias, nuestro equipo revisará esta reseña");
      // La reseña reportada se oculta al público de inmediato: refrescamos
      // el detalle para reflejarlo.
      void queryClient.invalidateQueries({ queryKey: ["place-detail", props.placeId] });
      props.onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar el reporte");
      setSending(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !sending) props.onClose();
      }}
    >
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg font-black text-stone-800">
              Reportar reseña
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-stone-500">
              Nos ayudas a mantener RutaViva confiable. Nuestro equipo revisará este contenido.
            </DialogDescription>
          </DialogHeader>

          <p className="rounded-xl bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-500">
            <span className="font-semibold text-stone-700">Reseña de {props.review.authorName}:</span>{" "}
            “{props.review.comment.length > 90 ? `${props.review.comment.slice(0, 90)}…` : props.review.comment}”
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="rv-report-reason">Motivo (opcional)</Label>
            <Textarea
              id="rv-report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. spam, contenido ofensivo, información falsa…"
              className="min-h-20 rounded-xl"
              maxLength={MAX_REPORT_LENGTH}
            />
            <p className="text-right text-[11px] text-stone-400" aria-live="polite">
              {reason.length}/{MAX_REPORT_LENGTH}
            </p>
          </div>

          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-800">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
            Tu reporte es anónimo: no necesitas cuenta para enviarlo.
          </p>

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={sending}
              className="h-11 flex-1 gap-2 rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Enviando…
                </>
              ) : (
                "Enviar reporte"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={props.onClose}
              disabled={sending}
              className="h-11 rounded-xl border-stone-300"
            >
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ==================== Formulario de reseña ==================== */

function ReviewForm(props: {
  placeId: string;
  onCancel: () => void;
  onSubmitted: (authorName: string) => void;
}) {
  const [name, setName] = useState("");
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shown = hover > 0 ? hover : rating;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 2) return setError("Escribe tu nombre (mínimo 2 caracteres).");
    if (rating < 1) return setError("Elige tu calificación con las estrellas.");
    if (comment.trim().length < 5)
      return setError("Cuéntanos un poco más: mínimo 5 caracteres.");

    setSaving(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: props.placeId,
          authorName: name.trim(),
          rating,
          comment: comment.trim(),
          photos,
        }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(json?.error ?? "No se pudo enviar la reseña");
      }
      props.onSubmitted(name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-emerald-200 bg-white p-3">
      <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-800">
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
        Tu reseña pasa por revisión del equipo RutaViva antes de publicarse
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="rv-review-name">Tu nombre</Label>
        <Input
          id="rv-review-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. María G."
          className="h-11 rounded-xl"
          maxLength={40}
          required
        />
      </div>

      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-stone-700">Tu calificación</span>
        <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              aria-label={`Calificar con ${i} ${i === 1 ? "estrella" : "estrellas"}`}
              aria-pressed={rating >= i}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(0)}
              onClick={() => setRating(i)}
              className="rounded-lg p-1.5 transition hover:scale-110 active:scale-95"
            >
              <Star
                aria-hidden
                className={
                  i <= shown
                    ? "h-7 w-7 fill-amber-400 text-amber-400"
                    : "h-7 w-7 text-stone-300"
                }
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="ml-1 text-sm font-bold text-stone-600">{rating}/5</span>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rv-review-comment">Tu experiencia</Label>
        <Textarea
          id="rv-review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="¿Qué tal tu visita? ¿Qué recomendarías a otros viajeros?"
          className="min-h-20 rounded-xl"
          maxLength={800}
          required
        />
        <p className="text-right text-[11px] text-stone-400" aria-live="polite">
          {comment.length}/800
        </p>
      </div>

      <PhotoUpload
        photos={photos}
        onChange={setPhotos}
        max={3}
        label="Fotos (opcional)"
      />

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={saving}
          className="h-11 flex-1 gap-2 rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Enviando…
            </>
          ) : (
            "Enviar reseña"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={props.onCancel}
          disabled={saving}
          className="h-11 rounded-xl border-stone-300"
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
