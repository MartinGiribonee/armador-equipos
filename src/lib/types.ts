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

/**
 * Punto en la cancha, en el mismo sistema que las formaciones:
 * x = 0 (izquierda) … 100 (derecha), y = 0 (arco propio) … 100 (arco rival).
 */
export interface PitchSpot {
  x: number;
  y: number;
}

export interface Team {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  players: Player[];
  /** Formación en notación clásica, ej. "4-3-3" o "2-3-1". */
  formation: string;
  /**
   * Ubicaciones puestas a mano, por id de jugador. Pisan a la formación: si un
   * jugador no figura acá, se lo dibuja en el hueco que le toca por formación.
   */
  layout?: Record<string, PitchSpot>;
}

export interface Match {
  id: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Formato del partido, ej. "7v7" o "libre". */
  format: string;
  teams: Team[];
}

/**
 * Resultado de un partido ya jugado. Es el insumo del sistema de rating: se
 * guarda el historial completo y los niveles se recalculan siempre desde cero
 * sobre él, así se puede corregir un resultado mal cargado o cambiar la
 * fórmula y volver a correrla sobre todas las fechas pasadas.
 */
export interface MatchResult {
  id: string;
  /** ISO date (YYYY-MM-DD). Ordena el historial. */
  date: string;
  format: string;
  teams: Array<{
    /** Id del equipo tal como estaba armado ese día. */
    id: string;
    name: string;
    playerIds: string[];
    goals: number;
  }>;
  /** Figura y flojo del partido: un empujón extra sobre el ajuste del equipo. */
  best?: string;
  worst?: string;
}

/** Estado aprendido de un jugador, derivado del historial de resultados. */
export interface PlayerRating {
  playerId: string;
  /** Escala tipo Elo. Ver `SEED_BASE` y `SEED_STEP` en `rating.ts`. */
  rating: number;
  /** El mismo rating traducido a la escala 1-5, con decimales. */
  level: number;
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
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
