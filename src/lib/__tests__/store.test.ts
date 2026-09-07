// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * El store se hidrata al importarse, así que cada caso limpia `localStorage` y
 * vuelve a importarlo con `resetModules` para arrancar de cero.
 */
async function freshStore() {
  window.localStorage.clear();
  vi.resetModules();
  return import("../store");
}

type Store = Awaited<ReturnType<typeof freshStore>>;

/** Carga un plantel completo con puestos y niveles conocidos. */
function seed(store: Store) {
  store.addNames("Seba\nDami\nJuan\nPau\nFede\nLuca\nAna\nCoco\nNico\nEma");
  const squad = store.getSnapshot().squad;
  const setup: Array<[number, "POR" | "DEF" | "MED" | "DEL", number]> = [
    [0, "POR", 3],
    [1, "POR", 3],
    [2, "DEF", 5],
    [3, "DEF", 4],
    [4, "DEF", 2],
    [5, "DEF", 1],
    [6, "MED", 4],
    [7, "MED", 3],
    [8, "DEL", 5],
    [9, "DEL", 2],
  ];
  for (const [index, position, level] of setup) {
    store.updatePlayer(squad[index].id, { position, level });
  }
}

describe("store — plantel", () => {
  let store: Store;
  beforeEach(async () => {
    store = await freshStore();
  });

  it("arranca vacío y en el paso 1", () => {
    expect(store.getSnapshot().squad).toEqual([]);
    expect(store.getSnapshot().step).toBe(1);
  });

  it("agrega, edita y elimina jugadores", () => {
    expect(store.addNames("Juan\nSeba")).toBe(2);
    const [juan] = store.getSnapshot().squad;

    store.updatePlayer(juan.id, { level: 5, position: "DEL" });
    expect(store.getSnapshot().squad[0]).toMatchObject({ level: 5, position: "DEL" });

    store.removePlayer(juan.id);
    expect(store.getSnapshot().squad.map((p) => p.name)).toEqual(["Seba"]);
  });

  it("avisa a los suscriptores en cada cambio", () => {
    let calls = 0;
    const unsubscribe = store.subscribe(() => (calls += 1));

    store.addNames("Juan");
    store.setStep(2);
    expect(calls).toBe(2);

    unsubscribe();
    store.addNames("Seba");
    expect(calls).toBe(2);
  });

  it("persiste el plantel en localStorage", async () => {
    store.addNames("Juan\nSeba");
    vi.resetModules();

    // Recargar el módulo simula volver a abrir la app.
    const reloaded = await import("../store");
    expect(reloaded.getSnapshot().squad.map((p) => p.name)).toEqual(["Juan", "Seba"]);
  });
});

