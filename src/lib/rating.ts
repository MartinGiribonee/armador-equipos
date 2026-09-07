import {
  MAX_LEVEL,
  MIN_LEVEL,
  type MatchResult,
  type Player,
  type PlayerRating,
} from "./types";

/**
 * Sistema de rating tipo Elo por equipos.
 *
 * De cada partido sale un solo dato duro —el marcador— y hay que repartirlo
 * entre los jugadores. La clave es que el ajuste no depende de si ganaste,
 * sino de **cuánto se desvió el resultado de lo esperado**: ganarle al equipo
 * flojo casi no suma, dar el batacazo suma el doble. A lo largo de muchas
 * fechas, el que hace ganar partidos que "no debería" ganar sube.
 *
 * Que la app rearme los equipos cada semana es lo que hace que esto funcione:
 * si un jugador jugara siempre con los mismos, su rating quedaría confundido
 * con el de sus compañeros. Al rotar, lo único que queda correlacionado con él
 * a la larga es él mismo.
 *
 * Todo esto es una función pura del plantel + el historial: no hay estado
 * acumulado que se pueda corromper.
 */

/** Rating de un jugador de nivel 3 (el que arranca por defecto). */
export const SEED_BASE = 1500;

/** Cuánto rating vale cada punto de la escala 1-5 cargada a mano. */
export const SEED_STEP = 150;

/** Techo y piso, para que nadie se dispare al infinito tras una buena racha. */
export const RATING_MIN = SEED_BASE + (MIN_LEVEL - 3) * SEED_STEP - 100;
export const RATING_MAX = SEED_BASE + (MAX_LEVEL - 3) * SEED_STEP + 100;

/**
 * El K de Elo: cuánto se mueve el rating por partido. Arranca alto y baja con
 * los partidos jugados, así un jugador nuevo encuentra su lugar rápido y a un
 * veterano no lo desbarata un mal domingo.
 */
const K_MAX = 56;
const K_MIN = 22;
const K_DECAY = 12;

/**
 * Cuántos goles de diferencia hacen falta para considerar una paliza. Usar el
 * marcador y no solo quién ganó es lo que hace que el rating aprenda a una
 * velocidad razonable: si el balanceador hace bien su trabajo y los partidos
 * salen parejos, el dato "ganó A" casi no informa.
 */
const MARGIN_SCALE = 3;

/**
 * Ajuste extra para la figura y el flojo del partido.
 *
 * Es alto a propósito, y vale la pena explicar por qué. Cuando el balanceador
 * hace bien su trabajo, los dos equipos quedan parejos y el marcador pasa a ser
 * casi puro azar: sobre partidos simulados, el Elo por resultado solo baja el
 * error de 0.82 a 0.78 puntos en 50 fechas — o sea, no aprende. La marca de
 * figura/flojo es la única señal *individual*, sin diluir entre 8 jugadores, y
 * con ella el error baja a ~0.25 en las mismas 50 fechas.
 *
 * Traducido: si el usuario no marca a nadie, el sistema casi no aprende.
 */
const STANDOUT_BONUS = 35;

/**
 * Cuántos partidos "de credibilidad" vale el nivel cargado a mano.
 *
 * El nivel que se muestra no es el rating crudo sino una mezcla entre la
 * semilla manual y lo aprendido, pesada por partidos jugados: con 0 fechas se
 * ve lo que cargó el usuario, con 4 va mitad y mitad, con 20 manda el
 * historial. Evita que dos domingos raros manden a alguien de nivel 3 a nivel 5.
 */
const SEED_CREDIBILITY = 4;

/** Rating inicial de un jugador según el nivel 1-5 que le cargaron a mano. */
export function seedRating(level: number): number {
  return SEED_BASE + (level - 3) * SEED_STEP;
}

/** Traduce el rating a la escala 1-5 de la app, con decimales. */
export function ratingToLevel(rating: number): number {
  const level = 3 + (rating - SEED_BASE) / SEED_STEP;
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level));
}

function clampRating(rating: number): number {
  return Math.min(RATING_MAX, Math.max(RATING_MIN, rating));
}

/**
 * Rating "creíble": tira hacia la semilla manual mientras haya pocos partidos.
 * El Elo interno sigue moviéndose con libertad; esto es solo lo que se muestra
 * y lo que usa el balanceador.
 */
function shrinkToSeed(rating: number, seed: number, matches: number): number {
  return (seed * SEED_CREDIBILITY + rating * matches) / (SEED_CREDIBILITY + matches);
}

function kFactor(matches: number): number {
  return K_MIN + (K_MAX - K_MIN) * Math.exp(-matches / K_DECAY);
}

/** Probabilidad de que un equipo de rating `own` le gane a uno de `rival`. */
function expectedScore(own: number, rival: number): number {
  return 1 / (1 + 10 ** ((rival - own) / 400));
}

/**
 * Resultado real en la escala 0-1, con el margen de goles adentro:
 * empate = 0.5, ganar por 1 = 0.66, por 3 = 0.88, por 5 = 0.97.
 */
function actualScore(goalsFor: number, goalsAgainst: number): number {
  return 0.5 + 0.5 * Math.tanh((goalsFor - goalsAgainst) / MARGIN_SCALE);
}

