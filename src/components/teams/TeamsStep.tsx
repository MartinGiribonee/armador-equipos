"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useMemo, useState } from "react";
import { PlayerChipGhost, type ChipData } from "@/components/teams/PlayerChip";
import { TeamColumn } from "@/components/teams/TeamColumn";
import { BENCH_ID, type Armador } from "@/hooks/useArmador";
import { teamTotal } from "@/lib/balance";
import type { BuildMode } from "@/lib/storage";
import { MATCH_FORMATS, type Player } from "@/lib/types";

const TEAM_COUNTS = [2, 3, 4, 5, 6];

const MODES: Array<{ id: BuildMode; label: string; hint: string }> = [
  { id: "auto", label: "⚽ Automático", hint: "reparte por nivel y puesto" },
  { id: "manual", label: "✋ Manual", hint: "los elegís vos" },
];

export function TeamsStep({ armador }: { armador: Armador }) {
  const {
    squad,
    setup,
    setSetup,
    match,
    bench,
    canGenerate,
    generate,
    createEmptyTeams,
    resetMatch,
    levelOf,
    movePlayer,
    updateTeam,
    setStep,
  } = armador;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dragging, setDragging] = useState<Player | null>(null);

  // Un umbral de 8px evita que un tap para seleccionar arranque un arrastre.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const manual = setup.mode === "manual";
  const format = MATCH_FORMATS.find((f) => f.id === setup.formatId);
  const capacity = format?.perTeam ?? null;
  const everyone: Player[] = useMemo(
    () => [...(match?.teams.flatMap((t) => t.players) ?? []), ...bench],
    [match, bench],
  );

  const spread = match
    ? Math.max(...match.teams.map((t) => teamTotal(t.players, levelOf))) -
      Math.min(...match.teams.map((t) => teamTotal(t.players, levelOf)))
    : 0;

  const needed = setup.teamCount * (capacity ?? 0);
  const shortBy = capacity ? Math.max(0, needed - squad.length) : 0;

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as ChipData | undefined;
    setSelectedId(null);
    setDragging(everyone.find((p) => p.id === data?.playerId) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDragging(null);
    const active = event.active.data.current as ChipData | undefined;
    const over = event.over?.data.current as
      | ChipData
      | { type: "container"; containerId: string }
      | undefined;
    if (!active || !over) return;

    if (over.type === "player") {
      // Soltar sobre otro jugador los intercambia (los equipos ya están llenos).
      movePlayer(active.playerId, over.containerId, over.playerId);
    } else {
      movePlayer(active.playerId, over.containerId);
    }
  };

  const moveSelectedTo = (containerId: string) => {
    if (!selectedId) return;
    movePlayer(selectedId, containerId);
    setSelectedId(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Configuración del partido ── */}
      <div className="card flex flex-col gap-3 p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-grass-100/70">Equipos</span>
            <select
              className="field px-2.5 py-2 text-sm font-semibold"
              value={setup.teamCount}
              onChange={(e) =>
                setSetup({ ...setup, teamCount: Number(e.target.value) })
              }
            >
              {TEAM_COUNTS.map((n) => (
                <option key={n} value={n}>
                  {n} equipos
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-grass-100/70">Formato</span>
            <select
              className="field px-2.5 py-2 text-sm font-semibold"
              value={setup.formatId}
              onChange={(e) => setSetup({ ...setup, formatId: e.target.value })}
            >
              {MATCH_FORMATS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                  {f.perTeam ? ` (${f.perTeam} por equipo)` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Cómo se reparte: con el algoritmo o a dedo. */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-grass-100/70">Armado</span>
          <div
            role="radiogroup"
            aria-label="Modo de armado"
            className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1"
          >
            {MODES.map((option) => {
              const active = setup.mode === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSetup({ ...setup, mode: option.id })}
                  className={[
                    "rounded-lg px-3 py-2 text-xs font-bold transition",
                    active
                      ? "bg-grass-500 text-grass-950"
                      : "text-grass-100/60 hover:bg-white/5 hover:text-grass-100",
                  ].join(" ")}
                >
                  {option.label}
                  <span className="block text-[10px] font-medium opacity-70">
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-grass-100/60">
          <span>
            {squad.length} en el plantel
            {capacity ? ` · hacen falta ${needed}` : " · reparto libre"}
            {shortBy > 0 ? ` · faltan ${shortBy}` : ""}
          </span>
          {manual ? (
            <button
              type="button"
              onClick={createEmptyTeams}
              disabled={squad.length === 0}
              className="rounded-xl bg-grass-500 px-4 py-2 text-sm font-bold text-grass-950 transition hover:bg-grass-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-grass-100/30"
            >
              {match ? "🧹 Vaciar equipos" : "✋ Crear equipos vacíos"}
            </button>
          ) : (
            <button
              type="button"
              onClick={generate}
              disabled={!canGenerate}
              className="rounded-xl bg-grass-500 px-4 py-2 text-sm font-bold text-grass-950 transition hover:bg-grass-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-grass-100/30"
            >
              {match ? "🔄 Regenerar" : "⚽ Generar equipos"}
            </button>
          )}
        </div>
      </div>

      {!match ? (
        <div className="card flex flex-col items-center gap-2 p-8 text-center">
          <span className="text-4xl" aria-hidden>
            🎽
          </span>
          <p className="text-sm font-semibold text-grass-100">
            {manual
              ? "Elegí cuántos equipos y creá la estructura vacía"
              : "Elegí cuántos equipos y tocá “Generar”"}
          </p>
          <p className="max-w-xs text-xs text-grass-100/50">
            {manual
              ? "Te quedan todos los jugadores sin asignar y los vas metiendo en cada equipo arrastrándolos o tocándolos."
              : "Se reparten por puesto y nivel: cada equipo arranca con un arquero y una mezcla pareja del resto."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs">
            <span className="text-grass-100/60">
              Diferencia de nivel entre el más fuerte y el más débil:{" "}
              <strong className={spread <= 2 ? "text-grass-300" : "text-amber-300"}>
                {spread.toFixed(1)} punto{spread === 1 ? "" : "s"}
              </strong>
            </span>
            <span className="text-grass-100/40">
              {manual
                ? "Arrastrá desde “Sin asignar” a cada equipo (o tocá y elegí destino)."
                : "Arrastrá un jugador (o tocalo y elegí destino) para ajustar."}
            </span>
          </div>

          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDragging(null)}
          >
            <div
              className={`grid gap-3 ${
                match.teams.length >= 3
                  ? "sm:grid-cols-2 lg:grid-cols-3"
                  : "sm:grid-cols-2"
              }`}
            >
              {match.teams.map((team) => (
                <TeamColumn
                  key={team.id}
                  id={team.id}
                  name={team.name}
                  primaryColor={team.primaryColor}
                  players={team.players}
                  capacity={capacity}
                  selectedPlayerId={selectedId}
                  onSelectPlayer={(id) =>
                    setSelectedId((current) => (current === id ? null : id))
                  }
                  onDropSelected={() => moveSelectedTo(team.id)}
                  onRename={(name) => updateTeam(team.id, { name })}
                  levelOf={levelOf}
                />
              ))}

              {(manual || bench.length > 0 || selectedId !== null) && (
                <TeamColumn
                  id={BENCH_ID}
                  name={manual ? "Sin asignar" : "Suplentes"}
                  players={bench}
                  selectedPlayerId={selectedId}
                  onSelectPlayer={(id) =>
                    setSelectedId((current) => (current === id ? null : id))
                  }
                  onDropSelected={() => moveSelectedTo(BENCH_ID)}
                  tone="bench"
                />
              )}
            </div>

            <DragOverlay dropAnimation={null}>
              {dragging ? <PlayerChipGhost player={dragging} /> : null}
            </DragOverlay>
          </DndContext>

          <button
            type="button"
            onClick={() => setStep(3)}
            className="rounded-xl bg-grass-500 px-4 py-3 text-sm font-bold text-grass-950 transition hover:bg-grass-400"
          >
            Ver en la cancha y compartir →
          </button>

          {/* Descartar el reparto sin tocar el plantel: el caso "mejor lo armamos
              de nuevo otro día" no tiene por qué costar recargar los nombres. */}
          <button
            type="button"
            onClick={resetMatch}
            className="self-center rounded-lg px-3 py-1 text-xs text-grass-100/40 transition hover:text-rose-300"
          >
            Descartar estos equipos
          </button>
        </>
      )}
    </div>
  );
}
