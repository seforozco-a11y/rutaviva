"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { es as esLocale } from "date-fns/locale";
import {
  Building2,
  Check,
  CheckCircle2,
  Flag,
  FlagOff,
  Loader2,
  LogOut,
  MapPin,
  MoreVertical,
  Pencil,
  ShieldCheck,
  Star,
  Trash2,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PhotoLightbox } from "@/components/rutaviva/photo-lightbox";
import { useToast } from "@/hooks/use-toast";
import { categoryLabel, SINGULAR_CATEGORIES } from "@/lib/geo";
import type { Coordinates } from "@/lib/place-types";
import { cn } from "@/lib/utils";
import {
  checksComplete,
  emptyPlaceValues,
  parseCoords,
  placeChecks,
  PlaceFieldsForm,
  type PlaceFormValues,
} from "./place-fields-form";

/* ==================== Tipos del overview ==================== */

type AdminPhoto = { id: string; url: string; status: string };

type AdminPendingPlace = {
  id: string;
  name: string;
  description: string;
  category: string;
  lat: number;
  lng: number;
  address: string | null;
  tips: string | null;
  suggestedBy: string | null;
  city: string;
  state: string;
  createdAt: string;
  photos: AdminPhoto[];
};

type AdminPendingReview = {
  id: string;
  placeId: string;
  placeName: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
  photos: AdminPhoto[];
};

/** Reseña reportada por un usuario (política UGC de Google Play). */
type AdminFlaggedReview = {
  id: string;
  placeId: string;
  placeName: string;
  authorName: string;
  rating: number;
  comment: string;
  status: string;
  reason: string | null;
  flaggedAt: string | null;
  createdAt: string;
  photos: AdminPhoto[];
};

type AdminPlaceRow = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  address: string | null;
  imageUrl: string | null;
  tips: string | null;
  featured: boolean;
  active: boolean;
  status: string;
  source: string;
  suggestedBy: string | null;
  city: string;
  state: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  reviewsCount: number;
  photosCount: number;
  ratingAvg: number | null;
  ratingCount: number;
};

type AdminOverview = {
  stats: {
    placesTotal: number;
    placesPublished: number;
    pendingPlaces: number;
    pendingReviews: number;
    reviewsTotal: number;
    flaggedReviews: number;
  };
  pendingPlaces: AdminPendingPlace[];
  pendingReviews: AdminPendingReview[];
  flaggedReviews: AdminFlaggedReview[];
  allPlaces: AdminPlaceRow[];
};

const JSON_HEADERS = { "Content-Type": "application/json" };

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string } | null;
    return j?.error ?? fallback;
  } catch {
    return fallback;
  }
}

function relativeDate(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: esLocale });
  } catch {
    return "";
  }
}

/* ==================== Panel (puerta de sesión) ==================== */

export function AdminPanel({ origin = null }: { origin?: Coordinates | null }) {
  const sessionQuery = useQuery({
    queryKey: ["admin-session"],
    queryFn: async (): Promise<{ authenticated: boolean }> => {
      const res = await fetch("/api/admin/session");
      if (!res.ok) throw new Error("No se pudo verificar la sesión");
      return (await res.json()) as { authenticated: boolean };
    },
    staleTime: 60 * 1000,
  });

  if (sessionQuery.isPending) {
    return (
      <div className="mx-auto w-full max-w-md space-y-4 px-4 pt-8" aria-busy>
        <Skeleton className="mx-auto h-40 w-full rounded-2xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  if (sessionQuery.isError || !sessionQuery.data) {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-10">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="text-sm font-medium text-amber-800">
            No pudimos verificar tu acceso. Revisa tu conexión e intenta de nuevo.
          </p>
          <Button
            variant="outline"
            onClick={() => void sessionQuery.refetch()}
            className="mt-3 h-11 border-amber-300"
          >
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  if (!sessionQuery.data.authenticated) {
    return <AdminLogin />;
  }

  return <AdminDashboard origin={origin} />;
}

/* ==================== Login con PIN ==================== */

function AdminLogin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(false);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      toast({
        title: "¡Hola, equipo!",
        description: "Bienvenidos al panel de RutaViva.",
      });
      queryClient.setQueryData(["admin-session"], { authenticated: true });
      void queryClient.invalidateQueries({ queryKey: ["admin-session"] });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 pb-24 pt-14">
      <form
        onSubmit={submit}
        className="w-full rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
      >
        <div className="flex flex-col items-center text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <ShieldCheck className="h-8 w-8" aria-hidden />
          </span>
          <h1 className="mt-3 text-xl font-black tracking-tight text-stone-800">
            Panel del equipo RutaViva
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-stone-500">
            Acceso exclusivo para administradores: autoriza lugares, valida reseñas y
            fotografías.
          </p>
        </div>

        <div className="mt-5 space-y-1.5">
          <Label htmlFor="rv-admin-pin">PIN de acceso</Label>
          <Input
            id="rv-admin-pin"
            type="password"
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••••••"
            className="h-11 rounded-xl"
            required
          />
        </div>

        {error && (
          <p
            role="alert"
            className="mt-3 animate-pulse rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
          >
            PIN incorrecto
          </p>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="mt-4 h-11 w-full gap-2 rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Verificando…
            </>
          ) : (
            "Entrar"
          )}
        </Button>
      </form>
    </div>
  );
}

