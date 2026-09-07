"use client";

import { useRef, useState } from "react";
import { Jersey } from "@/components/pitch/Jersey";
import { assignToSpots, spotsForTeam } from "@/lib/formations";
import { shortName, sortByLine } from "@/lib/players";
import type { PitchSpot, Player, Team } from "@/lib/types";

/**
 * Números de camiseta: 1 al arquero y el resto en orden de línea (defensa,
 * medio, ataque), como se numera una alineación de toda la vida.
 */
function shirtNumbers(players: readonly Player[]): Map<string, number> {
  const numbers = new Map<string, number>();
  sortByLine(players).forEach((player, index) => numbers.set(player.id, index + 1));
  return numbers;
}

/*
 * Mapeo entre las coordenadas de la cancha (0-100, arco propio abajo) y los
 * porcentajes CSS. El margen evita que las camisetas queden pisando la línea
 * de fondo, y hay que aplicarlo en los dos sentidos: al dibujar y al leer
 * dónde soltó el dedo.
 */
const PAD_X = 6;
const SCALE_X = 0.88;
const PAD_Y = 93;
const SCALE_Y = 0.86;

function toStyle({ x, y }: PitchSpot) {
  return { left: `${PAD_X + x * SCALE_X}%`, top: `${PAD_Y - y * SCALE_Y}%` };
}

function fromClient(
  clientX: number,
  clientY: number,
  rect: DOMRect,
): PitchSpot {
  const leftPct = ((clientX - rect.left) / rect.width) * 100;
  const topPct = ((clientY - rect.top) / rect.height) * 100;
  return {
    x: Math.min(100, Math.max(0, (leftPct - PAD_X) / SCALE_X)),
    y: Math.min(100, Math.max(0, (PAD_Y - topPct) / SCALE_Y)),
  };
}

/** Umbral en px para distinguir un toque (abre el editor) de un arrastre. */
const DRAG_THRESHOLD = 6;

interface PitchProps {
  team: Team;
  onSelectPlayer?: (player: Player) => void;
  selectedPlayerId?: string | null;
  /** En modo exportación se ocultan los estados de hover/foco. */
  interactive?: boolean;
  /** Habilita arrastrar camisetas para ubicarlas donde uno quiera. */
  onMovePlayer?: (playerId: string, spot: PitchSpot) => void;
}

export function Pitch({
  team,
  onSelectPlayer,
  selectedPlayerId,
  interactive = true,
  onMovePlayer,
}: PitchProps) {
  const fieldRef = useRef<HTMLDivElement>(null);
  /** Posición en vivo mientras se arrastra, para no escribir al store en cada píxel. */
  const [dragging, setDragging] = useState<{ id: string; spot: PitchSpot } | null>(null);
  const gesture = useRef<{ moved: boolean; startX: number; startY: number } | null>(null);

  const spots = spotsForTeam(team.formation, team.players.length);
  const slots = assignToSpots(team.players, spots);
  const numbers = shirtNumbers(team.players);
  const canDrag = interactive && onMovePlayer !== undefined;

  const handlePointerDown = (event: React.PointerEvent) => {
    if (!canDrag) return;
    gesture.current = {
      moved: false,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent, playerId: string) => {
    const start = gesture.current;
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!start || !rect) return;

    if (!start.moved) {
      const dx = event.clientX - start.startX;
      const dy = event.clientY - start.startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      start.moved = true;
    }

    setDragging({ id: playerId, spot: fromClient(event.clientX, event.clientY, rect) });
  };

  const handlePointerUp = (event: React.PointerEvent, playerId: string) => {
    const start = gesture.current;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const rect = fieldRef.current?.getBoundingClientRect();
    if (start?.moved && rect && onMovePlayer) {
      onMovePlayer(playerId, fromClient(event.clientX, event.clientY, rect));
    }
    setDragging(null);

    // Sin desplazamiento fue un toque: abre la ficha del jugador.
    if (start && !start.moved) {
      const player = team.players.find((p) => p.id === playerId);
      if (player) onSelectPlayer?.(player);
    }
  };

  return (
    <div
      ref={fieldRef}
      className="pitch-turf relative aspect-[68/105] w-full overflow-hidden rounded-2xl"
    >
      <PitchMarkings />

      {slots.map(({ spot, player }) => {
        if (!player) return null;
        const selected = selectedPlayerId === player.id;
        const isDragging = dragging?.id === player.id;
        // Prioridad: lo que se está arrastrando ahora > ubicación manual
        // guardada > el hueco que le da la formación.
        const at = isDragging
          ? dragging.spot
          : (team.layout?.[player.id] ?? { x: spot.x, y: spot.y });

        return (
          <button
            key={player.id}
            type="button"
            disabled={!interactive}
            onPointerDown={handlePointerDown}
            onPointerMove={(e) => handlePointerMove(e, player.id)}
            onPointerUp={(e) => handlePointerUp(e, player.id)}
            onPointerCancel={() => {
              gesture.current = null;
              setDragging(null);
            }}
            // Sin arrastre habilitado el click normal sigue abriendo la ficha.
            onClick={canDrag ? undefined : () => onSelectPlayer?.(player)}
            aria-label={`${player.name} — ${player.position}, nivel ${player.level}`}
            style={{
              ...toStyle(at),
              // El que se arrastra va arriba de todos y sin transición, para
              // que siga al dedo sin ir "atrasado".
              zIndex: isDragging ? 20 : selected ? 10 : undefined,
            }}
            className={[
              "absolute flex w-[19%] max-w-[86px] min-w-[44px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5",
              interactive ? "cursor-pointer" : "",
              canDrag ? "touch-none" : "",
              isDragging ? "scale-110" : "transition hover:scale-110",
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
