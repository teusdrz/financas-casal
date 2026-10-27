import { getDatabase, Row, Params } from "../database/connection";
import type { Entry, EntryInput, EntrySection, ProfileId } from "../types/domain";
import { asNullableNumber, asNumber, asString, nowIso, roundMoney } from "../utils/helpers";

function toEntry(row: Row): Entry {
  return {
    id: asNumber(row.id),
    profileId: asString(row.profile_id) as ProfileId,
    year: asNumber(row.year),
    month: asNumber(row.month),
    section: asString(row.section) as EntrySection,
    description: asString(row.description),
    amount: roundMoney(asNumber(row.amount)),
    dueDay: asNullableNumber(row.due_day),
    paid: asNumber(row.paid) === 1,
    createdAt: asString(row.created_at),
    updatedAt: asString(row.updated_at),
  };
}

export interface EntryFilter {
  year?: number;
  month?: number;
  profileId?: ProfileId;
}

export const EntryModel = {
  list(filter: EntryFilter = {}): Entry[] {
    const where: string[] = [];
    const params: Params = [];
    if (filter.year !== undefined) {
      where.push("year = ?");
      params.push(filter.year);
    }
    if (filter.month !== undefined) {
      where.push("month = ?");
      params.push(filter.month);
    }
    if (filter.profileId !== undefined) {
      where.push("profile_id = ?");
      params.push(filter.profileId);
    }
    const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    return getDatabase().all(
      `SELECT * FROM entries ${clause} ORDER BY year, month, profile_id, section, id`,
      params,
      toEntry
    );
  },

  findById(id: number): Entry | null {
    return getDatabase().get("SELECT * FROM entries WHERE id = ?", [id], toEntry);
  },

  create(input: EntryInput): Entry {
    const now = nowIso();
    const { lastId } = getDatabase().run(
      `INSERT INTO entries (profile_id, year, month, section, description, amount, due_day, paid, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.profileId,
        input.year,
        input.month,
        input.section,
        input.description,
        roundMoney(input.amount),
        input.dueDay,
        input.paid ? 1 : 0,
        now,
        now,
      ]
    );
    const created = this.findById(lastId);
    if (!created) {
      throw new Error("Falha ao criar lancamento.");
    }
    return created;
  },

  update(id: number, input: EntryInput): Entry | null {
    const { changes } = getDatabase().run(
      `UPDATE entries SET profile_id = ?, year = ?, month = ?, section = ?, description = ?, amount = ?,
       due_day = ?, paid = ?, updated_at = ? WHERE id = ?`,
      [
        input.profileId,
        input.year,
        input.month,
        input.section,
        input.description,
        roundMoney(input.amount),
        input.dueDay,
        input.paid ? 1 : 0,
        nowIso(),
        id,
      ]
    );
    return changes > 0 ? this.findById(id) : null;
  },

  remove(id: number): boolean {
    return getDatabase().run("DELETE FROM entries WHERE id = ?", [id]).changes > 0;
  },

  /** Copia os lancamentos de um mes para outro (sem marcar como pagos). */
  copyMonth(profileId: ProfileId, from: { year: number; month: number }, to: { year: number; month: number }, sections: EntrySection[]): number {
    const db = getDatabase();
    const source = this.list({ year: from.year, month: from.month, profileId }).filter((e) =>
      sections.includes(e.section)
    );
    const existing = this.list({ year: to.year, month: to.month, profileId });
    const key = (e: { section: string; description: string }) => `${e.section}|${e.description.toLowerCase()}`;
    const existingKeys = new Set(existing.map(key));
    return db.transaction(() => {
      let copied = 0;
      for (const item of source) {
        if (existingKeys.has(key(item))) {
          continue;
        }
        this.create({ ...item, year: to.year, month: to.month, paid: false });
        copied += 1;
      }
      return copied;
    });
  },

  replaceAll(entries: Entry[]): void {
    const db = getDatabase();
    db.transaction(() => {
      db.run("DELETE FROM entries");
      for (const e of entries) {
        db.run(
          `INSERT INTO entries (profile_id, year, month, section, description, amount, due_day, paid, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [e.profileId, e.year, e.month, e.section, e.description, roundMoney(e.amount), e.dueDay, e.paid ? 1 : 0, e.createdAt || nowIso(), e.updatedAt || nowIso()]
        );
      }
    });
  },
};
