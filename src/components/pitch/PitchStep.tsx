"use client";

import { useCallback, useRef, useState } from "react";
import { KitPicker } from "@/components/pitch/KitPicker";
import { Pitch } from "@/components/pitch/Pitch";
import { SummaryCard } from "@/components/share/SummaryCard";
import { LevelPicker } from "@/components/ui/LevelPicker";
import { PositionPicker } from "@/components/ui/PositionPicker";
import type { Armador } from "@/hooks/useArmador";
import { teamAverage } from "@/lib/balance";
import { formationsFor } from "@/lib/formations";
import {
  copyToClipboard,
  downloadDataUrl,
  formatDate,
  formatLabel,
  matchToText,
  slugify,
  whatsappUrl,
} from "@/lib/share";
import type { Player } from "@/lib/types";

type Toast = { text: string; tone: "ok" | "error" } | null;

export function PitchStep({ armador }: { armador: Armador }) {
  const {
    match,
    bench,
    updateTeam,
    updatePlayer,
    setFormation,
    setPlayerSpot,
    resetLayout,
    setStep,
  } = armador;
  const [activeIndex, setActiveIndex] = useState(0);
  const [editing, setEditing] = useState<Player | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const pitchRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const notify = useCallback((text: string, tone: "ok" | "error" = "ok") => {
    setToast({ text, tone });
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  /**
   * `html-to-image` se importa recién acá (dinámico) para no cargar el
   * serializador de estilos en el primer render de la app.
   */
  const exportPng = useCallback(
    async (node: HTMLElement | null, filename: string, label: string) => {
      if (!node) return;
      setBusy(label);
      try {
        const { toPng } = await import("html-to-image");
        const dataUrl = await toPng(node, {
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor: "#0f1a13",
        });
        downloadDataUrl(dataUrl, filename);
        notify("Imagen descargada 📥");
      } catch {
        notify("No se pudo generar la imagen", "error");
      } finally {
        setBusy(null);
      }
    },
    [notify],
  );

  if (!match) {
    return (
      <div className="card flex flex-col items-center gap-3 p-8 text-center">
        <span className="text-4xl" aria-hidden>
          🥅
        </span>
        <p className="text-sm font-semibold text-grass-100">Todavía no armaste equipos</p>
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

  const team = match.teams[Math.min(activeIndex, match.teams.length - 1)];
  const formations = formationsFor(team.players.length);
  const hasCustomLayout = Object.keys(team.layout ?? {}).length > 0;
  const text = matchToText(match, bench);

  return (
    <div className="flex flex-col gap-4">
      {/* ── Selector de equipo ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {match.teams.map((t, index) => {
          const active = t.id === team.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setActiveIndex(index);
                setEditing(null);
              }}
              className={[
                "flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition",
                active
                  ? "bg-grass-500 text-grass-950"
                  : "bg-night-800/70 text-grass-100 hover:bg-night-800",
              ].join(" ")}
            >
              <span
                aria-hidden
                className="size-3 rounded-full border border-white/30"
                style={{ backgroundColor: t.primaryColor }}
              />
              {t.name}
            </button>
          );
        })}
      </div>

      {/* ── Cancha + controles ── */}
      <div className="card flex flex-col gap-3 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-grass-100/70">
            Formación
            <select
              className="field px-2 py-1.5 text-sm font-bold"
              value={team.formation}
              onChange={(e) => setFormation(team.id, e.target.value)}
            >
              {formations.length === 0 && (
                <option value={team.formation}>{team.formation} (libre)</option>
              )}
              {formations.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.id}
                </option>
              ))}
            </select>
          </label>
          <KitPicker team={team} onChange={(patch) => updateTeam(team.id, patch)} />
        </div>

        <p className="flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] text-grass-100/40">
          <span>Arrastrá las camisetas para ubicarlas donde quieras.</span>
          {hasCustomLayout && (
            <button
              type="button"
              onClick={() => resetLayout(team.id)}
              className="rounded-lg bg-white/5 px-2 py-1 font-semibold text-grass-200 transition hover:bg-white/10"
            >
              ↺ Volver a la formación
            </button>
          )}
        </p>

        {/* Nodo que se exporta como PNG: cancha + encabezado del equipo. */}
        <div ref={pitchRef} className="rounded-2xl bg-night-900 p-3">
          <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
            <span className="text-sm font-black tracking-wide uppercase text-grass-50">
              {team.name}
            </span>
            <span className="text-[11px] text-grass-100/60">
              {formatLabel(match.format)} · {team.players.length} jugadores · nivel{" "}
              {teamAverage(team.players).toFixed(1)}
            </span>
          </div>
          <Pitch
            team={team}
            selectedPlayerId={editing?.id ?? null}
            onSelectPlayer={(player) =>
              setEditing((current) => (current?.id === player.id ? null : player))
            }
            onMovePlayer={(playerId, spot) => setPlayerSpot(team.id, playerId, spot)}
          />
          <p className="mt-2 px-1 text-right text-[10px] text-grass-100/30 capitalize">
            {formatDate(match.date)}
          </p>
        </div>

        {editing && (
          <div className="card flex flex-col gap-2 p-3">
            <div className="flex items-center gap-2">
              <input
                className="field min-w-0 flex-1 px-2.5 py-1.5 text-sm font-semibold"
                value={editing.name}
                aria-label="Nombre del jugador"
                onChange={(e) => {
                  setEditing({ ...editing, name: e.target.value });
                  updatePlayer(editing.id, { name: e.target.value });
                }}
              />
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg px-2 py-1.5 text-xs font-bold text-grass-100/50 hover:text-grass-100"
              >
                Listo
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <PositionPicker
                value={editing.position}
                onChange={(position) => {
                  setEditing({ ...editing, position });
                  updatePlayer(editing.id, { position });
                }}
              />
              <LevelPicker
                value={editing.level}
                size="sm"
                onChange={(level) => {
                  setEditing({ ...editing, level });
                  updatePlayer(editing.id, { level });
                }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Compartir ── */}
      <div className="card flex flex-col gap-2 p-3">
        <h3 className="text-sm font-bold text-grass-100">Compartir con el grupo</h3>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              exportPng(
                pitchRef.current,
                `${slugify(team.name)}-${match.date}.png`,
                "pitch",
              )
            }
            className="rounded-xl bg-white/8 px-3 py-2.5 text-xs font-bold text-grass-100 transition hover:bg-white/15 disabled:opacity-50"
          >
            {busy === "pitch" ? "Generando…" : "🖼️ PNG de la cancha"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() =>
              exportPng(summaryRef.current, `equipos-${match.date}.png`, "summary")
            }
            className="rounded-xl bg-white/8 px-3 py-2.5 text-xs font-bold text-grass-100 transition hover:bg-white/15 disabled:opacity-50"
          >
            {busy === "summary" ? "Generando…" : "📋 PNG con las listas"}
          </button>
          <button
            type="button"
            onClick={async () => {
              const ok = await copyToClipboard(text);
              notify(ok ? "Texto copiado 📋" : "No se pudo copiar", ok ? "ok" : "error");
            }}
            className="rounded-xl bg-white/8 px-3 py-2.5 text-xs font-bold text-grass-100 transition hover:bg-white/15"
          >
            📄 Copiar como texto
          </button>
          <a
            href={whatsappUrl(text)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center rounded-xl bg-[#25D366] px-3 py-2.5 text-xs font-bold text-[#0b2e18] transition hover:brightness-110"
          >
            💬 Enviar por WhatsApp
          </a>
        </div>

        <details className="mt-1">
          <summary className="cursor-pointer text-[11px] text-grass-100/50">
            Ver el texto que se comparte
          </summary>
          <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-black/30 p-3 text-[11px] leading-relaxed whitespace-pre-wrap text-grass-100/80">
            {text}
          </pre>
        </details>

        <p className="text-[11px] text-grass-100/40">
          WhatsApp no deja adjuntar imágenes desde un link: descargá el PNG y mandalo
          desde el chat, o compartí el texto directo.
        </p>
      </div>

      {toast && (
        <div
          role="status"
          className={`fixed inset-x-4 bottom-4 z-50 mx-auto max-w-sm rounded-xl px-4 py-3 text-center text-sm font-bold shadow-2xl ${
            toast.tone === "ok"
              ? "bg-grass-500 text-grass-950"
              : "bg-rose-500 text-white"
          }`}
        >
          {toast.text}
        </div>
      )}

      {/*
        La placa vive fuera de pantalla para poder exportarla sin mostrarla:
        `html-to-image` necesita un nodo realmente renderizado, así que no
        sirve `display:none`.
      */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: -10000,
          top: 0,
          pointerEvents: "none",
        }}
      >
        <div ref={summaryRef}>
          <SummaryCard match={match} bench={bench} />
        </div>
      </div>
    </div>
  );
}
