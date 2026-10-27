import type { Route, User, ViewProfile } from "../models/types.js";
import { Cache, isObject } from "./cache.js";

export interface AppState {
  user: User | null;
  route: Route;
  view: ViewProfile;
  year: number;
  month: number;
}

interface Prefs {
  view: ViewProfile;
  month: number;
}

function isPrefs(value: unknown): value is Prefs {
  return (
    isObject(value) &&
    (value.view === "ingrid" || value.view === "felipp" || value.view === "joint") &&
    typeof value.month === "number" &&
    value.month >= 1 &&
    value.month <= 12
  );
}

type Listener = (state: AppState, changed: Array<keyof AppState>) => void;

const APP_YEAR = 2026;

function initialMonth(): number {
  const now = new Date();
  return now.getFullYear() === APP_YEAR ? now.getMonth() + 1 : 1;
}

/** Estado global observavel da aplicacao (camada de estado do cliente). */
class Store {
  private state: AppState;
  private listeners = new Set<Listener>();

  constructor() {
    const prefs = Cache.read("prefs", isPrefs);
    this.state = {
      user: null,
      route: "dashboard",
      view: prefs?.view ?? "joint",
      year: APP_YEAR,
      month: prefs?.month ?? initialMonth(),
    };
  }

  get(): Readonly<AppState> {
    return this.state;
  }

  set(patch: Partial<AppState>): void {
    const changed = (Object.keys(patch) as Array<keyof AppState>).filter((k) => patch[k] !== this.state[k]);
    if (changed.length === 0) return;
    this.state = { ...this.state, ...patch };
    Cache.write("prefs", { view: this.state.view, month: this.state.month });
    this.listeners.forEach((l) => l(this.state, changed));
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const store = new Store();
export const APP_BASE_YEAR = APP_YEAR;
