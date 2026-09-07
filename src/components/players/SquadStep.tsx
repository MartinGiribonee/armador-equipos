"use client";

import { useMemo, useState } from "react";
import { BulkAdd } from "@/components/players/BulkAdd";
import { PlayerRow } from "@/components/players/PlayerRow";
import { POSITION_STYLE } from "@/components/ui/PositionPicker";
import type { Armador } from "@/hooks/useArmador";
import { sortByLine } from "@/lib/players";
import { POSITION_LABEL, POSITIONS, type Position } from "@/lib/types";

type SortMode = "orden" | "linea" | "nivel";

const SORTS: Array<{ id: SortMode; label: string }> = [
  { id: "orden", label: "Como los cargué" },
  { id: "linea", label: "Por puesto" },
  { id: "nivel", label: "Por nivel" },
];

export function SquadStep({ armador }: { armador: Armador }) {
  const { squad, positionTally, addNames, updatePlayer, removePlayer, clearSquad } =
    armador;
  const [sort, setSort] = useState<SortMode>("orden");
  const [confirmClear, setConfirmClear] = useState(false);

  const sorted = useMemo(() => {
    if (sort === "linea") return sortByLine(squad);
    if (sort === "nivel") return squad.slice().sort((a, b) => b.level - a.level);
    return squad;
  }, [squad, sort]);

  const average =
    squad.length === 0
      ? 0
      : squad.reduce((sum, p) => sum + p.level, 0) / squad.length;

  return (
    <div className="flex flex-col gap-4">
      <BulkAdd onAdd={addNames} />

      {squad.length === 0 ? (
        <div className="card flex flex-col items-center gap-2 p-8 text-center">
          <span className="text-4xl" aria-hidden>
            ⚽
          </span>
          <p className="text-sm font-semibold text-grass-100">
            Todavía no hay nadie en el plantel
          </p>
          <p className="max-w-xs text-xs text-grass-100/50">
            Pegá la lista del grupo acá arriba. Después le ponés nivel y puesto a cada
            uno — arrancan todos en nivel 3 y de mediocampistas.
          </p>
        </div>
      ) : (
        <>
          <div className="card flex flex-wrap items-center justify-between gap-3 p-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-grass-300">{squad.length}</span>
              <span className="text-xs text-grass-100/60">
                jugador{squad.length === 1 ? "" : "es"} · nivel promedio{" "}
                <strong className="text-grass-200">{average.toFixed(1)}</strong>
              </span>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {POSITIONS.map((position: Position) => (
                <li
                  key={position}
                  title={POSITION_LABEL[position]}
                  className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1 text-[11px] font-semibold"
                >
                  <span
                    aria-hidden
                    className={`size-2 rounded-full ${POSITION_STYLE[position].dot}`}
                  />
                  {position}
                  <span className="text-grass-100/50">{positionTally[position]}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 rounded-lg bg-white/5 p-0.5 text-[11px]">
              {SORTS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setSort(option.id)}
                  className={[
                    "rounded-md px-2.5 py-1 font-semibold transition",
                    sort === option.id
                      ? "bg-grass-500 text-grass-950"
                      : "text-grass-100/50 hover:text-grass-100",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {confirmClear ? (
              <span className="flex items-center gap-2 text-xs">
                <span className="text-grass-100/60">¿Borrar todo el plantel?</span>
                <button
                  type="button"
                  onClick={() => {
                    clearSquad();
                    setConfirmClear(false);
                  }}
                  className="rounded-lg bg-rose-500 px-2.5 py-1 font-bold text-white"
                >
                  Sí, borrar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="rounded-lg px-2 py-1 text-grass-100/60"
                >
                  No
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="rounded-lg px-2.5 py-1 text-xs text-grass-100/40 transition hover:text-rose-300"
              >
                Vaciar plantel
              </button>
            )}
          </div>

          <ul className="flex flex-col gap-2">
            {sorted.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                onChange={(patch) => updatePlayer(player.id, patch)}
                onRemove={() => removePlayer(player.id)}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
