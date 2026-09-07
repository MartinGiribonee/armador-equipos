/**
 * Modelo de datos del MVP.
 *
 * Todo se guarda hoy en `localStorage`, pero las formas están pensadas para
 * mapear 1:1 a tablas de Supabase/Firebase en fase 2 sin tocar la lógica de
 * negocio: `Player`, `Team` y `Match` son objetos planos y serializables.
 */

export const POSITIONS = ["POR", "DEF", "MED", "DEL"] as const;

export type Position = (typeof POSITIONS)[number];

export const POSITION_LABEL: Record<Position, string> = {
  POR: "Arquero",
  DEF: "Defensor",
  MED: "Mediocampista",
  DEL: "Delantero",
};

export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;
export const DEFAULT_LEVEL = 3;
export const DEFAULT_POSITION: Position = "MED";

export interface Player {
  id: string;
  name: string;
  /** Nivel 1 a 5. */
  level: number;
  position: Position;
}

export interface Kit {
  primaryColor: string;
  secondaryColor: string;
}

export interface Team {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  players: Player[];
  /** Formación en notación clásica, ej. "4-3-3" o "2-3-1". */
  formation: string;
}

export interface Match {
  id: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Formato del partido, ej. "7v7" o "libre". */
  format: string;
  teams: Team[];
}

/** Formatos de partido soportados. `null` en `perTeam` = reparto libre. */
export interface MatchFormat {
  id: string;
  label: string;
  perTeam: number | null;
}

export const MATCH_FORMATS: MatchFormat[] = [
  { id: "5v5", label: "Fútbol 5", perTeam: 5 },
  { id: "6v6", label: "Fútbol 6", perTeam: 6 },
  { id: "7v7", label: "Fútbol 7", perTeam: 7 },
  { id: "8v8", label: "Fútbol 8", perTeam: 8 },
  { id: "11v11", label: "Fútbol 11", perTeam: 11 },
  { id: "libre", label: "Libre", perTeam: null },
];
