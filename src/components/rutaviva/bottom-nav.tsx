"use client";

import { Map, Plus, ShieldCheck, SquareStack } from "lucide-react";
import { cn } from "@/lib/utils";

export type AppView = "map" | "list" | "add" | "admin";

type BottomNavProps = {
  view: AppView;
  onChange: (view: AppView) => void;
};

type NavItem = { id: AppView; label: string; icon: typeof Map; ariaLabel?: string };

const items: NavItem[] = [
  { id: "map", label: "Explorar", icon: Map },
  { id: "list", label: "Lugares", icon: SquareStack },
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
      {/* La columna central es más ancha para la leyenda del botón ámbar */}
      <ul className="mx-auto grid h-16 max-w-md grid-cols-[1fr_1fr_1.5fr_1fr] items-center gap-0.5 px-2">
        {items.slice(0, 2).map(({ id, label, icon: Icon }) => (
          <li key={id} className="flex justify-center">
            <NavButton active={view === id} label={label} onClick={() => onChange(id)}>
              <Icon className="h-[22px] w-[22px]" aria-hidden />
            </NavButton>
          </li>
        ))}
        {/* Botón central destacado: integrado en la barra — no flota ni tapa
            las tarjetas de lugares singulares del mapa */}
        <li className="flex justify-center">
          <button
            type="button"
            onClick={() => onChange("add")}
            aria-label="Sugiere un lugar singular"
            aria-current={view === "add" ? "page" : undefined}
            className={cn(
              "flex h-11 w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 px-1 text-emerald-950 shadow-md shadow-amber-500/30 transition-transform hover:scale-[1.03] active:scale-95",
              view === "add" && "from-amber-500 to-amber-600"
            )}
          >
            <Plus
              className={cn(
                "h-5 w-5 shrink-0 transition-transform",
                view === "add" && "rotate-45"
              )}
              strokeWidth={2.6}
              aria-hidden
            />
            <span className="text-center text-[10px] font-extrabold leading-[1.15] tracking-tight">
              Sugiere un
              <br />
              lugar singular
            </span>
          </button>
        </li>
        {items.slice(2).map(({ id, label, icon: Icon, ariaLabel }) => (
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
