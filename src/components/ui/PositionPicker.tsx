"use client";

import { POSITION_LABEL, POSITIONS, type Position } from "@/lib/types";

/** Color propio de cada línea, para reconocerlas de un vistazo. */
export const POSITION_STYLE: Record<Position, { on: string; dot: string }> = {
  POR: { on: "bg-amber-400 text-amber-950", dot: "bg-amber-400" },
  DEF: { on: "bg-sky-400 text-sky-950", dot: "bg-sky-400" },
  MED: { on: "bg-grass-400 text-grass-950", dot: "bg-grass-400" },
  DEL: { on: "bg-rose-400 text-rose-950", dot: "bg-rose-400" },
};

interface PositionPickerProps {
  value: Position;
  onChange: (position: Position) => void;
}

export function PositionPicker({ value, onChange }: PositionPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Posición"
      className="flex items-center gap-1 rounded-lg bg-white/5 p-0.5"
    >
      {POSITIONS.map((position) => {
        const active = position === value;
        return (
          <button
            key={position}
            type="button"
            role="radio"
            aria-checked={active}
            title={POSITION_LABEL[position]}
            onClick={() => onChange(position)}
            className={[
              "rounded-md px-2 py-1 text-[11px] font-bold tracking-wide transition",
              active
                ? POSITION_STYLE[position].on
                : "text-grass-100/50 hover:bg-white/10 hover:text-grass-100",
            ].join(" ")}
          >
            {position}
          </button>
        );
      })}
    </div>
  );
}
