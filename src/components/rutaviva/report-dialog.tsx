"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  MAX_REPORT_CONTACT,
  MAX_REPORT_DETAIL,
  REPORT_KIND_LABEL,
  REPORT_REASONS,
  deviceMeta,
  type ReportKind,
} from "@/lib/reports";

/**
 * Diálogo de reporte/comentario (POST /api/reports) compartido por:
 *  - kind PLACE: "¿Información incorrecta?" en la ficha de un lugar.
 *  - kind APP:   "Ayuda y comentarios" (chip en la barra del mapa).
 *
 * Motivos predefinidos (obligatorio, chips) + detalle libre opcional +
 * contacto opcional para dar seguimiento. Sin cuenta: envío anónimo con
 * meta de dispositivo automática (solo APP) para reproducir errores.
 */
export function ReportDialog(props: {
  kind: ReportKind;
  placeId?: string;
  placeName?: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [contact, setContact] = useState("");
  const [sending, setSending] = useState(false);
  const reasons = REPORT_REASONS[props.kind];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setSending(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: props.kind,
          placeId: props.kind === "PLACE" ? props.placeId : undefined,
          reason,
          detail: detail.trim() || undefined,
          contact: contact.trim() || undefined,
          meta: props.kind === "APP" ? deviceMeta() : undefined,
        }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) throw new Error(json?.error ?? "No se pudo enviar");
      toast.success("Gracias, nuestro equipo lo revisará pronto");
      props.onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar");
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
      <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-2xl">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader className="text-left">
            <DialogTitle className="text-lg font-black text-stone-800">
              {props.kind === "PLACE" ? "Reportar este lugar" : "Ayuda y comentarios"}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-stone-500">
              {props.kind === "PLACE"
                ? "Nos ayudas a mantener RutaViva confiable y actualizada. Elige el motivo que más se acerque."
                : "Cuéntanos qué pasó o qué mejorarías: errores, ideas o algo en las publicaciones. Todo llega directo al equipo."}
            </DialogDescription>
          </DialogHeader>

          {props.kind === "PLACE" && props.placeName && (
            <p className="rounded-xl bg-stone-50 px-3 py-2 text-xs leading-relaxed text-stone-500">
              <span className="font-semibold text-stone-700">Lugar:</span> {props.placeName}
            </p>
          )}

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-stone-700">Motivo *</legend>
            <div className="flex flex-wrap gap-1.5">
              {reasons.map((r) => {
                const active = reason === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setReason(r.id)}
                    aria-pressed={active}
                    className={
                      "min-h-[36px] rounded-full border px-3 py-1.5 text-xs font-semibold transition " +
                      (active
                        ? "border-emerald-700 bg-emerald-700 text-white"
                        : "border-stone-200 bg-white text-stone-600 hover:border-emerald-300 hover:text-emerald-800")
                    }
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="rv-report-detail">
              {props.kind === "APP" ? "Cuéntanos más (opcional)" : "Detalles (opcional)"}
            </Label>
            <Textarea
              id="rv-report-detail"
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder={
                props.kind === "PLACE"
                  ? "Ej. la entrada está por la calle del malecón, no por la avenida…"
                  : "Ej. al abrir la app no aparece mi ubicación…"
              }
              className="min-h-20 rounded-xl"
              maxLength={MAX_REPORT_DETAIL}
            />
            <p className="text-right text-[11px] text-stone-400" aria-live="polite">
              {detail.length}/{MAX_REPORT_DETAIL}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rv-report-contact">Correo o teléfono para dar seguimiento (opcional)</Label>
            <Input
              id="rv-report-contact"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Ej. maria@correo.com o 314 123 4567"
              className="h-11 rounded-xl"
              maxLength={MAX_REPORT_CONTACT}
              inputMode="email"
              autoComplete="off"
            />
          </div>

          <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-800">
            <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
            {props.kind === "APP"
              ? "Sin cuenta necesaria. Adjuntamos tu tipo de dispositivo para ayudarnos a reproducir el error."
              : "Tu reporte es anónimo: no necesitas cuenta para enviarlo."}
          </p>

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={sending || !reason}
              className="h-11 flex-1 gap-2 rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
            >
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Enviando…
                </>
              ) : (
                "Enviar"
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

/** Etiqueta legible para listados (panel admin). */
export function reportKindTitle(kind: ReportKind): string {
  return REPORT_KIND_LABEL[kind];
}
