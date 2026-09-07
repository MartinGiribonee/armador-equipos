"use client";

import { PitchStep } from "@/components/pitch/PitchStep";
import { SquadStep } from "@/components/players/SquadStep";
import { ResultStep } from "@/components/result/ResultStep";
import { TeamsStep } from "@/components/teams/TeamsStep";
import { Stepper } from "@/components/ui/Stepper";
import { useArmador, type Step } from "@/hooks/useArmador";

export default function Home() {
  const armador = useArmador();
  const { hydrated, step, setStep, squad, match, canGenerate } = armador;

  // No se puede saltar a un paso para el que todavía no hay datos.
  const maxStep: Step = match ? 4 : squad.length >= 2 ? 2 : 1;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-3 pt-4 pb-24 sm:px-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-lg font-black tracking-tight">
          <span aria-hidden>⚽</span>
          Armador de equipos
        </h1>
        {squad.length > 0 && (
          <span className="rounded-lg bg-white/5 px-2 py-1 text-[11px] font-semibold text-grass-100/60">
            {squad.length} jugadores
          </span>
        )}
      </header>

      <Stepper current={step} maxStep={maxStep} onSelect={setStep} />

      {!hydrated ? (
        <div className="card h-40 animate-pulse" aria-hidden />
      ) : (
        <>
          {step === 1 && <SquadStep armador={armador} />}
          {step === 2 && <TeamsStep armador={armador} />}
          {step === 3 && <PitchStep armador={armador} />}
          {step === 4 && <ResultStep armador={armador} />}
        </>
      )}

      {/* Barra de avance fija: en el celular el botón siempre queda a mano. */}
      {hydrated && step === 1 && squad.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-night-950/90 px-3 py-3 backdrop-blur sm:px-5">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <p className="flex-1 text-xs text-grass-100/50">
              {canGenerate
                ? "Revisá niveles y puestos, y seguí."
                : "Cargá al menos 2 jugadores."}
            </p>
            <button
              type="button"
              disabled={!canGenerate}
              onClick={() => setStep(2)}
              className="rounded-xl bg-grass-500 px-5 py-2.5 text-sm font-bold text-grass-950 transition hover:bg-grass-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-grass-100/30"
            >
              Armar equipos →
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
