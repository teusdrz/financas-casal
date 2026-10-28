import type { LocalDatabase } from "./connection";

/** Cria as tabelas do banco local (idempotente). */
export function applySchema(db: LocalDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      profile_id TEXT NOT NULL CHECK (profile_id IN ('ingrid','felipp')),
      password_hash TEXT NOT NULL,
      feed_token TEXT NOT NULL UNIQUE,
      avatar_data_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id TEXT NOT NULL CHECK (profile_id IN ('ingrid','felipp')),
      year INTEGER NOT NULL,
      month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
      section TEXT NOT NULL CHECK (section IN ('income','fixed','emergency','investment','variable','card')),
      description TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      due_day INTEGER CHECK (due_day IS NULL OR due_day BETWEEN 1 AND 31),
      paid INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_entries_period ON entries (year, month, profile_id);

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner TEXT NOT NULL CHECK (owner IN ('ingrid','felipp','shared')),
      title TEXT NOT NULL,
      date TEXT NOT NULL,
      time TEXT,
      category TEXT NOT NULL,
      amount REAL,
      notes TEXT NOT NULL DEFAULT '',
      alarm_minutes INTEGER NOT NULL DEFAULT 1440,
      done INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_events_date ON events (date);

    CREATE TABLE IF NOT EXISTS calendar_integrations (
      provider TEXT PRIMARY KEY,
      account_email TEXT NOT NULL,
      encrypted_refresh_token TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calendar_event_sync (
      provider TEXT NOT NULL,
      event_id INTEGER NOT NULL,
      remote_event_id TEXT NOT NULL,
      PRIMARY KEY (provider, event_id),
      UNIQUE (provider, remote_event_id)
    );

    INSERT OR IGNORE INTO calendar_integrations (provider, account_email, encrypted_refresh_token, updated_at)
      SELECT 'google:ingrid', account_email, encrypted_refresh_token, updated_at
      FROM calendar_integrations WHERE provider = 'google';
    DELETE FROM calendar_integrations WHERE provider = 'google';

    INSERT OR IGNORE INTO calendar_event_sync (provider, event_id, remote_event_id)
      SELECT 'google:ingrid', event_id, remote_event_id
      FROM calendar_event_sync WHERE provider = 'google';
    DELETE FROM calendar_event_sync WHERE provider = 'google';
  `);

  const userColumns = db.all("PRAGMA table_info(users)", [], (row) => String(row.name));
  if (!userColumns.includes("avatar_data_url")) {
    db.exec("ALTER TABLE users ADD COLUMN avatar_data_url TEXT;");
  }
}