describe("store — generar y ajustar a mano", () => {
  let store: Store;
  beforeEach(async () => {
    store = await freshStore();
    seed(store);
    store.setSetup({ teamCount: 2, formatId: "5v5", mode: "auto" });
    store.generate();
  });

  it("arma los equipos según el formato elegido", () => {
    const { match, bench } = store.getSnapshot();
    expect(match).not.toBeNull();
    expect(match!.teams).toHaveLength(2);
    expect(match!.teams[0].players).toHaveLength(5);
    expect(match!.teams[1].players).toHaveLength(5);
    expect(bench).toHaveLength(0);
  });

  it("le asigna a cada equipo una formación que le calza", () => {
    for (const team of store.getSnapshot().match!.teams) {
      const total = team.formation.split("-").reduce((a, b) => a + Number(b), 0);
      expect(total + 1).toBe(team.players.length);
    }
  });

  it("mueve un jugador de un equipo al otro", () => {
    const before = store.getSnapshot().match!;
    const player = before.teams[0].players[0];

    store.movePlayer(player.id, before.teams[1].id);

    const after = store.getSnapshot().match!;
    expect(after.teams[0].players.map((p) => p.id)).not.toContain(player.id);
    expect(after.teams[1].players.map((p) => p.id)).toContain(player.id);
    expect(after.teams[0].players).toHaveLength(4);
    expect(after.teams[1].players).toHaveLength(6);
  });

  it("intercambia dos jugadores sin cambiar el tamaño de los equipos", () => {
    const before = store.getSnapshot().match!;
    const a = before.teams[0].players[0];
    const b = before.teams[1].players[0];

    store.movePlayer(a.id, before.teams[1].id, b.id);

    const after = store.getSnapshot().match!;
    expect(after.teams[0].players).toHaveLength(5);
    expect(after.teams[1].players).toHaveLength(5);
    expect(after.teams[0].players.map((p) => p.id)).toContain(b.id);
    expect(after.teams[1].players.map((p) => p.id)).toContain(a.id);
  });

  it("manda un jugador al banco y lo trae de vuelta", () => {
    const before = store.getSnapshot().match!;
    const player = before.teams[0].players[0];

    store.movePlayer(player.id, "bench");
    expect(store.getSnapshot().bench.map((p) => p.id)).toContain(player.id);
    expect(store.getSnapshot().match!.teams[0].players).toHaveLength(4);

    store.movePlayer(player.id, before.teams[0].id);
    expect(store.getSnapshot().bench).toHaveLength(0);
    expect(store.getSnapshot().match!.teams[0].players).toHaveLength(5);
  });

  it("actualiza la formación cuando el equipo cambia de tamaño", () => {
    const before = store.getSnapshot().match!;
    store.movePlayer(before.teams[0].players[0].id, before.teams[1].id);

    const after = store.getSnapshot().match!;
    const total = after.teams[1].formation
      .split("-")
      .reduce((a, b) => a + Number(b), 0);
    expect(total + 1).toBe(6);
  });

  it("regenerar respeta el nombre y los colores que puso el usuario", () => {
    const teamId = store.getSnapshot().match!.teams[0].id;
    store.updateTeam(teamId, { name: "Los Pibes", primaryColor: "#123456" });

    store.generate();

    const team = store.getSnapshot().match!.teams[0];
    expect(team.name).toBe("Los Pibes");
    expect(team.primaryColor).toBe("#123456");
  });

  it("editar el nivel de un jugador se refleja en el equipo ya armado", () => {
    const player = store.getSnapshot().match!.teams[0].players[0];
    store.updatePlayer(player.id, { level: 1, name: "Renombrado" });

    const inTeam = store
      .getSnapshot()
      .match!.teams[0].players.find((p) => p.id === player.id);
    expect(inTeam).toMatchObject({ level: 1, name: "Renombrado" });
  });

  it("borrar a un jugador lo saca también del equipo", () => {
    const player = store.getSnapshot().match!.teams[0].players[0];
    store.removePlayer(player.id);

    expect(store.getSnapshot().match!.teams[0].players).toHaveLength(4);
    expect(store.getSnapshot().squad.map((p) => p.id)).not.toContain(player.id);
  });

  it("vaciar el plantel borra el partido y vuelve al paso 1", () => {
    store.setStep(3);
    store.clearSquad();

    expect(store.getSnapshot()).toMatchObject({ squad: [], match: null, step: 1 });
  });

  it("al reabrir la app vuelve el partido y arranca en el paso 2", async () => {
    vi.resetModules();
    const reloaded = await import("../store");

    expect(reloaded.getSnapshot().match).not.toBeNull();
    expect(reloaded.getSnapshot().match!.teams).toHaveLength(2);
    expect(reloaded.getSnapshot().step).toBe(2);
  });

  it("los jugadores que se suman después van al banco", () => {
    store.addNames("Tarde");

    const agregado = store.getSnapshot().bench.find((p) => p.name === "Tarde");
    expect(agregado).toBeDefined();
    // Y siguen estando en el plantel, no se duplican.
    expect(store.getSnapshot().squad.filter((p) => p.name === "Tarde")).toHaveLength(1);
  });
});

