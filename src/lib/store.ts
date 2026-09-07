import { balanceTeams } from "./balance";
import { defaultFormation, getFormation } from "./formations";
import { kitFor, teamNameFor } from "./kits";
import { createId, createPlayer, parseNames } from "./players";
import { computeRatings, effectiveLevel } from "./rating";
import {
  DEFAULT_SETUP,
  loadMatch,
  loadResults,
  loadSetup,
  loadSquad,
  saveMatch,
  saveResults,
  saveSetup,
  saveSquad,
  type MatchSetup,
} from "./storage";
import {
  MATCH_FORMATS,
  type Match,
  type MatchResult,
  type PitchSpot,
  type Player,
  type PlayerRating,
  type Team,
} from "./types";

/**
 * Store del armador.
 *
 * Vive fuera de React y se consume con `useSyncExternalStore`, así que la app
 * no necesita efectos para hidratar ni para persistir: leer y escribir
 * `localStorage` pasa acá adentro. En fase 2, cambiar `localStorage` por
 * Supabase es tocar solo este archivo y `storage.ts`.
 */

/** Destino de un movimiento manual: un equipo por id, o el banco. */
export const BENCH_ID = "bench";

export type Step = 1 | 2 | 3 | 4;

export interface ArmadorState {
  squad: Player[];
  setup: MatchSetup;
  match: Match | null;
  bench: Player[];
  step: Step;
  /** Historial de partidos jugados: el insumo del rating. */
  results: MatchResult[];
  /**
   * Rating derivado del historial. No se persiste: se recalcula entero cada
   * vez que cambia el plantel o el historial, que es barato y evita que quede
   * desincronizado.
   */
  ratings: Map<string, PlayerRating>;
}

const EMPTY: ArmadorState = {
  squad: [],
  setup: DEFAULT_SETUP,
  match: null,
  bench: [],
  step: 1,
  results: [],
  ratings: new Map(),
};

function hydrate(): ArmadorState {
  const stored = loadMatch();
  const squad = loadSquad();
  const results = loadResults();
  return {
    squad,
    setup: loadSetup(),
    match: stored?.match ?? null,
    bench: stored?.bench ?? [],
    // Si había un partido armado, arrancamos donde el usuario lo dejó.
    step: stored ? 2 : 1,
    results,
    ratings: computeRatings(squad, results),
  };
}

// En el servidor el estado es siempre `EMPTY`; en el cliente se hidrata al
// importar el módulo, antes del primer render.
let state: ArmadorState = typeof window === "undefined" ? EMPTY : hydrate();

const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): ArmadorState {
  return state;
}

/** Durante la hidratación React usa este snapshot, idéntico al del servidor. */
export function getServerSnapshot(): ArmadorState {
  return EMPTY;
}

export const isHydratedSnapshot = () => true;
export const isHydratedServerSnapshot = () => false;

function commit(next: ArmadorState): void {
  const previous = state;
  state = next;

  if (next.squad !== previous.squad) saveSquad(next.squad);
  if (next.setup !== previous.setup) saveSetup(next.setup);
  if (next.results !== previous.results) saveResults(next.results);
  if (next.match !== previous.match || next.bench !== previous.bench) {
    saveMatch(next.match ? { match: next.match, bench: next.bench } : null);
  }

  for (const listener of listeners) listener();
}

function update(patch: Partial<ArmadorState>): void {
  const next = { ...state, ...patch };
  // El rating es función pura del plantel y del historial: si cambió alguno de
  // los dos, se recalcula desde cero. Con ~20 jugadores y ~100 fechas es menos
  // de un milisegundo, y a cambio nunca puede quedar desfasado.
  if (next.squad !== state.squad || next.results !== state.results) {
    next.ratings = computeRatings(next.squad, next.results);
  }
  commit(next);
}

// ── Utilidades internas ────────────────────────────────────────────────────

function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function randomSeed(): number {
  return Math.floor(Math.random() * 2_147_483_647) + 1;
}

/**
 * Deja al equipo consistente después de cualquier cambio de plantilla:
 *
 * - ajusta la formación si dejó de coincidir con la cantidad de jugadores;
 * - descarta las ubicaciones manuales de jugadores que ya no están en el
 *   equipo, para que al volver más tarde no reaparezcan en la cancha.
 */
function normalizeTeam(team: Team): Team {
  const current = getFormation(team.formation);
  const formation =
    current && current.size === team.players.length
      ? team.formation
      : defaultFormation(team.players.length);

  let layout = team.layout;
  if (layout) {
    const ids = new Set(team.players.map((p) => p.id));
    const entries = Object.entries(layout);
    const kept = entries.filter(([id]) => ids.has(id));
    // Solo se arma un objeto nuevo si realmente sobraba alguien, para no
    // romper la identidad y disparar renders de más.
    if (kept.length !== entries.length) {
      layout = kept.length === 0 ? undefined : Object.fromEntries(kept);
    }
  }

  if (formation === team.formation && layout === team.layout) return team;
  return { ...team, formation, layout };
}

