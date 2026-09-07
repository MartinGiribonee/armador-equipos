"use client";

import { useState } from "react";
import type { Armador } from "@/hooks/useArmador";
import { sortByLine } from "@/lib/players";
import { formatDate, formatLabel } from "@/lib/share";
import type { Player } from "@/lib/types";

type Saved = {
  /** Cuánto se movió cada jugador, para mostrar el efecto del partido. */
  deltas: Array<{ player: Player; before: number; after: number }>;
};

export function ResultStep({ armador }: { armador: Armador }) {
  const { match, squad, results, saveResult, setStep } = armador;

  const [goals, setGoals] = useState<Record<string, string>>({});
  const [best, setBest] = useState("");
  const [worst, setWorst] = useState("");
  const [saved, setSaved] = useState<Saved | null>(null);

  if (saved) {
    return <AfterSave saved={saved} fechas={results.length} onNext={() => setStep(1)} />;
  }

  if (!match) {
    return (
      <div className="card flex flex-col items-center gap-3 p-8 text-center">
        <span className="text-4xl" aria-hidden>
          📋
        </span>
        <p className="text-sm font-semibold text-grass-100">
          No hay ningún partido abierto
        </p>
        <p className="max-w-xs text-xs text-grass-100/50">
          El resultado se carga sobre los equipos que armaste. Armá los equipos de la
          fecha y volvé acá cuando termine el partido.
        </p>
        <button
          type="button"
          onClick={() => setStep(2)}
          className="rounded-xl bg-grass-500 px-4 py-2 text-sm font-bold text-grass-950"
        >
          Ir a armar equipos
        </button>
      </div>
    );
  }

  const jugaron = match.teams.flatMap((t) => t.players);
  const listos = match.teams.filter((t) => t.players.length > 0).length >= 2;

  const submit = () => {
    const saved = saveResult({
      goals: Object.fromEntries(
        match.teams.map((t) => [t.id, Number(goals[t.id] ?? 0) || 0]),
      ),
      best: best || undefined,
      worst: worst || undefined,
    });
    if (!saved) return;

    setSaved({
      deltas: jugaron
        .map((player) => ({
          player,
          before: saved.before.get(player.id)?.level ?? player.level,
          after: saved.after.get(player.id)?.level ?? player.level,
        }))
        .sort((a, b) => b.after - b.before - (a.after - a.before)),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-col gap-1 p-3">
        <h2 className="text-sm font-bold text-grass-100">¿Cómo salió el partido?</h2>
        <p className="text-xs text-grass-100/50">
          {formatLabel(match.format)} ·{" "}
          <span className="capitalize">{formatDate(match.date)}</span> · {jugaron.length}{" "}
          jugadores
        </p>
      </div>

      {/* ── Marcador ── */}
      <div className="card flex flex-col gap-3 p-3">
        <h3 className="text-xs font-semibold text-grass-100/70">Marcador</h3>
        {match.teams.map((team) => (
          <div key={team.id} className="flex items-center gap-3">
            <span
              aria-hidden
              className="size-4 shrink-0 rounded-full border border-white/25"
              style={{ backgroundColor: team.primaryColor }}
            />
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-grass-50">
              {team.name}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              aria-label={`Goles de ${team.name}`}
              value={goals[team.id] ?? ""}
              placeholder="0"
              onChange={(e) => setGoals({ ...goals, [team.id]: e.target.value })}
              className="field w-16 px-2 py-2 text-center text-lg font-black"
            />
          </div>
        ))}
      </div>

      {/* ── Destacados ── */}
      <div className="card flex flex-col gap-3 p-3">
        <div>
          <h3 className="text-xs font-semibold text-grass-100/70">
            Figura y flojo del partido
          </h3>
          <p className="mt-1 text-[11px] text-grass-100/40">
            Es opcional, pero es lo que más ayuda: cuando los equipos salen parejos el
            marcador es casi azar, y esto es lo único que dice algo de cada jugador en
            particular.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-grass-300">⭐ Figura</span>
            <PlayerSelect
              players={jugaron}
              value={best}
              exclude={worst}
              onChange={setBest}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-amber-300">💤 Flojo</span>
            <PlayerSelect
              players={jugaron}
              value={worst}
              exclude={best}
              onChange={setWorst}
            />
          </label>
        </div>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!listos}
        className="rounded-xl bg-grass-500 px-4 py-3 text-sm font-bold text-grass-950 transition hover:bg-grass-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-grass-100/30"
      >
        Guardar resultado
      </button>

      <p className="px-1 text-center text-[11px] text-grass-100/40">
        Al guardar, la fecha se suma al historial y los equipos quedan libres para el
        próximo partido. El plantel no se toca.
      </p>

      {squad.length > 0 && results.length > 0 && (
        <p className="px-1 text-center text-[11px] text-grass-100/40">
          Llevás {results.length} fecha{results.length === 1 ? "" : "s"} cargada
          {results.length === 1 ? "" : "s"}.
        </p>
      )}
    </div>
  );
}

function PlayerSelect({
  players,
  value,
  exclude,
  onChange,
}: {
  players: Player[];
  value: string;
  exclude: string;
  onChange: (id: string) => void;
}) {
  return (
    <select
      className="field px-2 py-2 text-sm font-semibold"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">— nadie —</option>
      {sortByLine(players)
        .filter((p) => p.id !== exclude)
        .map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
    </select>
  );
}

/** Pantalla de confirmación: qué aprendió la app con esta fecha. */
function AfterSave({
  saved,
  fechas,
  onNext,
}: {
  saved: Saved;
  fechas: number;
  onNext: () => void;
}) {
  const movidos = saved.deltas.filter(
    ({ before, after }) => Math.abs(after - before) >= 0.01,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="card flex flex-col items-center gap-2 p-6 text-center">
        <span className="text-4xl" aria-hidden>
          ✅
        </span>
        <p className="text-sm font-bold text-grass-100">Resultado guardado</p>
        <p className="text-xs text-grass-100/50">
          Van {fechas} fecha{fechas === 1 ? "" : "s"} en el historial.
          {fechas < 10
            ? " Con unas 10 el nivel aprendido empieza a valer."
            : " El nivel aprendido ya se apoya en bastantes partidos."}
        </p>
      </div>

      {movidos.length > 0 && (
        <div className="card flex flex-col gap-2 p-3">
          <h3 className="text-xs font-semibold text-grass-100/70">
            Cómo cambió el nivel
          </h3>
          <ul className="flex flex-col gap-1">
            {movidos.map(({ player, before, after }) => {
              const delta = after - before;
              const sube = delta > 0;
              return (
                <li
                  key={player.id}
                  className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate font-semibold text-grass-50">
                    {player.name}
                  </span>
                  <span className="text-xs text-grass-100/40">
                    {before.toFixed(2)} → {after.toFixed(2)}
                  </span>
                  <span
                    className={`w-14 text-right text-xs font-bold ${
                      sube ? "text-grass-300" : "text-rose-300"
                    }`}
                  >
                    {sube ? "▲" : "▼"} {Math.abs(delta).toFixed(2)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <button
        type="button"
        onClick={onNext}
        className="rounded-xl bg-grass-500 px-4 py-3 text-sm font-bold text-grass-950 transition hover:bg-grass-400"
      >
        Armar el próximo partido →
      </button>
    </div>
  );
}