describe("store — armado manual", () => {
  let store: Store;
  beforeEach(async () => {
    store = await freshStore();
    seed(store);
    store.setSetup({ teamCount: 2, formatId: "5v5", mode: "manual" });
  });

  it("crea equipos vacíos con todo el plantel sin asignar", () => {
    store.createEmptyTeams();

    const { match, bench } = store.getSnapshot();
    expect(match!.teams).toHaveLength(2);
    expect(match!.teams[0].players).toHaveLength(0);
    expect(match!.teams[1].players).toHaveLength(0);
    expect(bench).toHaveLength(10);
  });

  it("permite repartir a dedo desde el banco", () => {
    store.createEmptyTeams();
    const [a, b, c] = store.getSnapshot().bench;
    const teamId = store.getSnapshot().match!.teams[0].id;

    store.movePlayer(a.id, teamId);
    store.movePlayer(b.id, teamId);
    store.movePlayer(c.id, teamId);

    expect(store.getSnapshot().match!.teams[0].players.map((p) => p.id)).toEqual([
      a.id,
      b.id,
      c.id,
    ]);
    expect(store.getSnapshot().bench).toHaveLength(7);
  });

  it("vaciar equipos conserva nombres y colores puestos a mano", () => {
    store.createEmptyTeams();
    const teamId = store.getSnapshot().match!.teams[0].id;
    store.updateTeam(teamId, { name: "Los Pibes", primaryColor: "#123456" });
    store.movePlayer(store.getSnapshot().bench[0].id, teamId);

    store.createEmptyTeams();

    const team = store.getSnapshot().match!.teams[0];
    expect(team.name).toBe("Los Pibes");
    expect(team.primaryColor).toBe("#123456");
    expect(team.players).toHaveLength(0);
    expect(store.getSnapshot().bench).toHaveLength(10);
  });

  it("cambiar a automático y generar reparte sobre los mismos equipos", () => {
    store.createEmptyTeams();
    const idsAntes = store.getSnapshot().match!.teams.map((t) => t.id);

    store.setSetup({ teamCount: 2, formatId: "5v5", mode: "auto" });
    store.generate();

    expect(store.getSnapshot().match!.teams.map((t) => t.id)).toEqual(idsAntes);
    expect(store.getSnapshot().match!.teams[0].players).toHaveLength(5);
  });
});

describe("store — ubicación manual en la cancha", () => {
  let store: Store;
  let teamId: string;
  let playerId: string;

  beforeEach(async () => {
    store = await freshStore();
    seed(store);
    store.setSetup({ teamCount: 2, formatId: "5v5", mode: "auto" });
    store.generate();
    const team = store.getSnapshot().match!.teams[0];
    teamId = team.id;
    playerId = team.players[0].id;
  });

  const layoutOf = (id = teamId) =>
    store.getSnapshot().match!.teams.find((t) => t.id === id)!.layout;

  it("guarda la posición de un jugador", () => {
    store.setPlayerSpot(teamId, playerId, { x: 30, y: 70 });

    expect(layoutOf()).toEqual({ [playerId]: { x: 30, y: 70 } });
  });

  it("recorta las coordenadas al campo de juego", () => {
    store.setPlayerSpot(teamId, playerId, { x: -40, y: 180 });

    expect(layoutOf()![playerId]).toEqual({ x: 0, y: 100 });
  });

  it("acumula varias posiciones sin pisar las anteriores", () => {
    const otro = store.getSnapshot().match!.teams[0].players[1].id;
    store.setPlayerSpot(teamId, playerId, { x: 10, y: 10 });
    store.setPlayerSpot(teamId, otro, { x: 90, y: 90 });

    expect(Object.keys(layoutOf()!)).toHaveLength(2);
  });

  it("resetLayout devuelve el equipo a la formación", () => {
    store.setPlayerSpot(teamId, playerId, { x: 30, y: 70 });
    store.resetLayout(teamId);

    expect(layoutOf()).toBeUndefined();
  });

  it("cambiar de formación descarta las posiciones manuales", () => {
    store.setPlayerSpot(teamId, playerId, { x: 30, y: 70 });
    store.setFormation(teamId, "1-2-1");

    expect(layoutOf()).toBeUndefined();
    expect(store.getSnapshot().match!.teams[0].formation).toBe("1-2-1");
  });

  it("un jugador que se va del equipo pierde su posición", () => {
    const otro = store.getSnapshot().match!.teams[0].players[1].id;
    store.setPlayerSpot(teamId, playerId, { x: 30, y: 70 });
    store.setPlayerSpot(teamId, otro, { x: 60, y: 40 });

    store.movePlayer(playerId, store.getSnapshot().match!.teams[1].id);

    expect(layoutOf()).toEqual({ [otro]: { x: 60, y: 40 } });
  });

  it("borrar a un jugador limpia su posición", () => {
    store.setPlayerSpot(teamId, playerId, { x: 30, y: 70 });
    store.removePlayer(playerId);

    expect(layoutOf()).toBeUndefined();
  });

  it("las posiciones sobreviven al recargar la app", async () => {
    store.setPlayerSpot(teamId, playerId, { x: 30, y: 70 });
    vi.resetModules();
    const reloaded = await import("../store");

    const team = reloaded.getSnapshot().match!.teams.find((t) => t.id === teamId)!;
    expect(team.layout).toEqual({ [playerId]: { x: 30, y: 70 } });
  });

  it("descarta del storage coordenadas corruptas", async () => {
    store.setPlayerSpot(teamId, playerId, { x: 30, y: 70 });

    const key = "armador:match:v1";
    const stored = JSON.parse(window.localStorage.getItem(key)!);
    stored.match.teams[0].layout = { [playerId]: { x: 999, y: "arriba" } };
    window.localStorage.setItem(key, JSON.stringify(stored));

    vi.resetModules();
    const reloaded = await import("../store");
    expect(reloaded.getSnapshot().match!.teams[0].layout).toBeUndefined();
  });
});

