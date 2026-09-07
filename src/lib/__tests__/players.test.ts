import { describe, expect, it } from "vitest";
import { parseNames, shortName, sortByLine } from "../players";
import type { Player } from "../types";

describe("parseNames", () => {
  it("toma una lista simple por líneas", () => {
    expect(parseNames("Juan\nSeba\nNico")).toEqual(["Juan", "Seba", "Nico"]);
  });

  it("limpia la numeración típica de WhatsApp", () => {
    const pegado = `1. Juan
2- Seba
3) Nico
- Pedro
• Coco
* Fede`;

    expect(parseNames(pegado)).toEqual([
      "Juan",
      "Seba",
      "Nico",
      "Pedro",
      "Coco",
      "Fede",
    ]);
  });

  it("descarta líneas vacías y espacios de más", () => {
    expect(parseNames("  Juan  \n\n\n   \n  Seba ")).toEqual(["Juan", "Seba"]);
  });

  it("acepta una sola línea separada por comas", () => {
    expect(parseNames("Juan, Seba , Nico")).toEqual(["Juan", "Seba", "Nico"]);
  });

  it("no repite nombres ni entre sí ni contra los ya cargados", () => {
    expect(parseNames("Juan\nJUAN\nSeba", ["seba", "Pedro"])).toEqual(["Juan"]);
  });

  it("corta la aclaración que viene después del guion", () => {
    expect(parseNames("Juan - va seguro\nSeba — capaz")).toEqual(["Juan", "Seba"]);
  });

  it("con texto vacío no devuelve nada", () => {
    expect(parseNames("   \n  ")).toEqual([]);
  });
});

describe("nombres para la cancha", () => {
  it("abrevia nombre y apellido", () => {
    expect(shortName("Juan Pérez")).toBe("J. Pérez");
    expect(shortName("Juan Martín Pérez")).toBe("J. Pérez");
    expect(shortName("Seba")).toBe("Seba");
  });
});

describe("sortByLine", () => {
  it("ordena arquero, defensa, medio y ataque, y por nivel dentro de cada línea", () => {
    const players: Player[] = [
      { id: "1", name: "Delantero flojo", level: 2, position: "DEL" },
      { id: "2", name: "Arquero", level: 3, position: "POR" },
      { id: "3", name: "Defensor crack", level: 5, position: "DEF" },
      { id: "4", name: "Defensor común", level: 3, position: "DEF" },
    ];

    expect(sortByLine(players).map((p) => p.id)).toEqual(["2", "3", "4", "1"]);
  });
});
