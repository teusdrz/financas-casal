import { getDatabase } from "../database/connection";
import { asString } from "../utils/helpers";

export interface CalendarIntegration {
  accountEmail: string;
  encryptedRefreshToken: string;
}

export const CalendarIntegrationModel = {
  get(provider: string): CalendarIntegration | null {
    return getDatabase().get(
      "SELECT account_email, encrypted_refresh_token FROM calendar_integrations WHERE provider = ?",
      [provider],
      (row) => ({
        accountEmail: asString(row.account_email),
        encryptedRefreshToken: asString(row.encrypted_refresh_token),
      })
    );
  },

  save(provider: string, accountEmail: string, encryptedRefreshToken: string): void {
    getDatabase().run(
      `INSERT INTO calendar_integrations (provider, account_email, encrypted_refresh_token, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(provider) DO UPDATE SET
         account_email = excluded.account_email,
         encrypted_refresh_token = excluded.encrypted_refresh_token,
         updated_at = excluded.updated_at`,
      [provider, accountEmail, encryptedRefreshToken]
    );
  },

  remove(provider: string): void {
    getDatabase().run("DELETE FROM calendar_integrations WHERE provider = ?", [provider]);
  },

  remoteEventId(provider: string, eventId: number): string | null {
    return getDatabase().get(
      "SELECT remote_event_id FROM calendar_event_sync WHERE provider = ? AND event_id = ?",
      [provider, eventId],
      (row) => asString(row.remote_event_id)
    );
  },

  isRemoteEventSynced(provider: string, remoteEventId: string): boolean {
    return getDatabase().get(
      "SELECT 1 AS found FROM calendar_event_sync WHERE provider = ? AND remote_event_id = ?",
      [provider, remoteEventId],
      () => true
    ) ?? false;
  },

  saveRemoteEventId(provider: string, eventId: number, remoteEventId: string): void {
    getDatabase().run(
      `INSERT INTO calendar_event_sync (provider, event_id, remote_event_id) VALUES (?, ?, ?)
       ON CONFLICT(provider, event_id) DO UPDATE SET remote_event_id = excluded.remote_event_id`,
      [provider, eventId, remoteEventId]
    );
  },

  removeRemoteEventId(provider: string, eventId: number): void {
    getDatabase().run("DELETE FROM calendar_event_sync WHERE provider = ? AND event_id = ?", [provider, eventId]);
  },
};