describe("store — resultados y aprendizaje", () => {
  let store: Store;

  beforeEach(async () => {
    store = await freshStore();
    seed(store);
    store.setSetup({ teamCount: 2, formatId: "5v5", mode: "auto" });
    store.generate();
  });

  /** Carga un resultado sobre el partido en curso. */
  function cargar(golesA: number, golesB: number, extra: { best?: string; worst?: string } = {}) {
    const match = store.getSnapshot().match!;
    return store.saveResult({
      goals: { [match.teams[0].id]: golesA, [match.teams[1].id]: golesB },
      ...extra,
    });
  }

  it("guardar el resultado suma la fecha y libera los equipos", () => {
    const guardado = cargar(5, 2);

    expect(guardado).not.toBeNull();
    expect(store.getSnapshot().results).toHaveLength(1);
    expect(store.getSnapshot().match).toBeNull();
    expect(store.getSnapshot().bench).toHaveLength(0);
    // El plantel queda intacto para la próxima fecha.
    expect(store.getSnapshot().squad).toHaveLength(10);
  });

  it("los ganadores suben de nivel y los perdedores bajan", () => {
    const antes = store.getSnapshot().match!;
    const ganador = antes.teams[0].players[0].id;
    const perdedor = antes.teams[1].players[0].id;

    cargar(6, 1);

    const ratings = store.getSnapshot().ratings;
    expect(ratings.get(ganador)!.rating).toBeGreaterThan(1500);
    expect(ratings.get(perdedor)!.rating).toBeLessThan(1500);
    expect(ratings.get(ganador)!.matches).toBe(1);
  });

  it("solo acepta destacados que hayan jugado", () => {
    const match = store.getSnapshot().match!;
    const jugo = match.teams[0].players[0].id;

    const guardado = cargar(3, 2, { best: jugo, worst: "no-existe" });

    expect(guardado!.result.best).toBe(jugo);
    expect(guardado!.result.worst).toBeUndefined();
  });

  it("devuelve el antes y el después del rating", () => {
    const jugador = store.getSnapshot().match!.teams[0].players[0].id;
    const guardado = cargar(7, 0)!;

    expect(guardado.before.get(jugador)!.rating).toBe(1500);
    expect(guardado.after.get(jugador)!.rating).toBeGreaterThan(1500);
  });

  it("el historial y el rating sobreviven al recargar la app", async () => {
    const jugador = store.getSnapshot().match!.teams[0].players[0].id;
    cargar(6, 1);
    const esperado = store.getSnapshot().ratings.get(jugador)!.rating;

    vi.resetModules();
    const reloaded = await import("../store");

    expect(reloaded.getSnapshot().results).toHaveLength(1);
    expect(reloaded.getSnapshot().ratings.get(jugador)!.rating).toBeCloseTo(esperado, 9);
  });

  it("borrar una fecha recalcula el rating sin ella", () => {
    const jugador = store.getSnapshot().match!.teams[0].players[0].id;
    const guardado = cargar(8, 0)!;
    expect(store.getSnapshot().ratings.get(jugador)!.rating).toBeGreaterThan(1500);

    store.deleteResult(guardado.result.id);

    expect(store.getSnapshot().results).toHaveLength(0);
    expect(store.getSnapshot().ratings.get(jugador)!.rating).toBe(1500);
    expect(store.getSnapshot().ratings.get(jugador)!.matches).toBe(0);
  });

  it("borrar a un jugador del plantel recalcula el rating del resto", () => {
    cargar(6, 1);
    const antes = store.getSnapshot().ratings.size;

    store.removePlayer(store.getSnapshot().squad[0].id);

    expect(store.getSnapshot().ratings.size).toBe(antes - 1);
    // El historial no se toca: el resultado sigue guardado tal cual.
    expect(store.getSnapshot().results).toHaveLength(1);
  });

  it("el balanceador usa el nivel aprendido, no el cargado a mano", () => {
    const jugador = store.getSnapshot().squad[0];
    expect(store.levelOf(jugador)).toBe(3);

    cargar(9, 0);

    const despues = store.levelOf(jugador);
    // Jugó, así que su nivel efectivo ya no es el entero que cargó el usuario.
    expect(despues).not.toBe(3);
    expect(Number.isInteger(despues)).toBe(false);
  });

  it("sin partido abierto no se puede guardar un resultado", () => {
    cargar(3, 3);
    expect(store.saveResult({ goals: {} })).toBeNull();
  });
});

