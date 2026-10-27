import { EntryModel } from "../models/EntryModel";
import { EventModel } from "../models/EventModel";
import type { CalendarItem, Entry, EventOwner, ProfileId } from "../types/domain";
import { PROFILE_NAMES } from "../types/domain";
import { daysInMonth, isoDate } from "../utils/helpers";

/**
 * Une eventos cadastrados no calendario com os vencimentos dos lancamentos financeiros
 * (gastos fixos e cartoes que possuem "dia de vencimento").
 */

export function entryToItem(entry: Entry): CalendarItem | null {
  if (entry.dueDay === null || (entry.section !== "fixed" && entry.section !== "card")) {
    return null;
  }
  const day = Math.min(entry.dueDay, daysInMonth(entry.year, entry.month));
  return {
    id: -entry.id,
    entryId: entry.id,
    source: "entry",
    owner: entry.profileId,
    title: `Vencimento: ${entry.description} (${PROFILE_NAMES[entry.profileId]})`,
    date: isoDate(entry.year, entry.month, day),
    time: null,
    category: entry.section === "card" ? "card" : "bill",
    amount: entry.amount,
    notes: entry.paid ? "Marcado como pago no controle financeiro." : "Lancamento do controle financeiro.",
    alarmMinutes: 1440,
    done: entry.paid,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

function monthsBetween(from: string, to: string): Array<{ year: number; month: number }> {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  const list: Array<{ year: number; month: number }> = [];
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    list.push({ year: y, month: m });
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return list;
}

export const CalendarService = {
  items(from: string, to: string, profiles: ProfileId[]): CalendarItem[] {
    const owners: EventOwner[] = [...profiles, "shared"];
    const events: CalendarItem[] = EventModel.list({ from, to, owners }).map((e) => ({ ...e, source: "event", entryId: null }));
    const derived: CalendarItem[] = [];
    for (const period of monthsBetween(from, to)) {
      for (const entry of EntryModel.list(period)) {
        if (!profiles.includes(entry.profileId)) continue;
        const item = entryToItem(entry);
        if (item && item.date >= from && item.date <= to) {
          derived.push(item);
        }
      }
    }
    return [...events, ...derived].sort((a, b) =>
      a.date === b.date ? (a.time ?? "00:00").localeCompare(b.time ?? "00:00") : a.date.localeCompare(b.date)
    );
  },
};
