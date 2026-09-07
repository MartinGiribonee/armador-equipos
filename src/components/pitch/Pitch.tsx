"use client";

import { Jersey } from "@/components/pitch/Jersey";
import { assignToSpots, spotsForTeam } from "@/lib/formations";
import { shortName, sortByLine } from "@/lib/players";
import type { Player, Team } from "@/lib/types";

/**
 * Números de camiseta: 1 al arquero y el resto en orden de línea (defensa,
 * medio, ataque), como se numera una alineación de toda la vida.
 */
function shirtNumbers(players: readonly Player[]): Map<string, number> {
  const numbers = new Map<string, number>();
  sortByLine(players).forEach((player, index) => numbers.set(player.id, index + 1));
  return numbers;
}

/**
 * Coordenadas de la formación (0-100, arco propio abajo) → porcentajes CSS,
 * con margen para que las camisetas no queden pisando la línea de fondo.
 */
function toStyle(x: number, y: number) {
  return { left: `${6 + x * 0.88}%`, top: `${93 - y * 0.86}%` };
}

interface PitchProps {
  team: Team;
  onSelectPlayer?: (player: Player) => void;
  selectedPlayerId?: string | null;
  /** En modo exportación se ocultan los estados de hover/foco. */
  interactive?: boolean;
}

export function Pitch({
  team,
  onSelectPlayer,
  selectedPlayerId,
  interactive = true,
}: PitchProps) {
  const spots = spotsForTeam(team.formation, team.players.length);
  const slots = assignToSpots(team.players, spots);
  const numbers = shirtNumbers(team.players);

  return (
    <div className="pitch-turf relative aspect-[68/105] w-full overflow-hidden rounded-2xl">
      <PitchMarkings />

      {slots.map(({ spot, player }) => {
        if (!player) return null;
        const selected = selectedPlayerId === player.id;

        return (
          <button
            key={player.id}
            type="button"
            disabled={!interactive}
            onClick={() => onSelectPlayer?.(player)}
            aria-label={`${player.name} — ${player.position}, nivel ${player.level}`}
            style={toStyle(spot.x, spot.y)}
            className={[
              "absolute flex w-[19%] max-w-[86px] min-w-[44px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5",
              interactive ? "cursor-pointer transition hover:scale-110" : "",
            ].join(" ")}
          >
            <Jersey
              primary={team.primaryColor}
              secondary={team.secondaryColor}
              number={numbers.get(player.id)}
              className={`w-full drop-shadow-[0_2px_3px_rgba(0,0,0,0.45)] ${
                selected ? "scale-110" : ""
              }`}
            />
            <span
              className={[
                "max-w-full truncate rounded-md px-1.5 py-0.5 text-[10px] leading-tight font-bold text-white sm:text-[11px]",
                selected ? "bg-grass-400 text-grass-950" : "bg-black/45",
              ].join(" ")}
            >
              {shortName(player.name)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Líneas de la cancha en medidas reglamentarias (68 × 105 m). */
function PitchMarkings() {
  const line = {
    fill: "none",
    stroke: "rgba(255,255,255,0.55)",
    strokeWidth: 0.5,
  } as const;

  return (
    <svg
      viewBox="0 0 68 105"
      className="pointer-events-none absolute inset-0 h-full w-full"
      aria-hidden
    >
      <rect x="2" y="2" width="64" height="101" {...line} />
      <line x1="2" y1="52.5" x2="66" y2="52.5" {...line} />
      <circle cx="34" cy="52.5" r="9.15" {...line} />
      <circle cx="34" cy="52.5" r="0.6" fill="rgba(255,255,255,0.55)" />

      {/* Arco propio (abajo) */}
      <rect x="13.84" y="86.5" width="40.32" height="16.5" {...line} />
      <rect x="24.84" y="97.5" width="18.32" height="5.5" {...line} />
      <circle cx="34" cy="92" r="0.6" fill="rgba(255,255,255,0.55)" />
      <path d="M 26.5 86.5 A 9.15 9.15 0 0 0 41.5 86.5" {...line} />

      {/* Arco rival (arriba) */}
      <rect x="13.84" y="2" width="40.32" height="16.5" {...line} />
      <rect x="24.84" y="2" width="18.32" height="5.5" {...line} />
      <circle cx="34" cy="13" r="0.6" fill="rgba(255,255,255,0.55)" />
      <path d="M 26.5 18.5 A 9.15 9.15 0 0 1 41.5 18.5" {...line} />

      {/* Córners */}
      <path d="M 2 4 A 2 2 0 0 0 4 2" {...line} />
      <path d="M 64 2 A 2 2 0 0 0 66 4" {...line} />
      <path d="M 66 101 A 2 2 0 0 0 64 103" {...line} />
      <path d="M 4 103 A 2 2 0 0 0 2 101" {...line} />
    </svg>
  );
}
