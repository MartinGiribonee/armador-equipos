"use client";

import { MAX_LEVEL, MIN_LEVEL } from "@/lib/types";

interface LevelPickerProps {
  value: number;
  onChange: (level: number) => void;
  label?: string;
  size?: "sm" | "md";
}

/**
 * Selector de nivel 1-5 en pelotitas. Táctil a propósito: un tap fija el nivel,
 * sin dropdowns ni sliders que en el celular son un martirio.
 */
export function LevelPicker({ value, onChange, label, size = "md" }: LevelPickerProps) {
  const dot = size === "sm" ? "size-5 text-[10px]" : "size-7 text-xs";

  return (
    <div
      role="radiogroup"
      aria-label={label ?? "Nivel"}
      className="flex items-center gap-1"
    >
      {Array.from({ length: MAX_LEVEL - MIN_LEVEL + 1 }, (_, i) => {
        const level = MIN_LEVEL + i;
        const on = level <= value;
        return (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={value === level}
            aria-label={`Nivel ${level}`}
            onClick={() => onChange(level)}
            className={[
              dot,
              "flex items-center justify-center rounded-full font-bold transition",
              on
                ? "bg-grass-400 text-grass-950"
                : "bg-white/8 text-grass-100/40 hover:bg-white/15",
              value === level ? "ring-2 ring-grass-300 ring-offset-1 ring-offset-night-900" : "",
            ].join(" ")}
          >
            {level}
          </button>
        );
      })}
    </div>
  );
}
