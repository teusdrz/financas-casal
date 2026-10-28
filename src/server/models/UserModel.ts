import { getDatabase, Row } from "../database/connection";
import type { ProfileId, User, UserRecord } from "../types/domain";
import { asNumber, asString } from "../utils/helpers";

function toRecord(row: Row): UserRecord {
  return {
    id: asNumber(row.id),
    username: asString(row.username),
    displayName: asString(row.display_name),
    profileId: asString(row.profile_id) as ProfileId,
    passwordHash: asString(row.password_hash),
    feedToken: asString(row.feed_token),
    avatarDataUrl: typeof row.avatar_data_url === "string" ? row.avatar_data_url : null,
  };
}

function toUser(row: Row): User {
  const { passwordHash: _ignored, ...user } = toRecord(row);
  void _ignored;
  return user;
}

export const UserModel = {
  count(): number {
    return getDatabase().get("SELECT COUNT(*) AS c FROM users", [], (r) => asNumber(r.c)) ?? 0;
  },

  findById(id: number): User | null {
    return getDatabase().get("SELECT * FROM users WHERE id = ?", [id], toUser);
  },

  findRecordByUsername(username: string): UserRecord | null {
    return getDatabase().get("SELECT * FROM users WHERE username = ?", [username], toRecord);
  },

  findByFeedToken(token: string): User | null {
    return getDatabase().get("SELECT * FROM users WHERE feed_token = ?", [token], toUser);
  },

  create(input: { username: string; displayName: string; profileId: ProfileId; passwordHash: string; feedToken: string }): number {
    return getDatabase().run(
      "INSERT INTO users (username, display_name, profile_id, password_hash, feed_token) VALUES (?, ?, ?, ?, ?)",
      [input.username, input.displayName, input.profileId, input.passwordHash, input.feedToken]
    ).lastId;
  },

  updatePassword(id: number, passwordHash: string): void {
    getDatabase().run("UPDATE users SET password_hash = ? WHERE id = ?", [passwordHash, id]);
  },

  updateFeedToken(id: number, token: string): void {
    getDatabase().run("UPDATE users SET feed_token = ? WHERE id = ?", [token, id]);
  },

  updateAvatar(id: number, avatarDataUrl: string | null): void {
    getDatabase().run("UPDATE users SET avatar_data_url = ? WHERE id = ?", [avatarDataUrl, id]);
  },
};
