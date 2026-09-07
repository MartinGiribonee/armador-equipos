"use client";

import type { Step } from "@/hooks/useArmador";

const STEPS: Array<{ id: Step; label: string; short: string }> = [
  { id: 1, label: "Plantel", short: "Plantel" },
  { id: 2, label: "Equipos", short: "Equipos" },
  { id: 3, label: "Cancha", short: "Cancha" },
  { id: 4, label: "Resultado", short: "Resultado" },
];

interface StepperProps {
  current: Step;
  /** Paso máximo alcanzable: no se puede saltar a "Equipos" sin plantel. */
  maxStep: Step;
  onSelect: (step: Step) => void;
}

export function Stepper({ current, maxStep, onSelect }: StepperProps) {
  return (
    <nav aria-label="Pasos" className="flex items-center gap-1">
      {STEPS.map((step, index) => {
        const enabled = step.id <= maxStep;
        const active = step.id === current;
        const done = step.id < current;

        return (
          <div key={step.id} className="flex flex-1 items-center gap-1">
            <button
              type="button"
              disabled={!enabled}
              aria-current={active ? "step" : undefined}
              onClick={() => onSelect(step.id)}
              className={[
                "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-1.5 py-2 text-xs font-semibold transition sm:gap-2 sm:px-2 sm:text-sm",
                active
                  ? "bg-grass-500 text-grass-950 shadow-lg shadow-grass-500/25"
                  : enabled
                    ? "bg-night-800/70 text-grass-100 hover:bg-night-800"
                    : "cursor-not-allowed bg-night-800/40 text-grass-100/30",
              ].join(" ")}
            >
              <span
                className={[
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  active
                    ? "bg-grass-950/25 text-grass-950"
                    : done
                      ? "bg-grass-500 text-grass-950"
                      : "bg-white/10",
                ].join(" ")}
                aria-hidden
              >
                {done ? "✓" : step.id}
              </span>
              <span className="truncate">{step.short}</span>
            </button>
            {index < STEPS.length - 1 && (
              <span
                aria-hidden
                className={`hidden h-px w-3 sm:block ${
                  step.id < current ? "bg-grass-500" : "bg-white/15"
                }`}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
