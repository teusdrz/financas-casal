/** Modelos do cliente (espelham os contratos da API). */

export type ProfileId = "ingrid" | "felipp";
export type ViewProfile = ProfileId | "joint";
export type EntrySection = "income" | "fixed" | "emergency" | "investment" | "variable" | "card";
export type EventOwner = ProfileId | "shared";
export type EventCategory = "bill" | "card" | "appointment" | "meeting" | "health" | "other";
export type Route = "dashboard" | "finance" | "calendar" | "settings";

export const PROFILES: readonly ProfileId[] = ["ingrid", "felipp"];
export const PROFILE_NAMES: Record<ProfileId, string> = { ingrid: "Ingrid", felipp: "Felipp" };
export const OWNER_NAMES: Record<EventOwner, string> = { ingrid: "Ingrid", felipp: "Felipp", shared: "Casal" };

export interface SectionMeta {
  id: EntrySection;
  title: string;
  subtitle: string;
  icon: string;
  hasDueDate: boolean;
  color: string;
  short: string;
}

export const SECTIONS: readonly SectionMeta[] = [
  { id: "income", title: "Salario / Renda bruta", subtitle: "Entradas do mes", icon: "income", hasDueDate: false, color: "#0E9F6E", short: "Renda" },
  { id: "fixed", title: "Gastos fixos", subtitle: "Contas recorrentes", icon: "home", hasDueDate: true, color: "#1F6FEB", short: "Fixos" },
  { id: "emergency", title: "Reserva de emergencia", subtitle: "Valor guardado no mes", icon: "shield", hasDueDate: false, color: "#7C3AED", short: "Reserva" },
  { id: "investment", title: "Investimentos", subtitle: "Ex.: Caixinha Nubank", icon: "trending", hasDueDate: false, color: "#0891B2", short: "Investimentos" },
  { id: "variable", title: "Gastos variaveis", subtitle: "Previstos para o mes", icon: "cart", hasDueDate: false, color: "#D97706", short: "Variaveis" },
  { id: "card", title: "Cartoes de credito", subtitle: "Faturas do mes", icon: "card", hasDueDate: true, color: "#DC2626", short: "Cartoes" },
];

export const CATEGORY_META: Record<EventCategory, { label: string; color: string }> = {
  bill: { label: "Conta a pagar", color: "#1F6FEB" },
  card: { label: "Fatura de cartao", color: "#DC2626" },
  appointment: { label: "Compromisso", color: "#0E9F6E" },
  meeting: { label: "Reuniao", color: "#7C3AED" },
  health: { label: "Saude / Consulta", color: "#0891B2" },
  other: { label: "Outro", color: "#64748B" },
};

export const ALARM_OPTIONS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 0, label: "No horario / no dia (09:00)" },
  { value: 15, label: "15 minutos antes" },
  { value: 60, label: "1 hora antes" },
  { value: 1440, label: "1 dia antes" },
  { value: 2880, label: "2 dias antes" },
  { value: 10080, label: "1 semana antes" },
];

export interface User {
  id: number;
  username: string;
  displayName: string;
  profileId: ProfileId;
  feedToken: string;
  avatarDataUrl: string | null;
}

export interface Entry {
  id: number;
  profileId: ProfileId;
  year: number;
  month: number;
  section: EntrySection;
  description: string;
  amount: number;
  dueDay: number | null;
  paid: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EntryInput = Omit<Entry, "id" | "createdAt" | "updatedAt">;

export interface CalendarItem {
  id: number;
  owner: EventOwner;
  title: string;
  date: string;
  time: string | null;
  category: EventCategory;
  amount: number | null;
  notes: string;
  alarmMinutes: number;
  done: boolean;
  source: "event" | "entry" | "google";
  entryId: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface EventInput {
  owner: EventOwner;
  title: string;
  date: string;
  time: string | null;
  category: EventCategory;
  amount: number | null;
  notes: string;
  alarmMinutes: number;
  done: boolean;
}

export interface SectionTotals {
  income: number;
  fixed: number;
  emergency: number;
  investment: number;
  variable: number;
  card: number;
}

export interface MonthSummary {
  profileId: ViewProfile;
  year: number;
  month: number;
  totals: SectionTotals;
  committed: number;
  balance: number;
  savingsRate: number;
  commitmentRate: number;
}

export interface MonthSummaryResponse {
  profiles: MonthSummary[];
  joint: MonthSummary;
}

export interface YearSummaryResponse {
  year: number;
  months: Array<{ month: number; profiles: MonthSummary[]; joint: MonthSummary }>;
}
