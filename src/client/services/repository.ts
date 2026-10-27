import type { CalendarItem, Entry, MonthSummaryResponse, ViewProfile, YearSummaryResponse } from "../models/types.js";
import { Api, ApiError } from "./api.js";
import { Cache, isArray, isObject } from "./cache.js";

/**
 * Camada de acesso a dados do cliente: busca na API (fonte oficial, SQLite)
 * e guarda uma copia no localStorage. Se a rede cair, devolve a copia local.
 */

export interface MonthBundle {
  entries: Entry[];
  summary: MonthSummaryResponse;
  yearSummary: YearSummaryResponse;
  offline: boolean;
}

function isMonthBundle(v: unknown): v is Omit<MonthBundle, "offline"> {
  return isObject(v) && isArray(v.entries) && isObject(v.summary) && isObject(v.yearSummary);
}

function isItems(v: unknown): v is CalendarItem[] {
  return isArray(v);
}

function isNetworkError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

export const Repository = {
  async month(year: number, month: number): Promise<MonthBundle> {
    const key = `month:${year}-${month}`;
    try {
      const [entries, summary, yearSummary] = await Promise.all([Api.entries(year, month), Api.monthSummary(year, month), Api.yearSummary(year)]);
      const bundle = { entries: entries.entries, summary, yearSummary };
      Cache.write(key, bundle);
      return { ...bundle, offline: false };
    } catch (error) {
      const cached = isNetworkError(error) ? Cache.read(key, isMonthBundle) : null;
      if (cached) return { ...cached, offline: true };
      throw error;
    }
  },

  async events(from: string, to: string, view: ViewProfile): Promise<{ items: CalendarItem[]; offline: boolean }> {
    const key = `events:${from}:${to}:${view}`;
    try {
      const { items } = await Api.events(from, to, view);
      Cache.write(key, items);
      return { items, offline: false };
    } catch (error) {
      const cached = isNetworkError(error) ? Cache.read(key, isItems) : null;
      if (cached) return { items: cached, offline: true };
      throw error;
    }
  },
};

/** Filtra lancamentos conforme o perfil visualizado. */
export function filterByView(entries: Entry[], view: ViewProfile): Entry[] {
  return view === "joint" ? entries : entries.filter((e) => e.profileId === view);
}
