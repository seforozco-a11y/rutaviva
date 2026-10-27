"use client";

import { Info, Map, Plus, ShieldCheck, SquareStack } from "lucide-react";
import { cn } from "@/lib/utils";

export type AppView = "map" | "list" | "add" | "about" | "admin";

type BottomNavProps = {
  view: AppView;
  onChange: (view: AppView) => void;
};

type NavItem = { id: AppView; label: string; icon: typeof Map; ariaLabel?: string };

const items: NavItem[] = [
  { id: "map", label: "Explorar", icon: Map },
  { id: "list", label: "Lugares", icon: SquareStack },
  { id: "add", label: "Agregar", icon: Plus },
  { id: "about", label: "Guía", icon: Info },
  {
    id: "admin",
    label: "Admin",
    icon: ShieldCheck,
    ariaLabel: "Abrir panel de administración",
  },
];

/** Barra de navegación inferior estilo app móvil (footer fijo con safe-area). */
export function BottomNav({ view, onChange }: BottomNavProps) {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-[1000] border-t border-emerald-900/10 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(6,78,59,0.08)] backdrop-blur"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center px-2">
        {items.slice(0, 2).map(({ id, label, icon: Icon }) => (
          <li key={id} className="flex justify-center">
            <NavButton active={view === id} label={label} onClick={() => onChange(id)}>
              <Icon className="h-[22px] w-[22px]" aria-hidden />
            </NavButton>
          </li>
        ))}
        {/* Botón central destacado: píldora flotante con leyenda visible */}
        <li className="relative flex justify-center">
          <button
            type="button"
            onClick={() => onChange("add")}
            aria-label="Sugiere un lugar singular"
            aria-current={view === "add" ? "page" : undefined}
            className={cn(
              "absolute bottom-[3.5rem] left-1/2 z-10 flex h-12 -translate-x-1/2 items-center gap-2 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 px-5 text-emerald-950 shadow-lg shadow-amber-500/40 ring-4 ring-white transition-transform hover:scale-[1.03] active:scale-95",
              view === "add" && "from-amber-500 to-amber-600"
            )}
          >
            <Plus
              className={cn(
                "h-6 w-6 transition-transform",
                view === "add" && "rotate-45"
              )}
              strokeWidth={2.6}
              aria-hidden
            />
            <span className="whitespace-nowrap text-[14px] font-extrabold leading-none tracking-tight">
              Sugiere un lugar singular
            </span>
          </button>
        </li>
        {/* El FAB cubre "add"; aquí van solo las vistas restantes (2 + FAB + 2 = 5). */}
        {items.slice(3).map(({ id, label, icon: Icon, ariaLabel }) => (
          <li key={id} className="flex justify-center">
            <NavButton
              active={view === id}
              label={label}
              onClick={() => onChange(id)}
              ariaLabel={ariaLabel}
            >
              <Icon className="h-[22px] w-[22px]" aria-hidden />
            </NavButton>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function NavButton({
  active,
  label,
  onClick,
  ariaLabel,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  ariaLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-[44px] w-full min-w-[64px] flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 text-[11px] font-semibold transition-colors",
        active ? "text-emerald-700" : "text-stone-400 hover:text-emerald-600"
      )}
    >
      {children}
      <span>{label}</span>
      <span
        aria-hidden
        className={cn(
          "h-1 w-1 rounded-full transition-all",
          active ? "bg-emerald-600" : "bg-transparent"
        )}
      />
    </button>
  );
}
