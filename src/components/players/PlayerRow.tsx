"use client";

import { useState } from "react";
import { LevelPicker } from "@/components/ui/LevelPicker";
import { PositionPicker } from "@/components/ui/PositionPicker";
import type { Player, Position } from "@/lib/types";

interface PlayerRowProps {
  player: Player;
  onChange: (patch: Partial<Omit<Player, "id">>) => void;
  onRemove: () => void;
}

export function PlayerRow({ player, onChange, onRemove }: PlayerRowProps) {
  const [name, setName] = useState(player.name);

  // El input es un borrador local, pero si el nombre cambia desde afuera (se
  // editó el mismo jugador en la cancha) hay que seguirlo. Ajustar el estado
  // durante el render es el patrón recomendado para esto: React descarta el
  // render a medias y vuelve a arrancar con el valor nuevo, sin pasada extra.
  const [lastSeenName, setLastSeenName] = useState(player.name);
  if (player.name !== lastSeenName) {
    setLastSeenName(player.name);
    setName(player.name);
  }

  const commitName = () => {
    const clean = name.trim();
    if (!clean) {
      setName(player.name);
      return;
    }
    if (clean !== player.name) onChange({ name: clean });
  };

  return (
    <li className="card flex flex-col gap-2 p-2.5">
      <div className="flex items-center gap-2">
        <input
          className="field min-w-0 flex-1 px-2.5 py-1.5 text-sm font-semibold"
          value={name}
          aria-label={`Nombre de ${player.name}`}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") setName(player.name);
          }}
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Eliminar a ${player.name}`}
          className="shrink-0 rounded-lg px-2 py-1.5 text-grass-100/40 transition hover:bg-rose-500/15 hover:text-rose-300"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <PositionPicker
          value={player.position}
          onChange={(position: Position) => onChange({ position })}
        />
        <LevelPicker
          value={player.level}
          size="sm"
          label={`Nivel de ${player.name}`}
          onChange={(level) => onChange({ level })}
        />
      </div>
    </li>
  );
}
