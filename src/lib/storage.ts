import { clampLevel } from "./players";
import {
  MATCH_FORMATS,
  type MatchResult,
  POSITIONS,
  type Match,
  type PitchSpot,
  type Player,
  type Position,
} from "./types";

/**
 * Persistencia local del MVP.
 *
 * Se guardan dos cosas por separado a propósito: el **plantel** (los amigos de
 * siempre, sobrevive a todos los partidos) y el **último partido** armado (para
 * que al volver a abrir la app estén los equipos como quedaron). En fase 2 esto
 * se reemplaza por la base sin tocar el resto de la lógica.
 */

const SQUAD_KEY = "armador:squad:v1";
const MATCH_KEY = "armador:match:v1";
const SETUP_KEY = "armador:setup:v1";
const RESULTS_KEY = "armador:results:v1";
const TEAMS_KEY = "armador:teams:v1";

/** Cómo se arman los equipos: repartiendo con el algoritmo o a dedo. */
export type BuildMode = "auto" | "manual";

export interface MatchSetup {
  teamCount: number;
  formatId: string;
  mode: BuildMode;
}

export const DEFAULT_SETUP: MatchSetup = {
  teamCount: 2,
  formatId: "7v7",
  mode: "auto",
};

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Modo incógnito o storage lleno: la app sigue funcionando en memoria.
  }
}

function isPosition(value: unknown): value is Position {
  return typeof value === "string" && (POSITIONS as readonly string[]).includes(value);
}

/** Valida lo leído del storage: puede venir de una versión vieja o editado a mano. */
function parsePlayer(value: unknown): Player | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  if (!raw.name.trim()) return null;
  return {
    id: raw.id,
    name: raw.name,
    level: clampLevel(Number(raw.level)),
    position: isPosition(raw.position) ? raw.position : "MED",
  };
}

export function loadSquad(): Player[] {
  const raw = read<unknown[]>(SQUAD_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.map(parsePlayer).filter((p): p is Player => p !== null);
}

export function saveSquad(players: readonly Player[]): void {
  write(SQUAD_KEY, players);
}

/**
 * El partido guardado incluye a los suplentes: el `Match` de la spec no los
 * modela, pero al reabrir la app hay que poder seguir moviendo gente desde el
 * banco sin regenerar todo.
 */
export interface StoredMatch {
  match: Match;
  bench: Player[];
}

/**
 * Valida las ubicaciones manuales de la cancha. Se descartan las coordenadas
 * fuera de rango o no numéricas: el jugador vuelve a su hueco de formación en
 * vez de dibujarse afuera del campo.
 */
function parseLayout(value: unknown): Record<string, PitchSpot> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const out: Record<string, PitchSpot> = {};
  for (const [id, spot] of Object.entries(value as Record<string, unknown>)) {
    if (!spot || typeof spot !== "object") continue;
    const { x, y } = spot as Record<string, unknown>;
    if (typeof x !== "number" || typeof y !== "number") continue;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < 0 || x > 100 || y < 0 || y > 100) continue;
    out[id] = { x, y };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function loadMatch(): StoredMatch | null {
  const raw = read<Partial<StoredMatch>>(MATCH_KEY);
  const match = raw?.match;
  if (!match || !Array.isArray(match.teams)) return null;
  return {
    match: {
      ...match,
      teams: match.teams.map((team) => ({
        ...team,
        players: (team.players ?? [])
          .map(parsePlayer)
          .filter((p): p is Player => p !== null),
        layout: parseLayout(team.layout),
      })),
    },
    bench: (raw?.bench ?? []).map(parsePlayer).filter((p): p is Player => p !== null),
  };
}

export function saveMatch(stored: StoredMatch | null): void {
  if (stored === null) {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(MATCH_KEY);
      } catch {
        /* nada que hacer */
      }
    }
    return;
  }
  write(MATCH_KEY, stored);
}

export function loadSetup(): MatchSetup {
  const raw = read<MatchSetup>(SETUP_KEY);
  if (!raw) return DEFAULT_SETUP;
  const known = MATCH_FORMATS.some((f) => f.id === raw.formatId);
  return {
    teamCount: Math.min(6, Math.max(2, Math.round(Number(raw.teamCount) || 2))),
    formatId: known ? raw.formatId : DEFAULT_SETUP.formatId,
    mode: raw.mode === "manual" ? "manual" : "auto",
  };
}

export function saveSetup(setup: MatchSetup): void {
  write(SETUP_KEY, setup);
}

/**
 * Valida un resultado leído del storage. Un partido sin dos equipos con
 * jugadores no aporta nada al rating, así que se descarta directamente.
 */
function parseResult(value: unknown): MatchResult | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.date !== "string") return null;
  if (!Array.isArray(raw.teams)) return null;

  const teams = raw.teams
    .map((team) => {
      if (!team || typeof team !== "object") return null;
      const t = team as Record<string, unknown>;
      const playerIds = Array.isArray(t.playerIds)
        ? t.playerIds.filter((id): id is string => typeof id === "string")
        : [];
      const goals = Number(t.goals);
      if (playerIds.length === 0 || !Number.isFinite(goals) || goals < 0) return null;
      return {
        id: typeof t.id === "string" ? t.id : "",
        name: typeof t.name === "string" ? t.name : "Equipo",
        playerIds,
        goals: Math.round(goals),
      };
    })
    .filter((t): t is MatchResult["teams"][number] => t !== null);

  if (teams.length < 2) return null;

  return {
    id: raw.id,
    date: raw.date,
    format: typeof raw.format === "string" ? raw.format : "libre",
    teams,
    best: typeof raw.best === "string" ? raw.best : undefined,
    worst: typeof raw.worst === "string" ? raw.worst : undefined,
  };
}

export function loadResults(): MatchResult[] {
  const raw = read<unknown[]>(RESULTS_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.map(parseResult).filter((r): r is MatchResult => r !== null);
}

export function saveResults(results: readonly MatchResult[]): void {
  write(RESULTS_KEY, results);
}

/**
 * Identidad durable de cada equipo: el nombre y los colores con los que el
 * grupo los conoce ("Los Pibes", "Los Viejos"). Vive aparte del partido porque
 * sobrevive a todas las fechas — el `Team` dentro de un `Match` es la
 * encarnación de esa identidad en un domingo puntual.
 */
export interface TeamPreset {
  name: string;
  primaryColor: string;
  secondaryColor: string;
}

function parsePreset(value: unknown): TeamPreset | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.name !== "string" || !raw.name.trim()) return null;
  return {
    name: raw.name.slice(0, 30),
    primaryColor: typeof raw.primaryColor === "string" ? raw.primaryColor : "#dc2626",
    secondaryColor:
      typeof raw.secondaryColor === "string" ? raw.secondaryColor : "#ffffff",
  };
}

export function loadTeamPresets(): TeamPreset[] {
  const raw = read<unknown[]>(TEAMS_KEY);
  if (!Array.isArray(raw)) return [];
  return raw.map(parsePreset).filter((p): p is TeamPreset => p !== null);
}

export function saveTeamPresets(presets: readonly TeamPreset[]): void {
  write(TEAMS_KEY, presets);
}
