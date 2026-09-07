import { describe, expect, it } from "vitest";
import { balanceTeams, createRng } from "../balance";
import {
  computeRatings,
  effectiveLevel,
  ratingToLevel,
  seedRating,
  SEED_BASE,
} from "../rating";
import type { MatchResult, Player, Position } from "../types";

function player(id: string, level: number, position: Position = "MED"): Player {
  return { id, name: id, level, position };
}

function match(
  id: string,
  date: string,
  a: { ids: string[]; goals: number },
  b: { ids: string[]; goals: number },
  extra: Partial<MatchResult> = {},
): MatchResult {
  return {
    id,
    date,
    format: "7v7",
    teams: [
      { id: "tA", name: "A", playerIds: a.ids, goals: a.goals },
      { id: "tB", name: "B", playerIds: b.ids, goals: b.goals },
    ],
    ...extra,
  };
}

const SQUAD = ["a1", "a2", "a3", "b1", "b2", "b3"].map((id) => player(id, 3));
const TEAM_A = ["a1", "a2", "a3"];
const TEAM_B = ["b1", "b2", "b3"];

describe("semilla y escala", () => {
  it("el nivel cargado a mano es el punto de partida", () => {
    expect(seedRating(3)).toBe(SEED_BASE);
    expect(seedRating(5)).toBeGreaterThan(seedRating(4));
    expect(seedRating(1)).toBeLessThan(seedRating(2));
  });

  it("rating y nivel son inversos entre sí", () => {
    for (const level of [1, 2, 3, 4, 5]) {
      expect(ratingToLevel(seedRating(level))).toBeCloseTo(level, 5);
    }
  });

  it("el nivel derivado nunca se sale de la escala 1-5", () => {
    expect(ratingToLevel(99_999)).toBe(5);
    expect(ratingToLevel(-99_999)).toBe(1);
  });

  it("sin partidos jugados, todos quedan en su nivel cargado", () => {
    const ratings = computeRatings([player("x", 4)], []);

    expect(ratings.get("x")!.rating).toBe(seedRating(4));
    expect(ratings.get("x")!.matches).toBe(0);
  });
});

