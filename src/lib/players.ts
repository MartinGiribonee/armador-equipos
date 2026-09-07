import {
  DEFAULT_LEVEL,
  DEFAULT_POSITION,
  MAX_LEVEL,
  MIN_LEVEL,
  type Player,
  type Position,
} from "./types";

export function createId(prefix = "p"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Marcadores de lista típicos de WhatsApp: "1.", "1-", "1)", "-", "•", "*". */
const LIST_MARKER = /^\s*(?:[-–—•*·]|\(?\d{1,3}\s*[.)\-–]?)\s+/;
const TRAILING_MARKER = /^\s*\d{1,3}\s*[.)\-–]\s*/;

function cleanName(raw: string): string {
  let name = raw.replace(/\s+/g, " ").trim();
  name = name.replace(LIST_MARKER, "").replace(TRAILING_MARKER, "").trim();
  // "Juan (crack)" o "Juan - va seguro": nos quedamos con el nombre.
  name = name.split(/\s+[-–—]\s+/)[0].trim();
  return name.slice(0, 40);
}

/**
 * Convierte el texto pegado del grupo en nombres. Acepta una lista por líneas
 * o separada por comas, limpia numeraciones y descarta repetidos.
 */
export function parseNames(text: string, existing: readonly string[] = []): string[] {
  const chunks = text.includes("\n") ? text.split(/\r?\n/) : text.split(/[,;]/);
  const seen = new Set(existing.map((n) => n.toLocaleLowerCase("es")));
  const names: string[] = [];

  for (const chunk of chunks) {
    const name = cleanName(chunk);
    if (!name) continue;
    const key = name.toLocaleLowerCase("es");
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }

  return names;
}

export function createPlayer(
  name: string,
  level: number = DEFAULT_LEVEL,
  position: Position = DEFAULT_POSITION,
): Player {
  return { id: createId(), name, level: clampLevel(level), position };
}

export function clampLevel(level: number): number {
  if (!Number.isFinite(level)) return DEFAULT_LEVEL;
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, Math.round(level)));
}

/** Nombre corto para la cancha: "Juan Pérez" → "J. Pérez". */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name.trim();
  return `${parts[0][0].toLocaleUpperCase("es")}. ${parts[parts.length - 1]}`;
}

const POSITION_SORT: Record<Position, number> = { POR: 0, DEF: 1, MED: 2, DEL: 3 };

/** Ordena un equipo como se lee una alineación: arquero, defensa, medio, ataque. */
export function sortByLine(players: readonly Player[]): Player[] {
  return players
    .slice()
    .sort(
      (a, b) =>
        POSITION_SORT[a.position] - POSITION_SORT[b.position] ||
        b.level - a.level ||
        a.name.localeCompare(b.name, "es"),
    );
}
