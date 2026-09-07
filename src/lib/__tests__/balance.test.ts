import { describe, expect, it } from "vitest";
import {
  balanceTeams,
  DEFAULT_THRESHOLD,
  positionCount,
  teamTotal,
} from "../balance";
import type { Player, Position } from "../types";

let counter = 0;
function p(name: string, level: number, position: Position): Player {
  counter += 1;
  return { id: `p${counter}`, name, level, position };
}

/** Plantel sintético: `spec` es "cantidad-posición-nivel". */
function squad(spec: Array<[number, Position, number]>): Player[] {
  const out: Player[] = [];
  for (const [count, position, level] of spec) {
    for (let i = 0; i < count; i++) out.push(p(`${position}${level}-${i}`, level, position));
  }
  return out;
}

/** Plantel típico de picado: 14 jugadores, mezcla de niveles y posiciones. */
const PICADO_14 = squad([
  [2, "POR", 3],
  [2, "DEF", 5],
  [2, "DEF", 3],
  [1, "DEF", 1],
  [2, "MED", 4],
  [2, "MED", 2],
  [2, "DEL", 5],
  [1, "DEL", 2],
]);

describe("balanceTeams — reparto", () => {
  it("reparte todos los jugadores cuando el formato es libre", () => {
    const result = balanceTeams(PICADO_14, { teamCount: 2, perTeam: null, seed: 7 });
    const repartidos = result.teams.flat().length + result.bench.length;

    expect(repartidos).toBe(PICADO_14.length);
    expect(result.bench).toHaveLength(0);
    expect(result.teams[0]).toHaveLength(7);
    expect(result.teams[1]).toHaveLength(7);
  });

  it("no duplica ni pierde jugadores", () => {
    const result = balanceTeams(PICADO_14, { teamCount: 3, perTeam: null, seed: 3 });
    const ids = [...result.teams.flat(), ...result.bench].map((x) => x.id);

    expect(new Set(ids).size).toBe(PICADO_14.length);
  });

  it("respeta el cupo por equipo y manda el resto al banco", () => {
    // 14 jugadores en dos equipos de 5 ⇒ juegan 10, quedan 4 de suplentes.
    const result = balanceTeams(PICADO_14, { teamCount: 2, perTeam: 5, seed: 11 });

    expect(result.teams[0]).toHaveLength(5);
    expect(result.teams[1]).toHaveLength(5);
    expect(result.bench).toHaveLength(4);
  });

  it("arma equipos disparejos por cupo cuando faltan jugadores", () => {
    const chicos = squad([
      [1, "POR", 3],
      [4, "DEF", 3],
    ]);
    const result = balanceTeams(chicos, { teamCount: 2, perTeam: 5, seed: 5 });

    expect(result.teams.flat()).toHaveLength(5);
    expect(result.bench).toHaveLength(0);
  });

  it("reparte parejo con cantidad impar en modo libre", () => {
    const impar = PICADO_14.slice(0, 11);
    const result = balanceTeams(impar, { teamCount: 2, perTeam: null, seed: 2 });
    const tamaños = result.teams.map((t) => t.length).sort();

    expect(tamaños).toEqual([5, 6]);
  });
});

describe("balanceTeams — posiciones", () => {
  it("da un arquero a cada equipo cuando alcanzan", () => {
    const result = balanceTeams(PICADO_14, { teamCount: 2, perTeam: null, seed: 9 });

    for (const team of result.teams) {
      expect(positionCount(team).POR).toBe(1);
    }
  });

  it("no amontona los arqueros cuando hay más que equipos", () => {
    const conArqueros = squad([
      [4, "POR", 3],
      [4, "DEF", 4],
      [4, "MED", 3],
      [4, "DEL", 2],
    ]);
    const result = balanceTeams(conArqueros, { teamCount: 2, perTeam: null, seed: 4 });

    for (const team of result.teams) {
      expect(positionCount(team).POR).toBe(2);
    }
  });

  it("funciona sin ningún arquero cargado", () => {
    const sinArqueros = squad([
      [4, "DEF", 4],
      [4, "MED", 3],
      [2, "DEL", 5],
    ]);
    const result = balanceTeams(sinArqueros, { teamCount: 2, perTeam: null, seed: 6 });

    for (const team of result.teams) {
      expect(positionCount(team).POR).toBe(0);
      expect(team).toHaveLength(5);
    }
  });

  it("reparte cada línea entre los equipos en vez de juntarla", () => {
    const result = balanceTeams(PICADO_14, { teamCount: 2, perTeam: null, seed: 8 });
    const [a, b] = result.teams.map(positionCount);

    // Con 7 defensores/medios/delanteros repartidos, ninguna línea puede
    // diferir en más de un jugador entre equipos.
    for (const position of ["DEF", "MED", "DEL"] as const) {
      expect(Math.abs(a[position] - b[position])).toBeLessThanOrEqual(1);
    }
  });
});

