"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  DatabaseBackup,
  Download,
  FileJson,
  Loader2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * Sección "Respaldos" del panel de administración.
 *
 *  - Descargar respaldo: GET /api/admin/backup responde un JSON en streaming
 *    que el navegador guarda como archivo en el equipo del equipo RutaViva.
 *  - Restaurar: sube el archivo por fragmentos (Vercel limita cada petición a
 *    4.5 MB) y el servidor reconstruye la base en una sola transacción.
 *
 * Recomendación de uso mostrada en la UI: respaldo semanal y siempre después
 * de aprobar contenido nuevo; guardar al menos 2 copias (PC + nube/correo).
 */

type BackupMeta = {
  createdAt?: string;
  counts?: Record<string, number>;
};

type Picked = {
  file: File;
  meta: BackupMeta;
};

const TABLE_LABELS: Record<string, string> = {
  singularPlace: "lugares",
  review: "reseñas",
  photo: "fotos",
  report: "reportes",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso?: string): string {
  if (!iso) return "fecha desconocida";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "fecha desconocida";
  return d.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

async function postJson(url: string, payload: unknown, attempt = 0): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    // Reintento simple ante fallos de red transitorios (máx. 2 veces).
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      return postJson(url, payload, attempt + 1);
    }
    throw err;
  }
}

