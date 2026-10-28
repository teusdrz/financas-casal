/**
 * Tipos de dominio compartilhados pelas camadas Model, Service e Controller.
 */

export type ProfileId = "ingrid" | "felipp";

export const PROFILE_IDS: readonly ProfileId[] = ["ingrid", "felipp"];

export const PROFILE_NAMES: Record<ProfileId, string> = {
  ingrid: "Ingrid",
  felipp: "Felipp",
};

/** Secoes da estrutura financeira mensal de cada perfil. */
export type EntrySection =
  | "income"
  | "fixed"
  | "emergency"
  | "investment"
  | "variable"
  | "card";

export const ENTRY_SECTIONS: readonly EntrySection[] = [
  "income",
  "fixed",
  "emergency",
  "investment",
  "variable",
  "card",
];

export interface User {
  id: number;
  username: string;
  displayName: string;
  profileId: ProfileId;
  feedToken: string;
  avatarDataUrl: string | null;
}

export interface UserRecord extends User {
  passwordHash: string;
}

export interface Entry {
  id: number;
  profileId: ProfileId;
  year: number;
  month: number; // 1..12
  section: EntrySection;
  description: string;
  amount: number; // valor em reais (2 casas)
  dueDay: number | null; // dia de vencimento (1..31) quando aplicavel
  paid: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EntryInput = Omit<Entry, "id" | "createdAt" | "updatedAt">;

export type EventOwner = ProfileId | "shared";

export type EventCategory = "bill" | "card" | "appointment" | "meeting" | "health" | "other";

export const EVENT_CATEGORIES: readonly EventCategory[] = [
  "bill",
  "card",
  "appointment",
  "meeting",
  "health",
  "other",
];

export const EVENT_OWNERS: readonly EventOwner[] = ["ingrid", "felipp", "shared"];

export interface CalendarEvent {
  id: number;
  owner: EventOwner;
  title: string;
  date: string; // YYYY-MM-DD
  time: string | null; // HH:MM ou null para dia inteiro
  category: EventCategory;
  amount: number | null;
  notes: string;
  alarmMinutes: number; // minutos antes do evento para o alarme do iPhone
  done: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CalendarEventInput = Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">;

export interface SectionTotals {
  income: number;
  fixed: number;
  emergency: number;
  investment: number;
  variable: number;
  card: number;
}

export interface MonthSummary {
  profileId: ProfileId | "joint";
  year: number;
  month: number;
  totals: SectionTotals;
  committed: number;
  balance: number;
  savingsRate: number; // (reserva + investimentos) / renda
  commitmentRate: number; // (fixos + variaveis + cartoes) / renda
}

export interface BackupPayload {
  app: "financas-casal";
  version: 1;
  exportedAt: string;
  entries: Entry[];
  events: CalendarEvent[];
}

/** Item exibido no calendario: evento proprio ou vencimento derivado de um lancamento financeiro. */
export interface CalendarItem extends CalendarEvent {
  source: "event" | "entry" | "google";
  entryId: number | null;
}