describe("ajuste por resultado", () => {
  it("los ganadores suben y los perdedores bajan", () => {
    const ratings = computeRatings(SQUAD, [
      match("m1", "2026-01-04", { ids: TEAM_A, goals: 5 }, { ids: TEAM_B, goals: 2 }),
    ]);

    expect(ratings.get("a1")!.rating).toBeGreaterThan(SEED_BASE);
    expect(ratings.get("b1")!.rating).toBeLessThan(SEED_BASE);
  });

  it("un empate entre equipos parejos casi no mueve la aguja", () => {
    const ratings = computeRatings(SQUAD, [
      match("m1", "2026-01-04", { ids: TEAM_A, goals: 3 }, { ids: TEAM_B, goals: 3 }),
    ]);

    expect(ratings.get("a1")!.rating).toBeCloseTo(SEED_BASE, 6);
    expect(ratings.get("b1")!.rating).toBeCloseTo(SEED_BASE, 6);
  });

  it("una goleada mueve más que ganar por poco", () => {
    const ajustado = (golesA: number, golesB: number) =>
      computeRatings(SQUAD, [
        match("m1", "2026-01-04", { ids: TEAM_A, goals: golesA }, { ids: TEAM_B, goals: golesB }),
      ]).get("a1")!.rating;

    expect(ajustado(8, 1)).toBeGreaterThan(ajustado(4, 3));
  });

  it("el batacazo suma más que ganar el partido que ya se esperaba ganar", () => {
    const fuertes = TEAM_A.map((id) => player(id, 5));
    const flojos = TEAM_B.map((id) => player(id, 1));
    const squad = [...fuertes, ...flojos];
    const fecha = (golesA: number, golesB: number) =>
      match("m1", "2026-01-04", { ids: TEAM_A, goals: golesA }, { ids: TEAM_B, goals: golesB });

    // Gana el fuerte (lo esperado) vs gana el flojo (batacazo), misma diferencia.
    const esperado = computeRatings(squad, [fecha(5, 2)]);
    const batacazo = computeRatings(squad, [fecha(2, 5)]);

    const subeElFuerte = esperado.get("a1")!.rating - seedRating(5);
    const subeElFlojo = batacazo.get("b1")!.rating - seedRating(1);

    expect(subeElFlojo).toBeGreaterThan(subeElFuerte * 2);
  });

  it("el rating de un novato se mueve más que el de un veterano", () => {
    const fechas = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        match(
          `m${i}`,
          `2026-01-${String(i + 1).padStart(2, "0")}`,
          { ids: TEAM_A, goals: 4 },
          { ids: TEAM_B, goals: 4 },
        ),
      );

    const golpe = (previas: number) => {
      const historial = [
        ...fechas(previas),
        match("final", "2026-06-01", { ids: TEAM_A, goals: 8 }, { ids: TEAM_B, goals: 1 }),
      ];
      const ratings = computeRatings(SQUAD, historial);
      return ratings.get("a1")!.rating - SEED_BASE;
    };

    expect(golpe(0)).toBeGreaterThan(golpe(20));
  });

  it("la figura y el flojo del partido corrigen dentro del mismo equipo", () => {
    const ratings = computeRatings(SQUAD, [
      match(
        "m1",
        "2026-01-04",
        { ids: TEAM_A, goals: 5 },
        { ids: TEAM_B, goals: 2 },
        { best: "a1", worst: "a3" },
      ),
    ]);

    expect(ratings.get("a1")!.rating).toBeGreaterThan(ratings.get("a2")!.rating);
    expect(ratings.get("a3")!.rating).toBeLessThan(ratings.get("a2")!.rating);
  });

  it("cuenta partidos, resultados y goles", () => {
    const ratings = computeRatings(SQUAD, [
      match("m1", "2026-01-04", { ids: TEAM_A, goals: 5 }, { ids: TEAM_B, goals: 2 }),
      match("m2", "2026-01-11", { ids: TEAM_A, goals: 1 }, { ids: TEAM_B, goals: 4 }),
      match("m3", "2026-01-18", { ids: TEAM_A, goals: 3 }, { ids: TEAM_B, goals: 3 }),
    ]);

    expect(ratings.get("a1")).toMatchObject({
      matches: 3,
      wins: 1,
      draws: 1,
      losses: 1,
      goalsFor: 9,
      goalsAgainst: 9,
    });
  });
});

