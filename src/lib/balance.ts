import type { Player, Position } from "./types";

/**
 * Algoritmo de balanceo (spec §5): serpentina por posición + pasada de ajuste
 * por intercambios entre el equipo más fuerte y el más débil.
 *
 * Es una función pura y determinística dada una `seed`, así que se puede
 * testear con distintas listas de jugadores sin montar la UI.
 */

/** Diferencia de nivel total tolerada entre el equipo más fuerte y el más débil. */
export const DEFAULT_THRESHOLD = 2;

/** Tope de intercambios de la pasada de ajuste. */
export const MAX_REFINEMENT_ITERATIONS = 20;

/**
 * Orden en que se reparten las posiciones. Los arqueros se reparten aparte
 * (uno por equipo antes que nada); acá figuran solo los excedentes.
 */
const DRAFT_ORDER: Position[] = ["DEF", "MED", "DEL", "POR"];

/**
 * Cómo leer el nivel de un jugador. Por defecto es el 1-5 cargado a mano, pero
 * el store le pasa el nivel aprendido del historial, que es continuo. La lógica
 * de abajo no asume enteros, así que funciona igual con decimales.
 */
export type LevelOf = (player: Player) => number;

const byOwnLevel: LevelOf = (player) => player.level;

export interface BalanceOptions {
  teamCount: number;
  /** Nivel a usar para balancear. Por defecto, `player.level`. */
  levelOf?: LevelOf;
  /** Jugadores por equipo. `null` = libre (se reparten todos parejo). */
  perTeam?: number | null;
  /** Semilla del azar: misma semilla ⇒ mismo reparto. */
  seed?: number;
  threshold?: number;
  maxIterations?: number;
}

export interface BalanceResult {
  teams: Player[][];
  /** Jugadores que no entraron por cupo (suplentes). */
  bench: Player[];
  /** Diferencia de nivel total entre el equipo más fuerte y el más débil. */
  spread: number;
  /** Intercambios aplicados en la pasada de ajuste. */
  swaps: number;
}

/** PRNG mulberry32: rápido, determinístico y suficiente para barajar. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Ordena por nivel de mayor a menor, barajando antes para que los empates
 * (mismo nivel) queden en distinto orden en cada regeneración.
 */
function byLevelDesc(
  players: readonly Player[],
  rng: () => number,
  levelOf: LevelOf,
): Player[] {
  return shuffle(players, rng).sort((a, b) => levelOf(b) - levelOf(a));
}

/** Suma de niveles de un equipo. */
export function teamTotal(players: readonly Player[], levelOf: LevelOf = byOwnLevel): number {
  return players.reduce((sum, p) => sum + levelOf(p), 0);
}

/** Nivel promedio de un equipo (0 si está vacío). */
export function teamAverage(
  players: readonly Player[],
  levelOf: LevelOf = byOwnLevel,
): number {
  return players.length === 0 ? 0 : teamTotal(players, levelOf) / players.length;
}

/** Cantidad de jugadores por posición dentro de un equipo. */
export function positionCount(players: readonly Player[]): Record<Position, number> {
  const counts: Record<Position, number> = { POR: 0, DEF: 0, MED: 0, DEL: 0 };
  for (const p of players) counts[p.position] += 1;
  return counts;
}

/**
 * Cupo de cada equipo. Con formato fijo todos tienen el mismo; en modo libre
 * se reparte parejo y el resto (si sobra) se le da a los primeros del sorteo.
 */
function computeCapacities(
  total: number,
  order: readonly number[],
  perTeam: number | null,
): number[] {
  const teamCount = order.length;
  const capacities = new Array<number>(teamCount).fill(0);
  if (perTeam !== null) {
    capacities.fill(Math.max(0, Math.floor(perTeam)));
    return capacities;
  }
  const base = Math.floor(total / teamCount);
  const extra = total % teamCount;
  order.forEach((teamIndex, slot) => {
    capacities[teamIndex] = base + (slot < extra ? 1 : 0);
  });
  return capacities;
}

