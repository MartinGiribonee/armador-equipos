import { balanceTeams } from "./balance";
import { defaultFormation, getFormation } from "./formations";
import { kitFor, teamNameFor } from "./kits";
import { createId, createPlayer, parseNames } from "./players";
import {
  DEFAULT_SETUP,
  loadMatch,
  loadSetup,
  loadSquad,
  saveMatch,
  saveSetup,
  saveSquad,
  type MatchSetup,
} from "./storage";
import { MATCH_FORMATS, type Match, type Player, type Team } from "./types";

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

export type Step = 1 | 2 | 3;

export interface ArmadorState {
  squad: Player[];
  setup: MatchSetup;
  match: Match | null;
  bench: Player[];
  step: Step;
}

const EMPTY: ArmadorState = {
  squad: [],
  setup: DEFAULT_SETUP,
  match: null,
  bench: [],
  step: 1,
};

function hydrate(): ArmadorState {
  const stored = loadMatch();
  return {
    squad: loadSquad(),
    setup: loadSetup(),
    match: stored?.match ?? null,
    bench: stored?.bench ?? [],
    // Si había un partido armado, arrancamos donde el usuario lo dejó.
    step: stored ? 2 : 1,
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
  if (next.match !== previous.match || next.bench !== previous.bench) {
    saveMatch(next.match ? { match: next.match, bench: next.bench } : null);
  }

  for (const listener of listeners) listener();
}

function update(patch: Partial<ArmadorState>): void {
  commit({ ...state, ...patch });
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
 * Ajusta la formación si dejó de coincidir con la cantidad de jugadores
 * (pasa al mover gente a mano después de generar).
 */
function fitFormation(team: Team): Team {
  const current = getFormation(team.formation);
  if (current && current.size === team.players.length) return team;
  return { ...team, formation: defaultFormation(team.players.length) };
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
            fitFormation({ ...team, players: transform(team.players) }),
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
  update({ squad: [...state.squad, ...names.map((name) => createPlayer(name))] });
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

export function clearSquad(): void {
  update({ squad: [], match: null, bench: [], step: 1 });
}

export function generate(): void {
  const { squad, setup, match } = state;
  const format = MATCH_FORMATS.find((f) => f.id === setup.formatId);

  const result = balanceTeams(squad, {
    teamCount: setup.teamCount,
    perTeam: format?.perTeam ?? null,
    seed: randomSeed(),
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
    return fitFormation({ ...team, players });
  });

  let nextBench = without(bench);
  if (targetId === BENCH_ID) nextBench = [...nextBench, player];
  if (partner && sourceId === BENCH_ID) nextBench = [...nextBench, partner];

  update({ match: { ...match, teams }, bench: nextBench });
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
