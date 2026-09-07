"use client";

import { useDroppable } from "@dnd-kit/core";
import { useState } from "react";
import { PlayerChip } from "@/components/teams/PlayerChip";
import { positionCount, teamAverage, teamTotal, type LevelOf } from "@/lib/balance";
import { sortByLine } from "@/lib/players";
import { POSITIONS, type Player } from "@/lib/types";

interface TeamColumnProps {
  id: string;
  name: string;
  primaryColor?: string;
  players: Player[];
  /** Cupo del formato elegido, para avisar si falta o sobra gente. */
  capacity?: number | null;
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string) => void;
  onDropSelected: () => void;
  onRename?: (name: string) => void;
  tone?: "team" | "bench";
  /** Nivel a mostrar: el aprendido del historial. */
  levelOf?: LevelOf;
}

export function TeamColumn({
  id,
  name,
  primaryColor,
  players,
  capacity,
  selectedPlayerId,
  onSelectPlayer,
  onDropSelected,
  onRename,
  tone = "team",
  levelOf,
}: TeamColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `container:${id}`,
    data: { type: "container", containerId: id },
  });
  // Borrador local del nombre, sincronizado si cambia desde afuera (regenerar).
  const [draft, setDraft] = useState(name);
  const [lastSeenName, setLastSeenName] = useState(name);
  if (name !== lastSeenName) {
    setLastSeenName(name);
    setDraft(name);
  }

  const counts = positionCount(players);
  const selectedIsHere = players.some((p) => p.id === selectedPlayerId);
  const awaitingDrop = selectedPlayerId !== null && !selectedIsHere;

  return (
    <section
      ref={setNodeRef}
      className={[
        "card flex flex-col gap-2 p-3 transition",
        isOver ? "ring-2 ring-grass-400" : "",
        awaitingDrop ? "ring-1 ring-grass-500/40" : "",
      ].join(" ")}
    >
      <header className="flex items-center gap-2">
        {tone === "team" ? (
          <>
            <span
              aria-hidden
              className="size-4 shrink-0 rounded-full border border-white/25"
              style={{ backgroundColor: primaryColor }}
            />
            {/* Se ve como un campo editable a propósito: antes parecía texto
                plano y nadie descubría que se le podía cambiar el nombre. */}
            <div className="group relative min-w-0 flex-1">
              <input
                className="w-full rounded-lg border border-white/10 bg-white/5 py-1 pr-7 pl-2 text-sm font-black tracking-wide uppercase text-grass-50 transition hover:border-grass-400/50 focus:border-grass-400 focus:bg-white/10 focus:outline-none"
                value={draft}
                maxLength={30}
                aria-label="Nombre del equipo"
                placeholder="Nombre"
                onChange={(e) => setDraft(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={() => {
                  const clean = draft.trim();
                  if (clean && clean !== name) onRename?.(clean);
                  else setDraft(name);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setDraft(name);
                }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[11px] text-grass-100/30 transition group-focus-within:opacity-0"
              >
                ✏️
              </span>
            </div>
          </>
        ) : (
          <h3 className="flex-1 text-sm font-black tracking-wide uppercase text-grass-100/70">
            🪑 {name}
          </h3>
        )}
        <span className="shrink-0 text-xs font-bold text-grass-100/50">
          {players.length}
          {capacity != null && capacity !== players.length ? `/${capacity}` : ""}
        </span>
      </header>

      {tone === "team" && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-grass-100/50">
          <span>
            Nivel{" "}
            <strong className="text-grass-200">
              {teamTotal(players, levelOf).toFixed(1)}
            </strong>{" "}
            · prom{" "}
            <strong className="text-grass-200">
              {teamAverage(players, levelOf).toFixed(1)}
            </strong>
          </span>
          <span className="flex gap-1.5">
            {POSITIONS.filter((p) => counts[p] > 0).map((p) => (
              <span key={p}>
                {p}
                <span className="text-grass-100/70">{counts[p]}</span>
              </span>
            ))}
          </span>
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        {players.length === 0 && (
          <li className="rounded-xl border border-dashed border-white/10 px-2 py-4 text-center text-[11px] text-grass-100/30">
            Vacío
          </li>
        )}
        {sortByLine(players).map((player) => (
          <PlayerChip
            key={player.id}
            player={player}
            containerId={id}
            selected={player.id === selectedPlayerId}
            onSelect={() => onSelectPlayer(player.id)}
          />
        ))}
      </ul>

      {awaitingDrop && (
        <button
          type="button"
          onClick={onDropSelected}
          className="rounded-xl border border-grass-400/50 bg-grass-500/15 px-2 py-2 text-xs font-bold text-grass-200 transition hover:bg-grass-500/30"
        >
          Mover acá ↓
        </button>
      )}
    </section>
  );
}