export function balanceTeams(
  players: readonly Player[],
  options: BalanceOptions,
): BalanceResult {
  const teamCount = Math.max(1, Math.floor(options.teamCount));
  const perTeam = options.perTeam ?? null;
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const maxIterations = options.maxIterations ?? MAX_REFINEMENT_ITERATIONS;
  const rng = createRng(options.seed ?? 1);
  const levelOf = options.levelOf ?? byOwnLevel;

  const teams: Player[][] = Array.from({ length: teamCount }, () => []);
  const bench: Player[] = [];

  // Orden de sorteo: qué equipo elige primero. Se baraja en cada regeneración.
  const order = shuffle(
    Array.from({ length: teamCount }, (_, i) => i),
    rng,
  );
  const capacities = computeCapacities(players.length, order, perTeam);

  // ── 1. Agrupar por posición ──────────────────────────────────────────────
  const byPosition: Record<Position, Player[]> = { POR: [], DEF: [], MED: [], DEL: [] };
  for (const player of players) byPosition[player.position].push(player);

  // ── 2. Un arquero por equipo antes que nada ──────────────────────────────
  // (spec §5.3: "que quede al menos un arquero por equipo si hay arqueros").
  const keepers = byLevelDesc(byPosition.POR, rng, levelOf);
  const assignedKeepers = new Set<string>();
  for (let slot = 0; slot < order.length && slot < keepers.length; slot++) {
    const teamIndex = order[slot];
    if (capacities[teamIndex] <= 0) continue;
    teams[teamIndex].push(keepers[slot]);
    assignedKeepers.add(keepers[slot].id);
  }
  // Los arqueros que sobran vuelven al pozo y se reparten como uno más.
  byPosition.POR = keepers.filter((k) => !assignedKeepers.has(k.id));

  // ── 3. Serpentina ────────────────────────────────────────────────────────
  // El cursor NO se reinicia entre posiciones: si un equipo eligió primero
  // entre los defensores, elige último entre los mediocampistas. Reiniciarlo
  // en cada grupo le daría al mismo equipo el mejor jugador de cada línea.
  //
  // Arranca invertida porque el equipo que abrió el sorteo ya se llevó al
  // mejor arquero, así que le toca elegir último en la primera vuelta.
  let slot = 0;
  let reversed = true;
  const pickTeam = (): number | null => {
    // Como máximo dos vueltas completas: si en ninguna hay lugar, están llenos.
    for (let guard = 0; guard <= teamCount * 2; guard++) {
      if (slot >= teamCount) {
        slot = 0;
        reversed = !reversed;
      }
      const teamIndex = reversed ? order[teamCount - 1 - slot] : order[slot];
      slot += 1;
      if (teams[teamIndex].length < capacities[teamIndex]) return teamIndex;
    }
    return null;
  };

  for (const position of DRAFT_ORDER) {
    for (const player of byLevelDesc(byPosition[position], rng, levelOf)) {
      const teamIndex = pickTeam();
      if (teamIndex === null) bench.push(player);
      else teams[teamIndex].push(player);
    }
  }

  // ── 4. Pasada de ajuste por intercambios ─────────────────────────────────
  const swaps = refine(teams, threshold, maxIterations, levelOf);

  return { teams, bench, spread: currentSpread(teams, levelOf), swaps };
}

function currentSpread(teams: readonly Player[][], levelOf: LevelOf): number {
  if (teams.length === 0) return 0;
  const totals = teams.map((team) => teamTotal(team, levelOf));
  return Math.max(...totals) - Math.min(...totals);
}

/**
 * Intercambia jugadores de la misma posición entre el equipo más fuerte y el
 * más débil, quedándose cada vez con el canje que más achica la diferencia.
 * Al ser siempre misma posición por misma posición, el reparto por líneas que
 * armó la serpentina queda intacto.
 */
function refine(
  teams: Player[][],
  threshold: number,
  maxIterations: number,
  levelOf: LevelOf,
): number {
  let swaps = 0;
  if (teams.length < 2) return swaps;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const totals = teams.map((team) => teamTotal(team, levelOf));
    let strongest = 0;
    let weakest = 0;
    totals.forEach((total, i) => {
      if (total > totals[strongest]) strongest = i;
      if (total < totals[weakest]) weakest = i;
    });

    const diff = totals[strongest] - totals[weakest];
    if (diff <= threshold) break;

    let best: { from: number; to: number; diff: number } | null = null;
    teams[strongest].forEach((strong, fromIndex) => {
      teams[weakest].forEach((weak, toIndex) => {
        if (strong.position !== weak.position) return;
        const gain = levelOf(strong) - levelOf(weak);
        if (gain <= 0) return;
        // Mover `gain` puntos de un equipo al otro achica la brecha en 2·gain.
        const nextDiff = Math.abs(diff - 2 * gain);
        if (nextDiff >= diff) return;
        if (best === null || nextDiff < best.diff) {
          best = { from: fromIndex, to: toIndex, diff: nextDiff };
        }
      });
    });

    if (best === null) break;
    const { from, to } = best as { from: number; to: number };
    const strong = teams[strongest][from];
    teams[strongest][from] = teams[weakest][to];
    teams[weakest][to] = strong;
    swaps += 1;
  }

  return swaps;
}