describe("balanceTeams — nivel", () => {
  it("deja la diferencia de nivel dentro del umbral", () => {
    const result = balanceTeams(PICADO_14, { teamCount: 2, perTeam: null, seed: 1 });

    expect(result.spread).toBeLessThanOrEqual(DEFAULT_THRESHOLD);
  });

  it("mantiene el umbral con distintas semillas y cantidades", () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const teamCount of [2, 3, 4]) {
        const result = balanceTeams(PICADO_14, { teamCount, perTeam: null, seed });
        expect(
          result.spread,
          `seed ${seed}, ${teamCount} equipos: spread ${result.spread}`,
        ).toBeLessThanOrEqual(DEFAULT_THRESHOLD);
      }
    }
  });

  it("aguanta un plantel polarizado (mitad cracks, mitad novatos)", () => {
    const polarizado = squad([
      [2, "POR", 5],
      [4, "DEF", 5],
      [4, "DEF", 1],
      [4, "MED", 5],
      [4, "MED", 1],
      [2, "DEL", 5],
      [2, "DEL", 1],
    ]);
    const result = balanceTeams(polarizado, { teamCount: 2, perTeam: null, seed: 13 });

    expect(result.spread).toBeLessThanOrEqual(DEFAULT_THRESHOLD);
  });

  it("la pasada de ajuste conserva las posiciones de cada equipo", () => {
    // Reparto que obliga a intercambiar: mismos puestos, niveles extremos.
    const desparejo = squad([
      [2, "POR", 3],
      [3, "DEF", 5],
      [3, "DEF", 1],
      [3, "MED", 5],
      [3, "MED", 1],
    ]);
    const result = balanceTeams(desparejo, { teamCount: 2, perTeam: null, seed: 21 });
    const [a, b] = result.teams.map(positionCount);

    expect(a).toEqual(b);
  });

  it("no puede mejorar un plantel imposible pero devuelve equipos válidos", () => {
    // Un solo crack y el resto flojos: la brecha es irreducible.
    const imposible = squad([
      [1, "DEL", 5],
      [3, "DEF", 1],
    ]);
    const result = balanceTeams(imposible, { teamCount: 2, perTeam: null, seed: 1 });

    expect(result.teams.flat()).toHaveLength(4);
    expect(Math.abs(teamTotal(result.teams[0]) - teamTotal(result.teams[1]))).toBe(4);
  });
});

describe("balanceTeams — determinismo y regeneración", () => {
  it("misma semilla ⇒ mismo reparto", () => {
    const a = balanceTeams(PICADO_14, { teamCount: 2, perTeam: null, seed: 42 });
    const b = balanceTeams(PICADO_14, { teamCount: 2, perTeam: null, seed: 42 });

    expect(a.teams.map((t) => t.map((x) => x.id))).toEqual(
      b.teams.map((t) => t.map((x) => x.id)),
    );
  });

  it("regenerar con otra semilla cambia el reparto al menos a veces", () => {
    const base = balanceTeams(PICADO_14, { teamCount: 2, perTeam: null, seed: 1 });
    const baseKey = JSON.stringify(base.teams.map((t) => t.map((x) => x.id).sort()));

    const distintos = Array.from({ length: 10 }, (_, i) =>
      balanceTeams(PICADO_14, { teamCount: 2, perTeam: null, seed: i + 2 }),
    ).filter(
      (r) => JSON.stringify(r.teams.map((t) => t.map((x) => x.id).sort())) !== baseKey,
    );

    expect(distintos.length).toBeGreaterThan(0);
  });
});

describe("balanceTeams — casos borde", () => {
  it("sin jugadores devuelve equipos vacíos", () => {
    const result = balanceTeams([], { teamCount: 2, perTeam: null, seed: 1 });

    expect(result.teams).toEqual([[], []]);
    expect(result.spread).toBe(0);
  });

  it("soporta más de dos equipos", () => {
    const grande = squad([
      [3, "POR", 3],
      [6, "DEF", 4],
      [6, "MED", 3],
      [6, "DEL", 2],
    ]);
    const result = balanceTeams(grande, { teamCount: 3, perTeam: 7, seed: 17 });

    expect(result.teams.map((t) => t.length)).toEqual([7, 7, 7]);
    expect(result.bench).toHaveLength(0);
    for (const team of result.teams) expect(positionCount(team).POR).toBe(1);
  });

  it("con un solo equipo mete a todos adentro", () => {
    const result = balanceTeams(PICADO_14, { teamCount: 1, perTeam: null, seed: 1 });

    expect(result.teams[0]).toHaveLength(PICADO_14.length);
    expect(result.spread).toBe(0);
  });
});
