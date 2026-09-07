import type { Player, Position } from "./types";

/**
 * Formaciones y coordenadas de cada puesto en la cancha.
 *
 * El sistema de coordenadas es porcentual sobre la cancha dibujada en vista
 * cenital, con el arco propio abajo:
 *   x = 0 (izquierda) … 100 (derecha)
 *   y = 0 (arco propio, arquero) … 100 (arco rival, delanteros)
 * Así el mismo layout sirve para cualquier tamaño de cancha en pantalla.
 */

export interface Spot {
  x: number;
  y: number;
  /** Puesto natural del hueco, para acomodar al plantel lo mejor posible. */
  position: Position;
}

export interface Formation {
  id: string;
  /** Jugadores en cancha, arquero incluido. */
  size: number;
  spots: Spot[];
}

/** Reparte `count` jugadores a lo ancho, centrados y con margen en los bordes. */
function row(count: number, y: number, position: Position, spread = 76): Spot[] {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 50, y, position }];
  const start = 50 - spread / 2;
  const step = spread / (count - 1);
  return Array.from({ length: count }, (_, i) => ({
    x: start + step * i,
    y,
    position,
  }));
}

/**
 * Construye una formación desde su notación ("4-3-3"): la primera cifra son
 * defensores, la última delanteros y las del medio, líneas de mediocampo.
 */
function build(id: string): Formation {
  const lines = id.split("-").map(Number);
  const spots: Spot[] = [{ x: 50, y: 6, position: "POR" }];

  // Las líneas se reparten entre el área propia (y≈24) y la rival (y≈88).
  const first = 24;
  const last = 88;
  const gap = lines.length > 1 ? (last - first) / (lines.length - 1) : 0;

  lines.forEach((count, index) => {
    const y = lines.length === 1 ? 55 : first + gap * index;
    const position: Position =
      index === 0 ? "DEF" : index === lines.length - 1 ? "DEL" : "MED";
    // Las líneas de 2 se abren menos que las de 4 para no quedar pegadas al borde.
    const spread = count >= 4 ? 82 : count === 3 ? 70 : 46;
    spots.push(...row(count, y, position, spread));
  });

  return { id, size: spots.length, spots };
}

const FORMATION_IDS: string[] = [
  // Fútbol 5 (4 de campo)
  "2-2",
  "1-2-1",
  "2-1-1",
  "1-1-2",
  // Fútbol 6
  "2-2-1",
  "3-2",
  "2-1-2",
  // Fútbol 7
  "3-2-1",
  "2-3-1",
  "3-1-2",
  "2-2-2",
  // Fútbol 8
  "3-3-1",
  "4-2-1",
  "3-2-2",
  "2-3-2",
  // Fútbol 9
  "3-3-2",
  "4-3-1",
  // Fútbol 10
  "4-3-2",
  "3-4-2",
  // Fútbol 11
  "4-3-3",
  "4-4-2",
  "3-4-3",
  "4-2-3-1",
  "5-3-2",
  "3-5-2",
];

export const FORMATIONS: Formation[] = FORMATION_IDS.map(build);

/** Formaciones disponibles para un equipo de `size` jugadores (arquero incluido). */
export function formationsFor(size: number): Formation[] {
  return FORMATIONS.filter((f) => f.size === size);
}

export function getFormation(id: string): Formation | undefined {
  return FORMATIONS.find((f) => f.id === id);
}

/** Formación por defecto para un equipo de `size` jugadores. */
export function defaultFormation(size: number): string {
  const exact = formationsFor(size);
  if (exact.length > 0) return exact[0].id;
  // Fuera de rango (equipos muy chicos o muy grandes): la más cercana.
  const closest = FORMATIONS.reduce((best, f) =>
    Math.abs(f.size - size) < Math.abs(best.size - size) ? f : best,
  );
  return closest.id;
}

/**
 * Genera huecos para un equipo cuyo tamaño no coincide con ninguna formación
 * (p. ej. quedó uno de más al mover jugadores a mano): filas parejas.
 */
function improvisedSpots(size: number): Spot[] {
  if (size <= 0) return [];
  const spots: Spot[] = [{ x: 50, y: 6, position: "POR" }];
  const rest = size - 1;
  if (rest <= 0) return spots;
  const rows = Math.min(3, Math.max(1, Math.ceil(rest / 4)));
  const perRow = Math.ceil(rest / rows);
  let placed = 0;
  for (let r = 0; r < rows && placed < rest; r++) {
    const count = Math.min(perRow, rest - placed);
    const y = rows === 1 ? 55 : 26 + ((88 - 26) / (rows - 1)) * r;
    const position: Position = r === 0 ? "DEF" : r === rows - 1 ? "DEL" : "MED";
    spots.push(...row(count, y, position, count >= 4 ? 82 : 66));
    placed += count;
  }
  return spots;
}

/** Huecos a dibujar para un equipo, con o sin formación exacta. */
export function spotsForTeam(formationId: string, size: number): Spot[] {
  const formation = getFormation(formationId);
  if (formation && formation.size === size) return formation.spots;
  return improvisedSpots(size);
}

/** Prioridad de encaje: qué tan bien cae un jugador en un hueco. */
const AFFINITY: Record<Position, Record<Position, number>> = {
  POR: { POR: 0, DEF: 2, MED: 3, DEL: 4 },
  DEF: { POR: 2, DEF: 0, MED: 1, DEL: 2 },
  MED: { POR: 3, DEF: 1, MED: 0, DEL: 1 },
  DEL: { POR: 4, DEF: 2, MED: 1, DEL: 0 },
};

/**
 * Asigna cada jugador al hueco que mejor le calza (arquero al arco, defensores
 * atrás, etc.). Resuelve por costo creciente: primero los encajes perfectos.
 */
export function assignToSpots(
  players: readonly Player[],
  spots: readonly Spot[],
): Array<{ spot: Spot; player: Player | null }> {
  const slots = spots.map((spot) => ({ spot, player: null as Player | null }));
  const pending = players.slice();

  for (let cost = 0; cost <= 4 && pending.length > 0; cost++) {
    for (const slot of slots) {
      if (slot.player || pending.length === 0) continue;
      const index = pending.findIndex(
        (p) => AFFINITY[p.position][slot.spot.position] === cost,
      );
      if (index === -1) continue;
      slot.player = pending.splice(index, 1)[0];
    }
  }

  return slots;
}