/* ==================== Dashboard ==================== */

function AdminDashboard({ origin }: { origin: Coordinates | null }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("review");

  const overviewQuery = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async (): Promise<AdminOverview> => {
      const res = await fetch("/api/admin/overview");
      if (!res.ok) throw new Error("No se pudo cargar el panel");
      return (await res.json()) as AdminOverview;
    },
    refetchOnWindowFocus: false,
  });

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
  }, [queryClient]);

  const refreshPublic = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["places"] });
  }, [queryClient]);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      /* la sesión caduca sola aunque falle la llamada */
    }
    queryClient.setQueryData(["admin-session"], { authenticated: false });
    queryClient.removeQueries({ queryKey: ["admin-overview"] });
    toast({ title: "Sesión cerrada", description: "Vuelve pronto." });
  }, [queryClient, toast]);

  /* ---- Acciones del equipo (lanzan error; la UI muestra el mensaje) ---- */

  const publishValidated = useCallback(
    async (pendingId: string, values: PlaceFormValues) => {
      const { lat, lng } = parseCoords(values);
      const updateRes = await fetch(`/api/admin/places/${pendingId}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          action: "update",
          name: values.name.trim(),
          description: values.description.trim(),
          category: values.category,
          lat,
          lng,
          address: values.address.trim() || null,
          imageUrl: values.photos[0] ?? null,
          tips: values.tips.trim() || null,
          city: values.city.trim() || "Manzanillo",
          state: values.state.trim() || "Colima",
        }),
      });
      if (!updateRes.ok) {
        throw new Error(await readError(updateRes, "No se pudo actualizar el lugar"));
      }
      const approveRes = await fetch(`/api/admin/places/${pendingId}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ action: "approve" }),
      });
      if (!approveRes.ok) {
        throw new Error(await readError(approveRes, "No se pudo aprobar el lugar"));
      }
      toast({
        title: "Lugar publicado",
        description: `${values.name.trim()} ya aparece en el mapa para todos.`,
      });
      refresh();
      refreshPublic();
      void queryClient.invalidateQueries({ queryKey: ["place-detail", pendingId] });
    },
    [toast, refresh, refreshPublic, queryClient]
  );

  const editPlace = useCallback(
    async (row: AdminPlaceRow, values: PlaceFormValues) => {
      const { lat, lng } = parseCoords(values);
      const res = await fetch(`/api/admin/places/${row.id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          action: "update",
          name: values.name.trim(),
          description: values.description.trim(),
          category: values.category,
          lat,
          lng,
          address: values.address.trim() || null,
          imageUrl: values.photos[0] ?? null,
          tips: values.tips.trim() || null,
          city: values.city.trim() || row.city,
          state: values.state.trim() || row.state,
          featured: row.featured,
        }),
      });
      if (!res.ok) throw new Error(await readError(res, "No se pudo guardar el lugar"));
      toast({ title: "Lugar actualizado", description: `${values.name.trim()} quedó al día.` });
      refresh();
      refreshPublic();
      void queryClient.invalidateQueries({ queryKey: ["place-detail", row.id] });
    },
    [toast, refresh, refreshPublic, queryClient]
  );

  const rejectPlace = useCallback(
    async (pendingId: string) => {
      const res = await fetch(`/api/admin/places/${pendingId}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ action: "reject" }),
      });
      if (!res.ok) throw new Error(await readError(res, "No se pudo rechazar la sugerencia"));
      toast({
        title: "Sugerencia rechazada",
        description: "No se publicará en la app.",
      });
      refresh();
    },
    [toast, refresh]
  );

  const reviewAction = useCallback(
    async (reviewId: string, placeId: string, action: "approve" | "reject") => {
      const res = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(await readError(res, "No se pudo actualizar la reseña"));
      toast(
        action === "approve"
          ? { title: "Reseña publicada", description: "Ya es visible en el lugar." }
          : { title: "Reseña rechazada", description: "No se publicará." }
      );
      refresh();
      if (action === "approve") {
        refreshPublic();
        void queryClient.invalidateQueries({ queryKey: ["place-detail", placeId] });
      }
    },
    [toast, refresh, refreshPublic, queryClient]
  );

  /** Acciones sobre reseñas reportadas (política UGC de Google Play). */
  const flagAction = useCallback(
    async (reviewId: string, placeId: string, action: "dismiss-flag" | "reject") => {
      const res = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(await readError(res, "No se pudo actualizar la reseña"));
      toast(
        action === "dismiss-flag"
          ? {
              title: "Reporte descartado",
              description: "La reseña vuelve a ser visible si estaba publicada.",
            }
          : {
              title: "Reseña rechazada",
              description: "No se volverá a mostrar en la app.",
            }
      );
      refresh();
      refreshPublic();
      void queryClient.invalidateQueries({ queryKey: ["place-detail", placeId] });
    },
    [toast, refresh, refreshPublic, queryClient]
  );

  const featurePlace = useCallback(
    async (row: AdminPlaceRow) => {
      const action = row.featured ? "unfeature" : "feature";
      const res = await fetch(`/api/admin/places/${row.id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(await readError(res, "No se pudo actualizar el destaque"));
      toast({
        title: action === "feature" ? "Lugar destacado" : "Destaque quitado",
        description: row.name,
      });
      refresh();
      refreshPublic();
    },
    [toast, refresh, refreshPublic]
  );

  const deletePlace = useCallback(
    async (row: AdminPlaceRow) => {
      const res = await fetch(`/api/admin/places/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res, "No se pudo eliminar el lugar"));
      toast({ title: "Lugar eliminado", description: `${row.name} se borró definitivamente.` });
      refresh();
      refreshPublic();
    },
    [toast, refresh, refreshPublic]
  );

  const pendingTotal =
    (overviewQuery.data?.stats.pendingPlaces ?? 0) +
    (overviewQuery.data?.stats.pendingReviews ?? 0) +
    (overviewQuery.data?.stats.flaggedReviews ?? 0);

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 pb-24 pt-5">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-stone-800">Equipo RutaViva</h1>
          <p className="text-sm text-stone-500">
            Previo estudio se da la validación: nada se publica sin revisión.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void logout()}
          className="h-11 shrink-0 gap-1.5 border-stone-300 text-stone-600 hover:bg-stone-50"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Salir
        </Button>
      </header>

      {overviewQuery.isPending ? (
        <div className="space-y-4" aria-busy>
          <div className="grid grid-cols-3 gap-2">
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : overviewQuery.isError || !overviewQuery.data ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="text-sm font-medium text-amber-800">
            No pudimos cargar la información del panel.
          </p>
          <Button
            variant="outline"
            onClick={() => void overviewQuery.refetch()}
            className="mt-3 h-11 border-amber-300"
          >
            Reintentar
          </Button>
        </div>
      ) : (
        <>
          <section
            aria-label="Resumen del panel"
            className="grid grid-cols-3 gap-2"
          >
            <StatCard
              value={overviewQuery.data.stats.placesPublished}
              label="Publicados"
              alert={false}
            />
            <StatCard
              value={overviewQuery.data.stats.pendingPlaces}
              label="Sugerencias por revisar"
              alert={overviewQuery.data.stats.pendingPlaces > 0}
            />
            <StatCard
              value={overviewQuery.data.stats.pendingReviews}
              label="Reseñas por validar"
              alert={overviewQuery.data.stats.pendingReviews > 0}
            />
          </section>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-2xl bg-stone-100 p-1">
              <TabsTrigger
                value="review"
                className="min-h-[40px] gap-1 rounded-xl text-xs font-bold data-[state=active]:bg-white"
              >
                Por revisar
                {pendingTotal > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-amber-950">
                    {pendingTotal}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="places"
                className="min-h-[40px] rounded-xl text-xs font-bold data-[state=active]:bg-white"
              >
                Lugares
              </TabsTrigger>
              <TabsTrigger
                value="new"
                className="min-h-[40px] rounded-xl text-xs font-bold data-[state=active]:bg-white"
              >
                Nuevo lugar
              </TabsTrigger>
            </TabsList>

            <TabsContent value="review" className="mt-4">
              <ReviewQueue
                pendingPlaces={overviewQuery.data.pendingPlaces}
                pendingReviews={overviewQuery.data.pendingReviews}
                flaggedReviews={overviewQuery.data.flaggedReviews}
                origin={origin}
                onPublishValidated={publishValidated}
                onRejectPlace={rejectPlace}
                onReviewAction={reviewAction}
                onFlagAction={flagAction}
              />
            </TabsContent>

            <TabsContent value="places" className="mt-4">
              <PlacesSection
                places={overviewQuery.data.allPlaces}
                onEditSave={editPlace}
                onFeature={featurePlace}
                onDelete={deletePlace}
              />
            </TabsContent>

            <TabsContent value="new" className="mt-4">
              <NewPlaceSection origin={origin} onCreated={refresh} onPublished={refreshPublic} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function StatCard({ value, label, alert }: { value: number; label: string; alert: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-white p-3 text-center shadow-sm",
        alert && "border-amber-300 bg-amber-50"
      )}
    >
      <p className={cn("text-2xl font-black", alert ? "text-amber-600" : "text-emerald-700")}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] font-semibold leading-tight text-stone-500">{label}</p>
    </div>
  );
}

