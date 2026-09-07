"use client";

import { useState } from "react";
import { KITS } from "@/lib/kits";
import type { Team } from "@/lib/types";

interface KitPickerProps {
  team: Team;
  onChange: (patch: Pick<Team, "primaryColor" | "secondaryColor">) => void;
}

export function KitPicker({ team, onChange }: KitPickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-grass-100 transition hover:bg-white/10"
      >
        <span className="flex">
          <span
            aria-hidden
            className="size-4 rounded-l-full border border-white/25"
            style={{ backgroundColor: team.primaryColor }}
          />
          <span
            aria-hidden
            className="size-4 rounded-r-full border border-l-0 border-white/25"
            style={{ backgroundColor: team.secondaryColor }}
          />
        </span>
        Camiseta
      </button>

      {open && (
        <div className="card absolute right-0 z-20 mt-2 w-64 p-3">
          <p className="mb-2 text-[11px] font-semibold text-grass-100/60">
            Juegos de camiseta
          </p>
          <div className="grid grid-cols-5 gap-2">
            {KITS.map((kit) => {
              const active =
                kit.primaryColor === team.primaryColor &&
                kit.secondaryColor === team.secondaryColor;
              return (
                <button
                  key={kit.id}
                  type="button"
                  title={kit.name}
                  onClick={() => {
                    onChange({
                      primaryColor: kit.primaryColor,
                      secondaryColor: kit.secondaryColor,
                    });
                    setOpen(false);
                  }}
                  className={`flex h-8 overflow-hidden rounded-lg border transition ${
                    active
                      ? "border-grass-300 ring-2 ring-grass-400"
                      : "border-white/15 hover:border-white/40"
                  }`}
                >
                  <span
                    aria-hidden
                    className="h-full flex-1"
                    style={{ backgroundColor: kit.primaryColor }}
                  />
                  <span
                    aria-hidden
                    className="h-full w-2"
                    style={{ backgroundColor: kit.secondaryColor }}
                  />
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 text-[11px] text-grass-100/60">
              Principal
              <input
                type="color"
                value={team.primaryColor}
                onChange={(e) =>
                  onChange({
                    primaryColor: e.target.value,
                    secondaryColor: team.secondaryColor,
                  })
                }
                className="h-7 w-9 cursor-pointer rounded border border-white/15 bg-transparent"
              />
            </label>
            <label className="flex items-center gap-2 text-[11px] text-grass-100/60">
              Detalle
              <input
                type="color"
                value={team.secondaryColor}
                onChange={(e) =>
                  onChange({
                    primaryColor: team.primaryColor,
                    secondaryColor: e.target.value,
                  })
                }
                className="h-7 w-9 cursor-pointer rounded border border-white/15 bg-transparent"
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
