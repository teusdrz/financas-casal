import { getDatabase, Row, Params } from "../database/connection";
import type { CalendarEvent, CalendarEventInput, EventCategory, EventOwner } from "../types/domain";
import { asNullableNumber, asNumber, asString, nowIso } from "../utils/helpers";

function toEvent(row: Row): CalendarEvent {
  const time = row.time === null || row.time === undefined || row.time === "" ? null : asString(row.time);
  const amount = asNullableNumber(row.amount);
  return {
    id: asNumber(row.id),
    owner: asString(row.owner) as EventOwner,
    title: asString(row.title),
    date: asString(row.date),
    time,
    category: asString(row.category) as EventCategory,
    amount,
    notes: asString(row.notes),
    alarmMinutes: asNumber(row.alarm_minutes),
    done: asNumber(row.done) === 1,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

export interface EventFilter {
  from?: string; // YYYY-MM-DD inclusivo
  to?: string; // YYYY-MM-DD inclusivo
  owners?: EventOwner[];
}

const INSERT_SQL = `INSERT INTO events (owner, title, date, time, category, amount, notes, alarm_minutes, done, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

function insertParams(e: CalendarEventInput, createdAt: string, updatedAt: string): Params {
  return [e.owner, e.title, e.date, e.time, e.category, e.amount, e.notes, e.alarmMinutes, e.done ? 1 : 0, createdAt, updatedAt];
}

export const EventModel = {
  list(filter: EventFilter = {}): CalendarEvent[] {
    const where: string[] = [];
    const params: Params = [];
    if (filter.from) {
      where.push("date >= ?");
      params.push(filter.from);
    }
    if (filter.to) {
      where.push("date <= ?");
      params.push(filter.to);
    }
    if (filter.owners && filter.owners.length > 0) {
      where.push(`owner IN (${filter.owners.map(() => "?").join(",")})`);
      params.push(...filter.owners);
    }
    const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    return getDatabase().all(`SELECT * FROM events ${clause} ORDER BY date, COALESCE(time, '00:00'), id`, params, toEvent);
  },

  findById(id: number): CalendarEvent | null {
    return getDatabase().get("SELECT * FROM events WHERE id = ?", [id], toEvent);
  },

  create(input: CalendarEventInput): CalendarEvent {
    const now = nowIso();
    const { lastId } = getDatabase().run(INSERT_SQL, insertParams(input, now, now));
    const created = this.findById(lastId);
    if (!created) {
      throw new Error("Falha ao criar evento.");
    }
    return created;
  },

  update(id: number, input: CalendarEventInput): CalendarEvent | null {
    const { changes } = getDatabase().run(
      `UPDATE events SET owner = ?, title = ?, date = ?, time = ?, category = ?, amount = ?, notes = ?,
       alarm_minutes = ?, done = ?, updated_at = ? WHERE id = ?`,
      [input.owner, input.title, input.date, input.time, input.category, input.amount, input.notes, input.alarmMinutes, input.done ? 1 : 0, nowIso(), id]
    );
    return changes > 0 ? this.findById(id) : null;
  },

  remove(id: number): boolean {
    return getDatabase().run("DELETE FROM events WHERE id = ?", [id]).changes > 0;
  },

  replaceAll(events: CalendarEvent[]): void {
    const db = getDatabase();
    db.transaction(() => {
      db.run("DELETE FROM events");
      for (const e of events) {
        db.run(INSERT_SQL, insertParams(e, e.createdAt || nowIso(), e.updatedAt || nowIso()));
      }
    });
  },
};