export function BackupSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exporting, setExporting] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  /* ---------- Descargar respaldo ---------- */
  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/backup");
      if (res.status === 401) {
        toast({
          variant: "destructive",
          description: "Tu sesión expiró. Vuelve a iniciar sesión en el panel.",
        });
        return;
      }
      if (!res.ok) throw new Error("El servidor no pudo generar el respaldo");

      const blob = await res.blob();
      const header = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(header);
      const filename = match?.[1] ?? `respaldo-rutaviva-${new Date().toISOString().slice(0, 10)}.json`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      let countsSummary = "";
      try {
        const meta = (JSON.parse(await blob.text()) as { meta?: BackupMeta }).meta;
        if (meta?.counts) {
          countsSummary = Object.entries(meta.counts)
            .map(([k, v]) => `${v} ${TABLE_LABELS[k] ?? k}`)
            .join(", ");
        }
      } catch {
        /* el resumen es opcional; el archivo ya se descargó */
      }

      toast({
        title: "Respaldo descargado",
        description:
          `${filename} · ${formatBytes(blob.size)}` + (countsSummary ? ` · ${countsSummary}` : ""),
      });
    } catch (err) {
      toast({
        variant: "destructive",
        description:
          err instanceof Error ? err.message : "No se pudo descargar el respaldo. Intenta de nuevo.",
      });
    } finally {
      setExporting(false);
    }
  }

  /* ---------- Elegir archivo para restaurar ---------- */
  async function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-elegir el mismo archivo
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { meta?: BackupMeta };
      if (parsed?.meta?.app !== "rutaviva") {
        toast({
          variant: "destructive",
          description: "Este archivo no es un respaldo de RutaViva.",
        });
        return;
      }
      setPicked({ file, meta: parsed.meta ?? {} });
      setConfirmOpen(true);
    } catch {
      toast({
        variant: "destructive",
        description: "No se pudo leer el archivo. ¿Es el JSON descargado del respaldo?",
      });
    }
  }

  /* ---------- Restaurar (subida por fragmentos) ---------- */
  async function runRestore() {
    if (!picked || restoring) return;
    setConfirmOpen(false);
    setRestoring(true);
    setProgress(null);
    try {
      const text = await picked.file.text();
      const CHUNK = 1_500_000; // ~1.5 MB por petición (límite Vercel: 4.5 MB)
      const total = Math.max(1, Math.ceil(text.length / CHUNK));
      const sessionId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      setProgress({ done: 0, total });
      const begin = await postJson("/api/admin/restore", {
        phase: "begin",
        sessionId,
        totalChunks: total,
      });
      if (begin.status === 401) {
        toast({
          variant: "destructive",
          description: "Tu sesión expiró. Vuelve a iniciar sesión en el panel.",
        });
        return;
      }
      if (!begin.ok) {
        const d = (await begin.json().catch(() => null)) as { error?: string } | null;
        throw new Error(d?.error ?? "No se pudo iniciar la restauración");
      }

      for (let i = 0; i < total; i++) {
        const chunk = await postJson("/api/admin/restore", {
          phase: "chunk",
          sessionId,
          seq: i,
          data: text.slice(i * CHUNK, (i + 1) * CHUNK),
        });
        if (!chunk.ok) {
          const d = (await chunk.json().catch(() => null)) as { error?: string } | null;
          throw new Error(d?.error ?? `Falló la subida del fragmento ${i + 1}/${total}`);
        }
        setProgress({ done: i + 1, total });
      }

      const commit = await postJson("/api/admin/restore", {
        phase: "commit",
        sessionId,
        totalChunks: total,
      });
      const data = (await commit.json().catch(() => null)) as {
        ok?: boolean;
        restored?: Record<string, number>;
        error?: string;
      } | null;
      if (!commit.ok || !data?.ok) {
        throw new Error(data?.error ?? "No se pudo restaurar la base de datos");
      }

      const restored = data.restored ?? {};
      const summary = Object.entries(TABLE_LABELS)
        .map(([k, label]) => `${restored[k] ?? 0} ${label}`)
        .join(", ");
      toast({
        title: "Base de datos restaurada",
        description: `Se reconstruyó el contenido del respaldo del ${formatDate(picked.meta.createdAt)}: ${summary}.`,
      });
      // Refresca panel y datos públicos (la caché interna vence en ≤60 s).
      queryClient.invalidateQueries();
      setPicked(null);
    } catch (err) {
      toast({
        variant: "destructive",
        description:
          err instanceof Error ? err.message : "No se pudo restaurar la base de datos.",
      });
    } finally {
      setRestoring(false);
      setProgress(null);
    }
  }

  const counts = picked?.meta.counts;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <DatabaseBackup className="h-5 w-5" aria-hidden />
            Copia de seguridad
          </CardTitle>
          <CardDescription>
            Descarga TODA la base de datos (lugares, reseñas, fotos y reportes) como un archivo
            JSON para tu computadora. Es tu seguro ante cualquier percance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            type="button"
            onClick={handleExport}
            disabled={exporting || restoring}
            className="w-full min-h-[44px] font-bold"
          >
            {exporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Generando respaldo…
              </>
            ) : (
              <>
                <Download className="h-4 w-4" aria-hidden />
                Descargar respaldo ahora
              </>
            )}
          </Button>
          <ul className="space-y-1 text-xs leading-relaxed text-stone-500">
            <li>• Descárgalo al menos una vez por semana y siempre después de aprobar reseñas o lugares.</li>
            <li>• Guarda 2 copias: una en tu PC y otra en la nube (correo, Drive…).</li>
            <li>• Hazlo desde el navegador de tu computadora (el WebView de la app puede bloquear descargas).</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="h-5 w-5" aria-hidden />
            Restaurar desde respaldo
          </CardTitle>
          <CardDescription>
            Reconstruye la base de datos EXACTAMENTE como estaba en el respaldo. Úsalo solo si el
            contenido se perdió o quedó mal: reemplaza todo lo actual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={handlePickFile}
            disabled={exporting || restoring}
            aria-label="Archivo de respaldo JSON"
          />
          {picked ? (
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm">
              <p className="flex items-center gap-2 font-bold text-stone-800">
                <FileJson className="h-4 w-4 shrink-0" aria-hidden />
                {picked.file.name}
                <span className="font-normal text-stone-500">
                  ({formatBytes(picked.file.size)})
                </span>
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Respaldo del {formatDate(picked.meta.createdAt)}
                {counts
                  ? ` · ${counts.singularPlace ?? 0} lugares, ${counts.review ?? 0} reseñas, ${counts.photo ?? 0} fotos`
                  : ""}
              </p>
            </div>
          ) : null}

          {restoring && progress ? (
            <div className="space-y-2">
              <Progress
                value={Math.round((progress.done / Math.max(1, progress.total)) * 100)}
                aria-label="Progreso de la restauración"
              />
              <p className="text-center text-xs font-bold text-stone-500">
                Subiendo el respaldo… fragmento {progress.done}/{progress.total}
              </p>
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={exporting || restoring}
              className="min-h-[44px]"
            >
              Elegir archivo…
            </Button>
            <Button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!picked || exporting || restoring}
              className={cn("min-h-[44px] font-bold")}
            >
              {restoring ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Restaurando…
                </>
              ) : (
                "Restaurar"
              )}
            </Button>
          </div>
          <Separator />
          <p className="flex items-start gap-2 text-xs leading-relaxed text-stone-500">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
            Restaurar borra el contenido actual y lo sustituye por el del archivo. La operación es
            transaccional: si algo falla, la base queda intacta.
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Restaurar la base de datos?</AlertDialogTitle>
            <AlertDialogDescription>
              Se reemplazará TODO el contenido actual por el del respaldo
              {picked ? ` del ${formatDate(picked.meta.createdAt)}` : ""}. Los lugares, reseñas,
              fotos y reportes actuales que no estén en el archivo se perderán.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={runRestore}>Sí, restaurar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
