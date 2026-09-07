"use client";

import { useDraggable, useDroppable } from "@dnd-kit/core";
import { POSITION_STYLE } from "@/components/ui/PositionPicker";
import type { Player } from "@/lib/types";

export interface ChipData {
  type: "player";
  playerId: string;
  containerId: string;
}

interface PlayerChipProps {
  player: Player;
  containerId: string;
  /** Seleccionado para mover con dos toques (alternativa al arrastre). */
  selected?: boolean;
  onSelect?: () => void;
  /** `false` en la vista de exportación, donde no hay interacción. */
  interactive?: boolean;
}

export function PlayerChip({
  player,
  containerId,
  selected = false,
  onSelect,
  interactive = true,
}: PlayerChipProps) {
  const data: ChipData = { type: "player", playerId: player.id, containerId };

  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `drag:${player.id}`,
    data,
    disabled: !interactive,
  });
  // El mismo chip también recibe drops: soltar encima intercambia jugadores.
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `chip:${player.id}`,
    data,
    disabled: !interactive,
  });

  return (
    <li
      ref={setDropRef}
      className={[
        "rounded-xl transition",
        isOver && !isDragging
          ? "ring-2 ring-grass-300 ring-offset-1 ring-offset-night-900"
          : "",
      ].join(" ")}
    >
      <button
        type="button"
        ref={setNodeRef}
        {...(interactive ? listeners : {})}
        {...(interactive ? attributes : {})}
        onClick={onSelect}
        className={[
          "flex w-full touch-none items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm transition",
          isDragging ? "opacity-30" : "",
          selected
            ? "bg-grass-500/25 ring-2 ring-grass-400"
            : "bg-white/5 hover:bg-white/10",
          interactive ? "cursor-grab active:cursor-grabbing" : "cursor-default",
        ].join(" ")}
      >
        <span
          aria-hidden
          className={`size-2 shrink-0 rounded-full ${POSITION_STYLE[player.position].dot}`}
        />
        <span className="min-w-0 flex-1 truncate font-semibold text-grass-50">
          {player.name}
        </span>
        <span className="shrink-0 text-[10px] font-bold text-grass-100/40">
          {player.position}
        </span>
        <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-white/10 text-[11px] font-bold text-grass-200">
          {player.level}
        </span>
      </button>
    </li>
  );
}

/** Versión estática usada dentro del overlay de arrastre. */
export function PlayerChipGhost({ player }: { player: Player }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-grass-500 px-2 py-1.5 text-sm shadow-2xl shadow-black/50">
      <span
        aria-hidden
        className={`size-2 rounded-full ${POSITION_STYLE[player.position].dot}`}
      />
      <span className="font-bold text-grass-950">{player.name}</span>
      <span className="text-[11px] font-bold text-grass-950/60">{player.level}</span>
    </div>
  );
}
