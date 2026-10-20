import { useSyncExternalStore } from "react";

// Tiny pub-sub for the few values React actually needs to render:
// loading progress, readiness and which car source is active.

export type ModelSource = "pending" | "gltf" | "procedural";

type State = {
  progress: number;
  ready: boolean;
  source: ModelSource;
  webgl: boolean;
};

let state: State = { progress: 0, ready: false, source: "pending", webgl: true };
const listeners = new Set<() => void>();

export const store = {
  get: () => state,
  set(patch: Partial<State>) {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => select(state),
    () => select(state),
  );
}
