export const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export const MONTHS_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"] as const;
export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"] as const;

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatMoney(value: number): string {
  return money.format(value);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1).replace(".", ",")}%`;
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function todayIso(): string {
  const d = new Date();
  return isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  return isoDate(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function formatDateLong(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
}

export function formatDateShort(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${pad2(d)}/${pad2(m)}`;
}

/** Converte texto digitado ("1.234,56" ou "1234.56") em numero. */
export function parseMoney(text: string): number | null {
  const clean = text.replace(/[R$\s]/g, "");
  if (clean === "") return 0;
  // "1.234,56" e "1.400" (milhar com ponto) ou "1234.56" (ponto decimal)
  const thousandsOnly = /^\d{1,3}(\.\d{3})+$/.test(clean);
  const normalized = clean.includes(",") || thousandsOnly ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
}

export function moneyInputValue(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
