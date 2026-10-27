import type {
  CalendarItem,
  Entry,
  EntryInput,
  EventInput,
  MonthSummaryResponse,
  ProfileId,
  User,
  ViewProfile,
  YearSummaryResponse,
} from "../models/types.js";

export class ApiError extends Error {
  constructor(public readonly status: number, message: string, public readonly details: string[] = []) {
    super(message);
    this.name = "ApiError";
  }
}

/** Disparado quando a sessao expira, para o app voltar a tela de login. */
export const UNAUTHORIZED_EVENT = "fc:unauthorized";

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Sem conexao com o servidor.");
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const payload = (data ?? {}) as { error?: string; details?: string[] };
    if (response.status === 401 && !url.endsWith("/auth/login") && !url.endsWith("/auth/me")) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(response.status, payload.error ?? `Erro ${response.status}`, payload.details ?? []);
  }
  return data as T;
}

export const Api = {
  login: (username: string, password: string) => request<{ user: User }>("POST", "/api/auth/login", { username, password }),
  logout: () => request<{ ok: boolean }>("POST", "/api/auth/logout"),
  me: () => request<{ user: User }>("GET", "/api/auth/me"),
  session: () => request<{ user: User | null }>("GET", "/api/auth/session"),
  changePassword: (current: string, next: string) => request<{ ok: boolean }>("POST", "/api/auth/password", { current, next }),
  regenerateFeed: () => request<{ feedToken: string }>("POST", "/api/auth/feed-token"),
  googleCalendarStatus: () =>
    request<{
      configured: boolean;
      accounts: Record<ProfileId, { connected: boolean; accountEmail: string | null }>;
    }>("GET", "/api/calendar/google/status"),
  syncGoogleCalendar: () => request<{ ok: boolean }>("POST", "/api/calendar/google/sync"),

  entries: (year: number, month: number) => request<{ entries: Entry[] }>("GET", `/api/entries?year=${year}&month=${month}`),
  createEntry: (input: EntryInput) => request<{ entry: Entry }>("POST", "/api/entries", input),
  updateEntry: (id: number, input: EntryInput) => request<{ entry: Entry }>("PUT", `/api/entries/${id}`, input),
  deleteEntry: (id: number) => request<void>("DELETE", `/api/entries/${id}`),
  copyMonth: (profileId: ProfileId, year: number, month: number) =>
    request<{ copied: number; from: { year: number; month: number } }>("POST", "/api/entries/copy-month", { profileId, year, month }),

  monthSummary: (year: number, month: number) => request<MonthSummaryResponse>("GET", `/api/summary/month?year=${year}&month=${month}`),
  yearSummary: (year: number) => request<YearSummaryResponse>("GET", `/api/summary/year?year=${year}`),

  events: (from: string, to: string, profile: ViewProfile) =>
    request<{ items: CalendarItem[] }>("GET", `/api/events?from=${from}&to=${to}&profile=${profile}`),
  createEvent: (input: EventInput) => request<{ event: CalendarItem }>("POST", "/api/events", input),
  updateEvent: (id: number, input: EventInput) => request<{ event: CalendarItem }>("PUT", `/api/events/${id}`, input),
  deleteEvent: (id: number) => request<void>("DELETE", `/api/events/${id}`),

  importBackup: (payload: unknown) => request<{ entries: number; events: number }>("POST", "/api/backup/import", payload),

  urls: {
    eventIcs: (id: number) => `/api/events/${id}/export.ics`,
    entryIcs: (entryId: number) => `/api/events/entry/${entryId}/export.ics`,
    rangeIcs: (from: string, to: string, profile: ViewProfile) => `/api/events/export.ics?from=${from}&to=${to}&profile=${profile}`,
    backupJson: "/api/backup/json",
    csvEntries: "/api/backup/csv/lancamentos",
    csvEvents: "/api/backup/csv/eventos",
    feed: (token: string) => `${window.location.origin}/calendar/${token}.ics`,
  },
};