describe("robustez del historial", () => {
  it("el orden de carga no cambia el resultado (se ordena por fecha)", () => {
    const fechas = [
      match("m1", "2026-01-04", { ids: TEAM_A, goals: 5 }, { ids: TEAM_B, goals: 2 }),
      match("m2", "2026-01-11", { ids: TEAM_A, goals: 1 }, { ids: TEAM_B, goals: 6 }),
      match("m3", "2026-01-18", { ids: TEAM_A, goals: 3 }, { ids: TEAM_B, goals: 2 }),
    ];

    const enOrden = computeRatings(SQUAD, fechas);
    const alReves = computeRatings(SQUAD, fechas.slice().reverse());

    expect(alReves.get("a1")!.rating).toBeCloseTo(enOrden.get("a1")!.rating, 9);
  });

  it("ignora jugadores que ya no están en el plantel", () => {
    const ratings = computeRatings(SQUAD, [
      match(
        "m1",
        "2026-01-04",
        { ids: [...TEAM_A, "fantasma"], goals: 5 },
        { ids: TEAM_B, goals: 2 },
      ),
    ]);

    expect(ratings.has("fantasma")).toBe(false);
    expect(ratings.get("a1")!.rating).toBeGreaterThan(SEED_BASE);
  });

  it("descarta un partido si quedó un solo equipo con gente", () => {
    const ratings = computeRatings(SQUAD, [
      match("m1", "2026-01-04", { ids: TEAM_A, goals: 5 }, { ids: ["fantasma"], goals: 0 }),
    ]);

    expect(ratings.get("a1")!.rating).toBe(SEED_BASE);
    expect(ratings.get("a1")!.matches).toBe(0);
  });

  it("no se dispara al infinito con 200 goleadas seguidas", () => {
    const historial = Array.from({ length: 200 }, (_, i) =>
      match(
        `m${i}`,
        `2026-01-01`,
        { ids: TEAM_A, goals: 20 },
        { ids: TEAM_B, goals: 0 },
      ),
    );
    const ratings = computeRatings(SQUAD, historial);

    expect(ratings.get("a1")!.level).toBe(5);
    expect(ratings.get("b1")!.level).toBe(1);
  });

  it("corregir el nivel a mano corre toda la curva del jugador", () => {
    const historial = [
      match("m1", "2026-01-04", { ids: TEAM_A, goals: 5 }, { ids: TEAM_B, goals: 2 }),
    ];
    const base = computeRatings(SQUAD, historial).get("a1")!.rating;

    const corregido = computeRatings(
      SQUAD.map((p) => (p.id === "a1" ? { ...p, level: 5 } : p)),
      historial,
    ).get("a1")!.rating;

    expect(corregido).toBeGreaterThan(base);
  });
});

describe("effectiveLevel", () => {
  it("usa el nivel cargado a mano mientras no haya jugado", () => {
    const ratings = computeRatings([player("x", 2)], []);
    expect(effectiveLevel(player("x", 2), ratings)).toBe(2);
  });

  it("usa el nivel aprendido apenas hay historial", () => {
    const ratings = computeRatings(SQUAD, [
      match("m1", "2026-01-04", { ids: TEAM_A, goals: 7 }, { ids: TEAM_B, goals: 1 }),
    ]);

    expect(effectiveLevel(player("a1", 3), ratings)).toBeGreaterThan(3);
  });
});

/**
 * La prueba que importa: ¿el rating converge al nivel real de cada jugador?
 *
 * Se inventan 16 jugadores con un nivel "real" que la app no conoce (arrancan
 * todos cargados en 3) y se simulan fechas armando los equipos con el propio
 * balanceador — o sea, equipos cada vez más parejos, que es el escenario más
 * difícil para aprender — con marcadores generados a partir del nivel real
 * más ruido.
 */