/* ==================== Cola "Por revisar" ==================== */

function ReviewQueue(props: {
  pendingPlaces: AdminPendingPlace[];
  pendingReviews: AdminPendingReview[];
  flaggedReviews: AdminFlaggedReview[];
  origin: Coordinates | null;
  onPublishValidated: (pendingId: string, values: PlaceFormValues) => Promise<void>;
  onRejectPlace: (pendingId: string) => Promise<void>;
  onReviewAction: (reviewId: string, placeId: string, action: "approve" | "reject") => Promise<void>;
  onFlagAction: (
    reviewId: string,
    placeId: string,
    action: "dismiss-flag" | "reject"
  ) => Promise<void>;
}) {
  const [validating, setValidating] = useState<AdminPendingPlace | null>(null);
  const [rejecting, setRejecting] = useState<AdminPendingPlace | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null);
  const { toast } = useToast();

  const handleReject = async () => {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    try {
      await props.onRejectPlace(rejecting.id);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "No se pudo rechazar",
        description: err instanceof Error ? err.message : "Error inesperado",
      });
    } finally {
      setBusyId(null);
      setRejecting(null);
    }
  };

  const handleReviewAction = async (r: AdminPendingReview, action: "approve" | "reject") => {
    setBusyId(r.id);
    try {
      await props.onReviewAction(r.id, r.placeId, action);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "No se pudo actualizar la reseña",
        description: err instanceof Error ? err.message : "Error inesperado",
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleFlagAction = async (
    r: AdminFlaggedReview,
    action: "dismiss-flag" | "reject"
  ) => {
    setBusyId(r.id);
    try {
      await props.onFlagAction(r.id, r.placeId, action);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "No se pudo actualizar la reseña",
        description: err instanceof Error ? err.message : "Error inesperado",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* ---- Reseñas reportadas por usuarios (política UGC) ---- */}
      {props.flaggedReviews.length > 0 && (
        <section aria-label="Reseñas reportadas" className="space-y-3">
          <h2 className="flex items-center gap-1.5 text-sm font-black uppercase tracking-wide text-stone-500">
            <Flag className="h-4 w-4 text-red-500" aria-hidden />
            Reseñas reportadas ({props.flaggedReviews.length})
          </h2>
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-800">
            Estas reseñas fueron reportadas por usuarios y se ocultan al público hasta que las
            revises: descarta el reporte si el contenido es válido o rechaza la reseña.
          </p>
          <ul className="space-y-3">
            {props.flaggedReviews.map((r) => (
              <li key={r.id}>
                <article className="rounded-2xl border border-red-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                    Sobre {r.placeName}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-1">
                    <p className="text-sm font-bold text-stone-800">{r.authorName}</p>
                    <span className="text-xs text-stone-400">
                      Reportada {r.flaggedAt ? relativeDate(r.flaggedAt) : "recientemente"}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2">
                    <Stars value={r.rating} />
                    <StatusBadge status={r.status} />
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{r.comment}</p>
                  {r.reason && (
                    <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-800">
                      <Flag className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span>
                        <strong className="font-semibold">Motivo del reporte:</strong> {r.reason}
                      </span>
                    </p>
                  )}
                  {r.photos.length > 0 && (
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {r.photos.map((ph) => (
                        <button
                          key={ph.id}
                          type="button"
                          onClick={() =>
                            setLightbox({ url: ph.url, alt: `Foto de ${r.authorName}` })
                          }
                          className="aspect-square overflow-hidden rounded-lg border border-stone-200 transition hover:opacity-90"
                          aria-label={`Ver foto de ${r.authorName}`}
                        >
                          <img
                            src={ph.url}
                            alt={`Foto de ${r.authorName}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button
                      onClick={() => void handleFlagAction(r, "dismiss-flag")}
                      disabled={busyId === r.id}
                      className="h-11 flex-1 gap-1.5 border border-emerald-300 bg-white font-semibold text-emerald-800 hover:bg-emerald-50"
                    >
                      {busyId === r.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <FlagOff className="h-4 w-4" aria-hidden />
                      )}
                      Descartar reporte
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void handleFlagAction(r, "reject")}
                      disabled={busyId === r.id}
                      className="h-11 flex-1 gap-1.5 border-red-200 font-semibold text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" aria-hidden />
                      Rechazar reseña
                    </Button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- Sugerencias de lugares ---- */}
      <section aria-label="Sugerencias de lugares" className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-stone-500">
          Sugerencias de lugares
        </h2>
        {props.pendingPlaces.length === 0 ? (
          <EmptyQueue text="No hay sugerencias por revisar. ¡Todo al día!" />
        ) : (
          <ul className="space-y-3">
            {props.pendingPlaces.map((p) => (
              <li key={p.id}>
                <article className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                  {p.photos.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setLightbox({ url: p.photos[0].url, alt: `Foto de ${p.name}` })
                      }
                      className="block w-full"
                      aria-label={`Ver foto enviada de ${p.name}`}
                    >
                      <img
                        src={p.photos[0].url}
                        alt={`Foto enviada de ${p.name}`}
                        className="h-40 w-full rounded-xl object-cover"
                        loading="lazy"
                      />
                    </button>
                  )}
                  <h3 className="mt-1 text-base font-bold leading-snug text-stone-800">
                    {p.name}
                  </h3>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <Badge className="border-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                      {categoryLabel(p.category)}
                    </Badge>
                    <span className="text-xs text-stone-400">
                      Sugerido por {p.suggestedBy || "un viajero"} · {relativeDate(p.createdAt)}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-stone-600">
                    {p.description}
                  </p>
                  {p.address && (
                    <p className="mt-2 flex items-start gap-1.5 text-xs text-stone-500">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stone-400" aria-hidden />
                      {p.address}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-stone-400">
                    {p.lat.toFixed(5)}, {p.lng.toFixed(5)}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      onClick={() => setValidating(p)}
                      className="h-11 flex-1 gap-1.5 bg-emerald-700 font-bold hover:bg-emerald-800"
                    >
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                      Revisar y publicar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setRejecting(p)}
                      disabled={busyId === p.id}
                      className="h-11 gap-1.5 border-red-200 font-semibold text-red-700 hover:bg-red-50"
                    >
                      {busyId === p.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <X className="h-4 w-4" aria-hidden />
                      )}
                      Rechazar
                    </Button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Reseñas por validar ---- */}
      <section aria-label="Reseñas por validar" className="space-y-3">
        <h2 className="text-sm font-black uppercase tracking-wide text-stone-500">
          Reseñas por validar
        </h2>
        {props.pendingReviews.length === 0 ? (
          <EmptyQueue text="No hay reseñas por validar. ¡Todo al día!" />
        ) : (
          <ul className="space-y-3">
            {props.pendingReviews.map((r) => (
              <li key={r.id}>
                <article className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                    Sobre {r.placeName}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-1">
                    <p className="text-sm font-bold text-stone-800">{r.authorName}</p>
                    <span className="text-xs text-stone-400">{relativeDate(r.createdAt)}</span>
                  </div>
                  <Stars value={r.rating} />
                  <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{r.comment}</p>
                  {r.photos.length > 0 && (
                    <div className="mt-2 grid grid-cols-3 gap-1.5">
                      {r.photos.map((ph) => (
                        <button
                          key={ph.id}
                          type="button"
                          onClick={() =>
                            setLightbox({ url: ph.url, alt: `Foto de ${r.authorName}` })
                          }
                          className="aspect-square overflow-hidden rounded-lg border border-stone-200 transition hover:opacity-90"
                          aria-label={`Ver foto de ${r.authorName}`}
                        >
                          <img
                            src={ph.url}
                            alt={`Foto de ${r.authorName}`}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    <Button
                      onClick={() => void handleReviewAction(r, "approve")}
                      disabled={busyId === r.id}
                      className="h-11 flex-1 gap-1.5 bg-emerald-700 font-bold hover:bg-emerald-800"
                    >
                      {busyId === r.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <Check className="h-4 w-4" aria-hidden />
                      )}
                      Aprobar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void handleReviewAction(r, "reject")}
                      disabled={busyId === r.id}
                      className="h-11 flex-1 gap-1.5 border-red-200 font-semibold text-red-700 hover:bg-red-50"
                    >
                      <X className="h-4 w-4" aria-hidden />
                      Rechazar
                    </Button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- Diálogo de validación ---- */}
      <Dialog
        open={validating !== null}
        onOpenChange={(o) => {
          if (!o) setValidating(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-2xl">
          {validating && (
            <PlaceFormDialogBody
              key={validating.id}
              idPrefix="rv-validate"
              title="Validar y publicar"
              description="Ajusta los campos si hace falta. Al aprobar, el lugar se publica en el mapa."
              initial={{
                name: validating.name,
                description: validating.description,
                category: SINGULAR_CATEGORIES.some((c) => c.id === validating.category)
                  ? validating.category
                  : "otro",
                lat: String(validating.lat),
                lng: String(validating.lng),
                address: validating.address ?? "",
                tips: validating.tips ?? "",
                city: validating.city || "Manzanillo",
                state: validating.state || "Colima",
                photos: validating.photos.length > 0 ? [validating.photos[0].url] : [],
              }}
              origin={props.origin}
              requireChecks
              saveLabel="Aprobar y publicar"
              onSave={(values) => props.onPublishValidated(validating.id, values)}
              onClose={() => setValidating(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ---- Confirmación de rechazo ---- */}
      <AlertDialog
        open={rejecting !== null}
        onOpenChange={(o) => {
          if (!o) setRejecting(null);
        }}
      >
        <AlertDialogContent className="max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rechazar esta sugerencia?</AlertDialogTitle>
            <AlertDialogDescription>
              “{rejecting?.name}” no se publicará en la app. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleReject();
              }}
              className="h-11 rounded-xl bg-red-700 font-bold text-white hover:bg-red-800"
            >
              Sí, rechazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PhotoLightbox
        url={lightbox?.url ?? null}
        alt={lightbox?.alt ?? "Foto enviada"}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}

function EmptyQueue({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-center">
      <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-600" aria-hidden />
      <p className="mt-1.5 text-sm font-medium text-stone-600">{text}</p>
    </div>
  );
}

/* ==================== Cuerpo compartido de diálogo de lugar ==================== */

function PlaceFormDialogBody(props: {
  idPrefix: string;
  title: string;
  description: string;
  initial: PlaceFormValues;
  origin: Coordinates | null;
  requireChecks: boolean;
  saveLabel: string;
  onSave: (values: PlaceFormValues) => Promise<void>;
  onClose: () => void;
}) {
  const [values, setValues] = useState<PlaceFormValues>(props.initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checks = placeChecks(values);
  const complete = checksComplete(checks);

  const patch = (p: Partial<PlaceFormValues>) => setValues((v) => ({ ...v, ...p }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (values.name.trim().length < 3)
      return setError("El nombre debe tener al menos 3 caracteres.");
    if (values.description.trim().length < 10)
      return setError("La descripción debe tener al menos 10 caracteres.");
    const { lat, lng } = parseCoords(values);
    if (!Number.isFinite(lat) || !Number.isFinite(lng))
      return setError("Captura una latitud y longitud válidas.");

    setSaving(true);
    try {
      await props.onSave(values);
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <DialogHeader className="text-left">
        <DialogTitle className="text-lg font-black text-stone-800">{props.title}</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-stone-500">
          {props.description}
        </DialogDescription>
      </DialogHeader>

      <PlaceFieldsForm
        idPrefix={props.idPrefix}
        values={values}
        onPatch={patch}
        origin={props.origin}
        showChecklist={props.requireChecks}
      />

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <DialogFooter className="flex-col gap-2">
        {props.requireChecks && !complete && (
          <p className="w-full text-center text-xs font-medium text-amber-700">
            Completa los formatos para publicar
          </p>
        )}
        <div className="flex w-full gap-2">
          <Button
            type="submit"
            disabled={saving || (props.requireChecks && !complete)}
            className="h-11 flex-1 gap-2 rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Guardando…
              </>
            ) : (
              props.saveLabel
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={props.onClose}
            disabled={saving}
            className="h-11 rounded-xl border-stone-300"
          >
            Cancelar
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}

/* ==================== Catálogo de lugares ==================== */

function PlacesSection(props: {
  places: AdminPlaceRow[];
  onEditSave: (row: AdminPlaceRow, values: PlaceFormValues) => Promise<void>;
  onFeature: (row: AdminPlaceRow) => Promise<void>;
  onDelete: (row: AdminPlaceRow) => Promise<void>;
}) {
  const [editing, setEditing] = useState<AdminPlaceRow | null>(null);
  const [deleting, setDeleting] = useState<AdminPlaceRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const { toast } = useToast();

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    try {
      await fn();
    } catch (err) {
      toast({
        variant: "destructive",
        title: "No se pudo completar la acción",
        description: err instanceof Error ? err.message : "Error inesperado",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-black uppercase tracking-wide text-stone-500">
        Catálogo ({props.places.length})
      </h2>
      {props.places.length === 0 ? (
        <EmptyQueue text="Aún no hay lugares en el catálogo." />
      ) : (
        <ul className="space-y-2">
          {props.places.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm"
            >
              {p.imageUrl ? (
                <img
                  src={p.imageUrl}
                  alt={`Portada de ${p.name}`}
                  className="h-12 w-12 shrink-0 rounded-xl object-cover"
                  loading="lazy"
                />
              ) : (
                <span
                  aria-hidden
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"
                >
                  <MapPin className="h-5 w-5" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="truncate text-sm font-bold text-stone-800">{p.name}</h3>
                  {p.featured && (
                    <Star
                      className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400"
                      aria-label="Destacado"
                    />
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={p.status} />
                  {p.ratingCount > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-xs text-stone-500">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
                      {(p.ratingAvg ?? 0).toFixed(1)} ({p.ratingCount})
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-[11px] text-stone-400">
                    {p.source === "USER" ? (
                      <>
                        <User className="h-3 w-3" aria-hidden /> Usuario
                      </>
                    ) : (
                      <>
                        <Building2 className="h-3 w-3" aria-hidden /> Equipo
                      </>
                    )}
                  </span>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 shrink-0 text-stone-500"
                    aria-label={`Acciones para ${p.name}`}
                  >
                    {busyId === p.id ? (
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
                    ) : (
                      <MoreVertical className="h-5 w-5" aria-hidden />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => void withBusy(p.id, () => props.onFeature(p))}>
                    <Star className="h-4 w-4" aria-hidden />
                    {p.featured ? "Quitar destaque" : "Destacar"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setEditing(p)}>
                    <Pencil className="h-4 w-4" aria-hidden />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setDeleting(p)}
                    className="text-red-600 focus:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      {/* ---- Edición ---- */}
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[85dvh] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-2xl">
          {editing && (
            <PlaceFormDialogBody
              key={editing.id}
              idPrefix="rv-edit"
              title={`Editar: ${editing.name}`}
              description="Los cambios se validan con los mismos formatos de publicación."
              initial={{
                name: editing.name,
                description: editing.description,
                category: SINGULAR_CATEGORIES.some((c) => c.id === editing.category)
                  ? editing.category
                  : "otro",
                lat: String(editing.lat),
                lng: String(editing.lng),
                address: editing.address ?? "",
                tips: editing.tips ?? "",
                city: editing.city || "Manzanillo",
                state: editing.state || "Colima",
                photos: editing.imageUrl ? [editing.imageUrl] : [],
              }}
              origin={null}
              requireChecks={false}
              saveLabel="Guardar cambios"
              onSave={(values) => props.onEditSave(editing, values)}
              onClose={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ---- Eliminación ---- */}
      <AlertDialog
        open={deleting !== null}
        onOpenChange={(o) => {
          if (!o) setDeleting(null);
        }}
      >
        <AlertDialogContent className="max-w-md rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borran también sus reseñas y fotos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleting) void withBusy(deleting.id, () => props.onDelete(deleting));
                setDeleting(null);
              }}
              className="h-11 rounded-xl bg-red-700 font-bold text-white hover:bg-red-800"
            >
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "APPROVED") {
    return (
      <Badge className="border-0 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
        Publicado
      </Badge>
    );
  }
  if (status === "PENDING") {
    return (
      <Badge className="border-0 bg-amber-100 text-amber-800 hover:bg-amber-100">
        Pendiente
      </Badge>
    );
  }
  return (
    <Badge className="border-0 bg-stone-200 text-stone-600 hover:bg-stone-200">Rechazado</Badge>
  );
}

/* ==================== Nuevo lugar ==================== */

function NewPlaceSection(props: {
  origin: Coordinates | null;
  onCreated: () => void;
  onPublished: () => void;
}) {
  const { toast } = useToast();
  const [values, setValues] = useState<PlaceFormValues>(emptyPlaceValues());
  const [featured, setFeatured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (p: Partial<PlaceFormValues>) => setValues((v) => ({ ...v, ...p }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (values.name.trim().length < 3)
      return setError("El nombre debe tener al menos 3 caracteres.");
    if (values.description.trim().length < 10)
      return setError("La descripción debe tener al menos 10 caracteres.");
    const { lat, lng } = parseCoords(values);
    if (!Number.isFinite(lat) || !Number.isFinite(lng))
      return setError("Captura una latitud y longitud válidas (o usa tu ubicación).");

    setSaving(true);
    try {
      const res = await fetch("/api/admin/places", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          name: values.name.trim(),
          description: values.description.trim(),
          category: values.category,
          lat,
          lng,
          address: values.address.trim() || null,
          imageUrl: values.photos[0] ?? null,
          tips: values.tips.trim() || null,
          city: values.city.trim() || "Manzanillo",
          state: values.state.trim() || "Colima",
          featured,
        }),
      });
      if (!res.ok) throw new Error(await readError(res, "No se pudo publicar el lugar"));
      toast({
        title: "Lugar publicado en el mapa",
        description: `${values.name.trim()} ya está disponible para todos.`,
      });
      setValues(emptyPlaceValues());
      setFeatured(false);
      props.onCreated();
      props.onPublished();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-sm font-black uppercase tracking-wide text-stone-500">
        Alta directa del equipo
      </h2>
      <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs leading-relaxed text-emerald-900">
        Los lugares que publicas aquí nacen aprobados y visibles de inmediato.
      </p>

      <PlaceFieldsForm
        idPrefix="rv-new"
        values={values}
        onPatch={patch}
        origin={props.origin}
        showCityState
      />

      <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white px-3 py-2.5">
        <Label htmlFor="rv-new-featured" className="flex items-center gap-2 text-sm">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
          Destacar lugar
        </Label>
        <Switch
          id="rv-new-featured"
          checked={featured}
          onCheckedChange={setFeatured}
          aria-label="Destacar lugar"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={saving}
        className="h-11 w-full gap-2 rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Publicando…
          </>
        ) : (
          "Publicar lugar"
        )}
      </Button>
    </form>
  );
}

/* ==================== Estrellas compartidas ==================== */

function Stars({ value, size = "h-3.5 w-3.5" }: { value: number; size?: string }) {
  return (
    <span className="mt-0.5 flex items-center gap-0.5" role="img" aria-label={`${value} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          aria-hidden
          className={cn(
            size,
            i <= value ? "fill-amber-400 text-amber-400" : "text-stone-300"
          )}
        />
      ))}
    </span>
  );
}