/** Aplica una transformación al plantel y la replica en los equipos ya armados. */
function transformEverywhere(transform: (players: Player[]) => Player[]): void {
  update({
    squad: transform(state.squad),
    bench: transform(state.bench),
    match: state.match
      ? {
          ...state.match,
          teams: state.match.teams.map((team) =>
            normalizeTeam({ ...team, players: transform(team.players) }),
          ),
        }
      : null,
  });
}

// ── Acciones ───────────────────────────────────────────────────────────────

export function setStep(step: Step): void {
  update({ step });
}

export function setSetup(setup: MatchSetup): void {
  update({ setup });
}

/** Agrega los nombres del texto pegado. Devuelve cuántos entraron. */
export function addNames(text: string): number {
  const names = parseNames(
    text,
    state.squad.map((p) => p.name),
  );
  if (names.length === 0) return 0;

  const nuevos = names.map((name) => createPlayer(name));
  update({
    squad: [...state.squad, ...nuevos],
    // Con un partido ya armado, los que se suman van al banco: si no, quedarían
    // en el plantel pero invisibles en la pantalla de equipos.
    bench: state.match ? [...state.bench, ...nuevos] : state.bench,
  });
  return names.length;
}

export function updatePlayer(id: string, patch: Partial<Omit<Player, "id">>): void {
  transformEverywhere((players) =>
    players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  );
}

export function removePlayer(id: string): void {
  transformEverywhere((players) => players.filter((p) => p.id !== id));
}

/**
 * Vacía el plantel.
 *
 * Por defecto se lleva también el historial, y no es un capricho: al volver a
 * cargar a la misma gente se le generan ids nuevos, así que las fechas viejas
 * quedarían apuntando a jugadores que ya no existen — peso muerto en el
 * storage que nunca vuelve a servir para nada. `keepHistory` existe para el
 * caso raro de querer conservarlas igual.
 */
export function clearSquad(options: { keepHistory?: boolean } = {}): void {
  update({
    squad: [],
    match: null,
    bench: [],
    step: 1,
    results: options.keepHistory ? state.results : [],
  });
}

/**
 * Borra el historial de partidos sin tocar el plantel: los niveles vuelven a
 * ser los cargados a mano y el aprendizaje arranca de cero.
 */
export function clearHistory(): void {
  update({ results: [], match: state.match, bench: state.bench });
}

/** Nivel que ve el balanceador: el aprendido del historial. */
export function levelOf(player: Player): number {
  return effectiveLevel(player, state.ratings);
}

export function generate(): void {
  const { squad, setup, match, ratings } = state;
  const format = MATCH_FORMATS.find((f) => f.id === setup.formatId);

  const result = balanceTeams(squad, {
    teamCount: setup.teamCount,
    perTeam: format?.perTeam ?? null,
    seed: randomSeed(),
    // Continuo y aprendido, no el entero 1-5: distingue entre dos "nivel 4"
    // que no son iguales, y eso ya deja los equipos más parejos.
    levelOf: (player) => effectiveLevel(player, ratings),
  });

  const teams: Team[] = result.teams.map((players, index) => {
    // Si el usuario ya renombró o recoloreó un equipo, se le respeta.
    const kept = match?.teams[index];
    const kit = kitFor(index);
    return {
      id: kept?.id ?? createId("t"),
      name: kept?.name ?? teamNameFor(index),
      primaryColor: kept?.primaryColor ?? kit.primaryColor,
      secondaryColor: kept?.secondaryColor ?? kit.secondaryColor,
      players,
      formation: defaultFormation(players.length),
    };
  });

  update({
    match: {
      id: match?.id ?? createId("m"),
      date: match?.date ?? todayIso(),
      format: setup.formatId,
      teams,
    },
    bench: result.bench,
  });
}

/**
 * Arma la estructura de equipos vacíos y manda a todo el plantel al banco,
 * para repartir a dedo. Conserva nombres y colores si ya había equipos.
 */
export function createEmptyTeams(): void {
  const { squad, setup, match } = state;

  const teams: Team[] = Array.from({ length: setup.teamCount }, (_, index) => {
    const kept = match?.teams[index];
    const kit = kitFor(index);
    return {
      id: kept?.id ?? createId("t"),
      name: kept?.name ?? teamNameFor(index),
      primaryColor: kept?.primaryColor ?? kit.primaryColor,
      secondaryColor: kept?.secondaryColor ?? kit.secondaryColor,
      players: [],
      formation: defaultFormation(0),
    };
  });

  update({
    match: {
      id: match?.id ?? createId("m"),
      date: match?.date ?? todayIso(),
      format: setup.formatId,
      teams,
    },
    bench: squad,
  });
}

export function resetMatch(): void {
  update({ match: null, bench: [], step: 1 });
}

/**
 * Mueve un jugador a otro equipo o al banco. Con `swapWithId` los intercambia,
 * que es lo que hace falta cuando los equipos ya están completos.
 */
