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
    store.setSetup({ teamCount: 2, formatId: "5v5" });
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
});