describe("store — limpiar", () => {
  let store: Store;

  beforeEach(async () => {
    store = await freshStore();
    seed(store);
    store.setSetup({ teamCount: 2, formatId: "5v5", mode: "auto" });
    store.generate();
    const match = store.getSnapshot().match!;
    store.saveResult({
      goals: { [match.teams[0].id]: 5, [match.teams[1].id]: 2 },
    });
    store.generate();
  });

  it("vaciar el plantel se lleva también el historial", () => {
    expect(store.getSnapshot().results).toHaveLength(1);

    store.clearSquad();

    expect(store.getSnapshot()).toMatchObject({
      squad: [],
      match: null,
      bench: [],
      results: [],
      step: 1,
    });
    expect(store.getSnapshot().ratings.size).toBe(0);
  });

  it("se puede vaciar el plantel conservando el historial", () => {
    store.clearSquad({ keepHistory: true });

    expect(store.getSnapshot().squad).toEqual([]);
    expect(store.getSnapshot().results).toHaveLength(1);
  });

  it("el plantel vaciado no vuelve al recargar la app", async () => {
    store.clearSquad();
    vi.resetModules();
    const reloaded = await import("../store");

    expect(reloaded.getSnapshot().squad).toEqual([]);
    expect(reloaded.getSnapshot().results).toEqual([]);
    expect(reloaded.getSnapshot().match).toBeNull();
    expect(reloaded.getSnapshot().step).toBe(1);
  });

  it("borrar solo el historial deja el plantel y los niveles cargados a mano", () => {
    const antes = store.getSnapshot().squad.length;
    const jugador = store.getSnapshot().squad.find((p) => p.level === 5)!;

    store.clearHistory();

    expect(store.getSnapshot().squad).toHaveLength(antes);
    expect(store.getSnapshot().results).toEqual([]);
    // Vuelve a valer el nivel cargado a mano, sin aprendizaje encima.
    expect(store.levelOf(jugador)).toBe(5);
    expect(store.getSnapshot().ratings.get(jugador.id)!.matches).toBe(0);
  });

  it("borrar el historial no deshace los equipos ya armados", () => {
    const teams = store.getSnapshot().match!.teams.map((t) => t.players.length);

    store.clearHistory();

    expect(store.getSnapshot().match).not.toBeNull();
    expect(store.getSnapshot().match!.teams.map((t) => t.players.length)).toEqual(teams);
  });
});

