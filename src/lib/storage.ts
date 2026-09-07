import { clampLevel } from "./players";
import { MATCH_FORMATS, POSITIONS, type Match, type Player, type Position } from "./types";

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

export interface MatchSetup {
  teamCount: number;
  formatId: string;
}

export const DEFAULT_SETUP: MatchSetup = { teamCount: 2, formatId: "7v7" };

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
  };
}

export function saveSetup(setup: MatchSetup): void {
  write(SETUP_KEY, setup);
}
