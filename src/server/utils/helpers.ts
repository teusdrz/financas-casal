/** Utilitarios puros, sem dependencia de banco ou HTTP. */

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function asString(value: unknown): string {
  return typeof value === "string" ? value : value === null || value === undefined ? "" : String(value);
}

export function asNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

export function asNullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}