describe("convergencia sobre partidos simulados", () => {
  const TRUE_LEVELS: Record<string, number> = {
    p1: 4.9, p2: 4.7, p3: 4.4, p4: 4.2,
    p5: 3.9, p6: 3.7, p7: 3.4, p8: 3.2,
    p9: 3.0, p10: 2.8, p11: 2.5, p12: 2.3,
    p13: 2.0, p14: 1.8, p15: 1.5, p16: 1.2,
  };

  const POSITIONS: Position[] = ["POR", "DEF", "DEF", "MED", "MED", "DEL", "DEL", "DEL"];

  /** `marcarDestacados` simula que el usuario carga figura y flojo del partido. */
  function simulate(fechas: number, marcarDestacados: boolean) {
    const rng = createRng(20260907);
    const squad: Player[] = Object.keys(TRUE_LEVELS).map((id, i) =>
      player(id, 3, POSITIONS[i % POSITIONS.length]),
    );

    const results: MatchResult[] = [];

    for (let fecha = 0; fecha < fechas; fecha++) {
      const ratings = computeRatings(squad, results);

      // Los equipos se arman con lo que la app cree saber hasta ahora.
      const { teams } = balanceTeams(squad, {
        teamCount: 2,
        perTeam: 8,
        seed: Math.floor(rng() * 1e9) + 1,
        levelOf: (p) => effectiveLevel(p, ratings),
      });

      const fuerza = (team: Player[]) =>
        team.reduce((sum, p) => sum + TRUE_LEVELS[p.id], 0) / team.length;

      // Marcador: manda la diferencia real de nivel, con bastante ruido encima.
      const ventaja = (fuerza(teams[0]) - fuerza(teams[1])) * 2.2;
      const ruido = (rng() + rng() + rng() - 1.5) * 3;
      const diff = Math.round(ventaja + ruido);

      let best: string | undefined;
      let worst: string | undefined;
      if (marcarDestacados) {
        // El organizador marca al que más se destacó: nivel real + su propio ruido.
        const todos = [...teams[0], ...teams[1]];
        const puntaje = new Map(
          todos.map((p) => [p.id, TRUE_LEVELS[p.id] + (rng() + rng() - 1) * 1.6]),
        );
        const ranking = todos.slice().sort((a, b) => puntaje.get(b.id)! - puntaje.get(a.id)!);
        best = ranking[0].id;
        worst = ranking[ranking.length - 1].id;
      }

      results.push({
        id: `sim${fecha}`,
        date: `2026-01-${String(fecha + 1).padStart(3, "0")}`,
        format: "8v8",
        teams: [
          { id: "tA", name: "A", playerIds: teams[0].map((p) => p.id), goals: 4 + Math.max(0, diff) },
          { id: "tB", name: "B", playerIds: teams[1].map((p) => p.id), goals: 4 + Math.max(0, -diff) },
        ],
        best,
        worst,
      });
    }

    const ratings = computeRatings(squad, results);
    const error =
      squad.reduce((sum, p) => sum + Math.abs(ratings.get(p.id)!.level - TRUE_LEVELS[p.id]), 0) /
      squad.length;

    return { ratings, error };
  }

  it("con figura y flojo cargados, el error baja fecha a fecha", () => {
    const alPrincipio = simulate(8, true).error;
    const alMedio = simulate(25, true).error;
    const alFinal = simulate(50, true).error;

    expect(alMedio).toBeLessThan(alPrincipio);
    expect(alFinal).toBeLessThan(alMedio);
    // Menos de medio punto de error en una escala de 1 a 5.
    expect(alFinal).toBeLessThan(0.5);
  });

  it("después de 25 fechas ordena bien al plantel", () => {
    const { ratings } = simulate(25, true);
    const promedio = (ids: string[]) =>
      ids.reduce((sum, id) => sum + ratings.get(id)!.level, 0) / ids.length;

    expect(promedio(["p1", "p2", "p3", "p4"])).toBeGreaterThan(promedio(["p5", "p6", "p7", "p8"]));
    expect(promedio(["p5", "p6", "p7", "p8"])).toBeGreaterThan(
      promedio(["p9", "p10", "p11", "p12"]),
    );
    expect(promedio(["p9", "p10", "p11", "p12"])).toBeGreaterThan(
      promedio(["p13", "p14", "p15", "p16"]),
    );
    expect(ratings.get("p1")!.level).toBeGreaterThan(ratings.get("p16")!.level + 1.5);
  });

  /**
   * Documenta la limitación del diseño: contra equipos parejos el marcador es
   * casi azar, así que sin marcar destacados el sistema aprende muy poco. Si
   * este test empieza a fallar porque el error bajó, mejor todavía — pero hay
   * que revisar por qué.
   */
  it("sin marcar destacados aprende mucho menos", () => {
    const conMarcas = simulate(50, true).error;
    const sinMarcas = simulate(50, false).error;

    expect(sinMarcas).toBeGreaterThan(conMarcas * 1.5);
  });

  it("el nivel arranca en lo cargado a mano y no se dispara en las primeras fechas", () => {
    const { ratings } = simulate(3, true);

    // Con 3 fechas, la semilla (nivel 3) todavía pesa: nadie puede haber
    // saltado más de un punto en cualquier dirección.
    for (const entry of ratings.values()) {
      expect(Math.abs(entry.level - 3)).toBeLessThan(1);
    }
  });
});