describe("store — nombres de equipo", () => {
  let store: Store;

  beforeEach(async () => {
    store = await freshStore();
    seed(store);
    store.setSetup({ teamCount: 2, formatId: "5v5", mode: "auto" });
    store.generate();
  });

  const teamNames = () => store.getSnapshot().match!.teams.map((t) => t.name);

  it("arranca con los nombres por defecto", () => {
    expect(teamNames()).toEqual(["Rojos", "Azules"]);
  });

  it("renombrar un equipo lo guarda como identidad durable", () => {
    const teamId = store.getSnapshot().match!.teams[0].id;
    store.updateTeam(teamId, { name: "Los Pibes" });

    expect(teamNames()[0]).toBe("Los Pibes");
    expect(store.getSnapshot().teamPresets[0].name).toBe("Los Pibes");
  });

  it("el nombre sobrevive a cerrar el partido y armar el siguiente", () => {
    const match = store.getSnapshot().match!;
    store.updateTeam(match.teams[0].id, { name: "Los Pibes" });
    store.updateTeam(match.teams[1].id, { name: "Los Viejos" });

    // Se juega la fecha: el partido se cierra.
    store.saveResult({
      goals: { [match.teams[0].id]: 4, [match.teams[1].id]: 2 },
    });
    expect(store.getSnapshot().match).toBeNull();

    store.generate();

    expect(teamNames()).toEqual(["Los Pibes", "Los Viejos"]);
  });

  it("los colores también quedan guardados", () => {
    const teamId = store.getSnapshot().match!.teams[0].id;
    store.updateTeam(teamId, { primaryColor: "#123456", secondaryColor: "#abcdef" });

    store.resetMatch();
    store.generate();

    expect(store.getSnapshot().match!.teams[0]).toMatchObject({
      primaryColor: "#123456",
      secondaryColor: "#abcdef",
    });
  });

  it("sobrevive al recargar la app", async () => {
    store.updateTeam(store.getSnapshot().match!.teams[0].id, { name: "Los Pibes" });

    vi.resetModules();
    const reloaded = await import("../store");

    expect(reloaded.getSnapshot().teamPresets[0].name).toBe("Los Pibes");
    expect(reloaded.getSnapshot().match!.teams[0].name).toBe("Los Pibes");
  });

  it("renombrar el segundo equipo no pisa al primero", () => {
    const match = store.getSnapshot().match!;
    store.updateTeam(match.teams[1].id, { name: "Los Viejos" });

    expect(store.getSnapshot().teamPresets[0].name).toBe("Rojos");
    expect(store.getSnapshot().teamPresets[1].name).toBe("Los Viejos");
  });

  it("los nombres se mantienen al armar los equipos a mano", () => {
    store.updateTeam(store.getSnapshot().match!.teams[0].id, { name: "Los Pibes" });

    store.setSetup({ teamCount: 2, formatId: "5v5", mode: "manual" });
    store.createEmptyTeams();

    expect(teamNames()[0]).toBe("Los Pibes");
  });

  it("cambiar la formación no toca la identidad del equipo", () => {
    const teamId = store.getSnapshot().match!.teams[0].id;
    store.updateTeam(teamId, { name: "Los Pibes" });

    store.setFormation(teamId, "1-2-1");

    expect(store.getSnapshot().teamPresets[0]).toMatchObject({ name: "Los Pibes" });
    expect(store.getSnapshot().teamPresets[0]).not.toHaveProperty("formation");
  });

  it("se puede volver a los nombres por defecto", () => {
    const match = store.getSnapshot().match!;
    store.updateTeam(match.teams[0].id, { name: "Los Pibes" });
    store.updateTeam(match.teams[1].id, { name: "Los Viejos" });

    store.resetTeamPresets();

    expect(store.getSnapshot().teamPresets).toEqual([]);
    expect(teamNames()).toEqual(["Rojos", "Azules"]);
  });

  it("con más equipos, los que no se tocaron usan el default", () => {
    store.updateTeam(store.getSnapshot().match!.teams[0].id, { name: "Los Pibes" });

    store.setSetup({ teamCount: 3, formatId: "libre", mode: "auto" });
    store.generate();

    expect(teamNames()).toEqual(["Los Pibes", "Azules", "Blancos"]);
  });
});
