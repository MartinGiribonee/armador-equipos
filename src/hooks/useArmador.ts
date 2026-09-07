"use client";

import { useMemo, useSyncExternalStore } from "react";
import * as store from "@/lib/store";
import type { Position } from "@/lib/types";

export { BENCH_ID } from "@/lib/store";
export type { Step } from "@/lib/store";

/**
 * Punto único de suscripción al store. Las acciones son funciones de módulo,
 * así que su identidad es estable y no hace falta memorizarlas.
 */
export function useArmador() {
  const state = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot,
  );

  // En el render de hidratación vale `false`; después, `true`. Sirve para no
  // pintar el plantel guardado hasta que el HTML del servidor ya se acopló.
  const hydrated = useSyncExternalStore(
    store.subscribe,
    store.isHydratedSnapshot,
    store.isHydratedServerSnapshot,
  );

  const positionTally = useMemo(() => {
    const tally: Record<Position, number> = { POR: 0, DEF: 0, MED: 0, DEL: 0 };
    for (const p of state.squad) tally[p.position] += 1;
    return tally;
  }, [state.squad]);

  return {
    hydrated,
    step: state.step,
    squad: state.squad,
    setup: state.setup,
    match: state.match,
    bench: state.bench,
    positionTally,
    canGenerate: state.squad.length >= 2 && state.setup.teamCount >= 2,
    setStep: store.setStep,
    setSetup: store.setSetup,
    addNames: store.addNames,
    updatePlayer: store.updatePlayer,
    removePlayer: store.removePlayer,
    clearSquad: store.clearSquad,
    generate: store.generate,
    resetMatch: store.resetMatch,
    movePlayer: store.movePlayer,
    updateTeam: store.updateTeam,
  };
}

export type Armador = ReturnType<typeof useArmador>;
