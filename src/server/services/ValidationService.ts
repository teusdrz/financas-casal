import {
  CalendarEventInput,
  EntryInput,
  ENTRY_SECTIONS,
  EVENT_CATEGORIES,
  EVENT_OWNERS,
  EntrySection,
  EventCategory,
  EventOwner,
  PROFILE_IDS,
  ProfileId,
} from "../types/domain";
import { HttpError } from "../utils/HttpError";
import { daysInMonth } from "../utils/helpers";

type Body = Record<string, unknown>;

function asBody(value: unknown): Body {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new HttpError(400, "Corpo da requisicao invalido.");
  }
  return value as Body;
}

function isOneOf<T extends string>(value: unknown, list: readonly T[]): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) {
    return false;
  }
  const [y, m, d] = value.split("-").map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export const ValidationService = {
  profile(value: unknown): ProfileId {
    if (!isOneOf(value, PROFILE_IDS)) {
      throw new HttpError(400, "Perfil invalido. Use 'ingrid' ou 'felipp'.");
    }
    return value;
  },

  period(yearRaw: unknown, monthRaw: unknown): { year: number; month: number } {
    const year = toFiniteNumber(yearRaw);
    const month = toFiniteNumber(monthRaw);
    if (year === null || !Number.isInteger(year) || year < 2000 || year > 2100) {
      throw new HttpError(400, "Ano invalido.");
    }
    if (month === null || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new HttpError(400, "Mes invalido (1 a 12).");
    }
    return { year, month };
  },

  entry(raw: unknown): EntryInput {
    const body = asBody(raw);
    const errors: string[] = [];
    const profileId = body.profileId;
    const section = body.section;
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const amount = toFiniteNumber(body.amount);
    const year = toFiniteNumber(body.year);
    const month = toFiniteNumber(body.month);
    const dueDayRaw = body.dueDay;
    const dueDay = dueDayRaw === null || dueDayRaw === undefined || dueDayRaw === "" ? null : toFiniteNumber(dueDayRaw);

    if (!isOneOf<ProfileId>(profileId, PROFILE_IDS)) errors.push("Perfil invalido.");
    if (!isOneOf<EntrySection>(section, ENTRY_SECTIONS)) errors.push("Secao invalida.");
    if (description.length === 0 || description.length > 120) errors.push("Descricao obrigatoria (ate 120 caracteres).");
    if (amount === null || amount < 0 || amount > 100_000_000) errors.push("Valor deve ser um numero maior ou igual a zero.");
    if (year === null || !Number.isInteger(year) || year < 2000 || year > 2100) errors.push("Ano invalido.");
    if (month === null || !Number.isInteger(month) || month < 1 || month > 12) errors.push("Mes invalido.");
    if (dueDay !== null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) errors.push("Dia de vencimento deve estar entre 1 e 31.");

    if (errors.length > 0) {
      throw new HttpError(400, "Dados do lancamento invalidos.", errors);
    }
    return {
      profileId: profileId as ProfileId,
      section: section as EntrySection,
      description,
      amount: amount as number,
      year: year as number,
      month: month as number,
      dueDay,
      paid: body.paid === true,
    };
  },

  event(raw: unknown): CalendarEventInput {
    const body = asBody(raw);
    const errors: string[] = [];
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const date = typeof body.date === "string" ? body.date : "";
    const timeRaw = typeof body.time === "string" ? body.time.trim() : "";
    const amountRaw = body.amount;
    const amount = amountRaw === null || amountRaw === undefined || amountRaw === "" ? null : toFiniteNumber(amountRaw);
    const alarm = toFiniteNumber(body.alarmMinutes ?? 1440);
    const notes = typeof body.notes === "string" ? body.notes.trim() : "";

    if (!isOneOf<EventOwner>(body.owner, EVENT_OWNERS)) errors.push("Responsavel invalido.");
    if (!isOneOf<EventCategory>(body.category, EVENT_CATEGORIES)) errors.push("Categoria invalida.");
    if (title.length === 0 || title.length > 120) errors.push("Titulo obrigatorio (ate 120 caracteres).");
    if (!isValidDate(date)) errors.push("Data invalida (AAAA-MM-DD).");
    if (timeRaw !== "" && !TIME_RE.test(timeRaw)) errors.push("Horario invalido (HH:MM).");
    if (amountRaw !== null && amountRaw !== undefined && amountRaw !== "" && (amount === null || amount < 0)) errors.push("Valor invalido.");
    if (alarm === null || !Number.isInteger(alarm) || alarm < 0 || alarm > 40320) errors.push("Alarme invalido.");
    if (notes.length > 1000) errors.push("Observacoes muito longas (max. 1000).");

    if (errors.length > 0) {
      throw new HttpError(400, "Dados do evento invalidos.", errors);
    }
    return {
      owner: body.owner as EventOwner,
      category: body.category as EventCategory,
      title,
      date,
      time: timeRaw === "" ? null : timeRaw,
      amount,
      notes,
      alarmMinutes: alarm as number,
      done: body.done === true,
    };
  },
};