export function movePlayer(
  playerId: string,
  targetId: string,
  swapWithId?: string,
): void {
  const { match, bench } = state;
  if (!match) return;

  const everyone = [...match.teams.flatMap((t) => t.players), ...bench];
  const player = everyone.find((p) => p.id === playerId);
  if (!player) return;

  const sourceTeam = match.teams.find((t) => t.players.some((p) => p.id === playerId));
  const sourceId = sourceTeam?.id ?? BENCH_ID;
  if (sourceId === targetId) return;

  const partner =
    swapWithId && swapWithId !== playerId
      ? everyone.find((p) => p.id === swapWithId)
      : undefined;

  const without = (players: Player[]) =>
    players.filter((p) => p.id !== player.id && p.id !== partner?.id);

  const teams = match.teams.map((team) => {
    const players = without(team.players);
    if (team.id === targetId) players.push(player);
    if (partner && team.id === sourceId) players.push(partner);
    return normalizeTeam({ ...team, players });
  });

  let nextBench = without(bench);
  if (targetId === BENCH_ID) nextBench = [...nextBench, player];
  if (partner && sourceId === BENCH_ID) nextBench = [...nextBench, partner];

  update({ match: { ...match, teams }, bench: nextBench });
}

/**
 * Ubica a un jugador en un punto exacto de la cancha, pisando el hueco que le
 * daba la formación. Las coordenadas van en el sistema 0-100 de `PitchSpot`.
 */
export function setPlayerSpot(teamId: string, playerId: string, spot: PitchSpot): void {
  if (!state.match) return;

  const clamped: PitchSpot = {
    x: Math.min(100, Math.max(0, spot.x)),
    y: Math.min(100, Math.max(0, spot.y)),
  };

  update({
    match: {
      ...state.match,
      teams: state.match.teams.map((team) =>
        team.id === teamId
          ? { ...team, layout: { ...team.layout, [playerId]: clamped } }
          : team,
      ),
    },
  });
}

/** Descarta las ubicaciones manuales: el equipo vuelve a pararse por formación. */
export function resetLayout(teamId: string): void {
  if (!state.match) return;
  update({
    match: {
      ...state.match,
      teams: state.match.teams.map((team) =>
        team.id === teamId ? { ...team, layout: undefined } : team,
      ),
    },
  });
}

/**
 * Cambia la formación. Borra las ubicaciones manuales a propósito: si no, el
 * usuario elegiría otra formación y no vería ningún cambio en la cancha.
 */
export function setFormation(teamId: string, formation: string): void {
  if (!state.match) return;
  update({
    match: {
      ...state.match,
      teams: state.match.teams.map((team) =>
        team.id === teamId ? { ...team, formation, layout: undefined } : team,
      ),
    },
  });
}

// ── Resultados y aprendizaje ───────────────────────────────────────────────

export interface ResultInput {
  /** Goles por id de equipo. */
  goals: Record<string, number>;
  best?: string;
  worst?: string;
}

export interface SavedResult {
  result: MatchResult;
  /** Rating de cada jugador antes y después de sumar esta fecha. */
  before: Map<string, PlayerRating>;
  after: Map<string, PlayerRating>;
}

/**
 * Cierra el partido en curso: guarda el resultado en el historial (lo que
 * dispara el recálculo del rating) y deja los equipos limpios para la próxima
 * fecha. El plantel no se toca.
 *
 * Devuelve el antes y el después del rating porque quien llama todavía tiene
 * en la mano el estado del render anterior y no puede ver el recalculado.
 */
export function saveResult(input: ResultInput): SavedResult | null {
  const { match, results } = state;
  if (!match) return null;

  const teams = match.teams
    .filter((team) => team.players.length > 0)
    .map((team) => ({
      id: team.id,
      name: team.name,
      playerIds: team.players.map((p) => p.id),
      goals: Math.max(0, Math.round(Number(input.goals[team.id]) || 0)),
    }));

  if (teams.length < 2) return null;

  const played = new Set(teams.flatMap((t) => t.playerIds));
  const result: MatchResult = {
    id: createId("r"),
    date: match.date,
    format: match.format,
    teams,
    // Solo valen los destacados que efectivamente jugaron.
    best: input.best && played.has(input.best) ? input.best : undefined,
    worst: input.worst && played.has(input.worst) ? input.worst : undefined,
  };

  const before = state.ratings;
  update({ results: [...results, result], match: null, bench: [], step: 1 });
  return { result, before, after: state.ratings };
}

/** Borra una fecha del historial. El rating se recalcula sin ella. */
export function deleteResult(resultId: string): void {
  update({ results: state.results.filter((r) => r.id !== resultId) });
}

export function updateTeam(teamId: string, patch: Partial<Omit<Team, "id">>): void {
  if (!state.match) return;
  update({
    match: {
      ...state.match,
      teams: state.match.teams.map((t) => (t.id === teamId ? { ...t, ...patch } : t)),
    },
  });
}