function emptyRating(playerId: string, seed: number): PlayerRating {
  return {
    playerId,
    rating: seed,
    level: ratingToLevel(seed),
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0,
  };
}

/**
 * Recalcula el rating de todo el plantel replayeando el historial completo en
 * orden cronológico.
 *
 * El nivel cargado a mano no se descarta: es la semilla desde la que arranca
 * cada jugador. Si el usuario lo cambia, se corre toda su curva — que es
 * justo lo que uno espera al decir "a este le puse mal el nivel".
 */
export function computeRatings(
  players: readonly Player[],
  results: readonly MatchResult[],
): Map<string, PlayerRating> {
  const table = new Map<string, PlayerRating>();
  const seeds = new Map<string, number>();
  for (const player of players) {
    const seed = seedRating(player.level);
    seeds.set(player.id, seed);
    table.set(player.id, emptyRating(player.id, seed));
  }

  const chronological = results
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  for (const result of chronological) {
    applyResult(table, result);
  }

  // El nivel visible es el rating tirado hacia la semilla según cuántas fechas
  // lo respalden. El `rating` crudo queda como está, para seguir aprendiendo.
  for (const entry of table.values()) {
    const seed = seeds.get(entry.playerId) ?? SEED_BASE;
    entry.level = ratingToLevel(shrinkToSeed(entry.rating, seed, entry.matches));
  }
  return table;
}

function applyResult(table: Map<string, PlayerRating>, result: MatchResult): void {
  // Solo cuentan los equipos con jugadores que todavía estén en el plantel.
  const teams = result.teams
    .map((team) => ({
      goals: team.goals,
      players: team.playerIds
        .map((id) => table.get(id))
        .filter((p): p is PlayerRating => p !== undefined),
    }))
    .filter((team) => team.players.length > 0);

  if (teams.length < 2) return;

  // Ratings congelados al arranque del partido: dentro de una misma fecha,
  // todos los ajustes se calculan contra el mismo estado.
  const before = teams.map((team) => ({
    ...team,
    rating: team.players.reduce((sum, p) => sum + p.rating, 0) / team.players.length,
  }));

  const deltas = new Map<string, number>();
  const add = (playerId: string, value: number) => {
    deltas.set(playerId, (deltas.get(playerId) ?? 0) + value);
  };

  /*
   * Con 2 equipos hay un solo cruce y esto es Elo puro. Con 3 o más, el
   * marcador cargado no dice quién jugó contra quién, así que se lo trata
   * como todos contra todos y se reparte el peso entre los cruces.
   */
  const weight = 1 / (before.length - 1);

  for (let i = 0; i < before.length; i++) {
    for (let j = i + 1; j < before.length; j++) {
      const a = before[i];
      const b = before[j];
      const expectedA = expectedScore(a.rating, b.rating);
      const actualA = actualScore(a.goals, b.goals);
      const swing = actualA - expectedA;

      for (const player of a.players) {
        add(player.playerId, kFactor(player.matches) * swing * weight);
      }
      for (const player of b.players) {
        add(player.playerId, kFactor(player.matches) * -swing * weight);
      }
    }
  }

  if (result.best && deltas.has(result.best)) {
    add(result.best, STANDOUT_BONUS);
  }
  if (result.worst && deltas.has(result.worst)) {
    add(result.worst, -STANDOUT_BONUS);
  }

  // Recién acá se escribe: el bucle de arriba leyó todo del estado previo.
  for (const [playerId, delta] of deltas) {
    const entry = table.get(playerId);
    if (entry) entry.rating = clampRating(entry.rating + delta);
  }

  updateCounters(table, teams);
}

/**
 * Actualiza partidos jugados, resultados y goles.
 *
 * Con más de dos equipos se compara contra el mejor rival de la fecha: es una
 * aproximación, pero el caso normal del picado son dos equipos y ahí es exacto.
 */
function updateCounters(
  table: Map<string, PlayerRating>,
  teams: Array<{ goals: number; players: PlayerRating[] }>,
): void {
  teams.forEach((team, index) => {
    const rivalGoals = Math.max(
      ...teams.filter((_, other) => other !== index).map((t) => t.goals),
    );

    for (const player of team.players) {
      const entry = table.get(player.playerId);
      if (!entry) continue;
      entry.matches += 1;
      entry.goalsFor += team.goals;
      entry.goalsAgainst += rivalGoals;
      if (team.goals > rivalGoals) entry.wins += 1;
      else if (team.goals === rivalGoals) entry.draws += 1;
      else entry.losses += 1;
    }
  });
}

/**
 * Nivel que usa el balanceador: el aprendido si hay historial, o el cargado a
 * mano si el jugador todavía no jugó ninguna fecha. Es continuo a propósito —
 * distingue entre dos "nivel 4" que no son iguales, y eso solo ya deja los
 * equipos más parejos que la escala de enteros.
 */
export function effectiveLevel(
  player: Player,
  ratings: Map<string, PlayerRating>,
): number {
  // `level` ya viene tirado hacia la semilla, así que sin partidos jugados
  // devuelve exactamente el nivel cargado a mano.
  return ratings.get(player.id)?.level ?? player.level;
}
