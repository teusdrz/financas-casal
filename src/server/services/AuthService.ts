import crypto from "crypto";
import { env } from "../config/env";
import { UserModel } from "../models/UserModel";
import type { User } from "../types/domain";
import { HttpError } from "../utils/HttpError";

/**
 * Hash de senha com scrypt (nativo do Node) e sessao assinada com HMAC-SHA256.
 * Sem dependencias externas de criptografia.
 */

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hash) {
    return false;
  }
  const candidate = crypto.scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && crypto.timingSafeEqual(expected, candidate);
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", env.sessionSecret).update(payload).digest("base64url");
}

export function createSessionToken(userId: number): string {
  const expiresAt = Date.now() + env.sessionTtlHours * 3600 * 1000;
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp: expiresAt })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined): number | null {
  if (!token) {
    return null;
  }
  const [payload, signature] = token.split(".");
  if (!payload || !signature) {
    return null;
  }
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { uid?: unknown; exp?: unknown };
    if (typeof data.uid !== "number" || typeof data.exp !== "number" || data.exp < Date.now()) {
      return null;
    }
    return data.uid;
  } catch {
    return null;
  }
}

export function newFeedToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export const AuthService = {
  login(username: string, password: string): { user: User; token: string } {
    const record = UserModel.findRecordByUsername(username.trim().toLowerCase());
    if (!record || !verifyPassword(password, record.passwordHash)) {
      throw new HttpError(401, "Usuario ou senha invalidos.");
    }
    const user: User = {
      id: record.id,
      username: record.username,
      displayName: record.displayName,
      profileId: record.profileId,
      feedToken: record.feedToken,
    };
    return { user, token: createSessionToken(user.id) };
  },

  changePassword(userId: number, current: string, next: string): void {
    const user = UserModel.findById(userId);
    if (!user) {
      throw new HttpError(404, "Usuario nao encontrado.");
    }
    const record = UserModel.findRecordByUsername(user.username);
    if (!record || !verifyPassword(current, record.passwordHash)) {
      throw new HttpError(400, "Senha atual incorreta.");
    }
    if (next.length < 4) {
      throw new HttpError(400, "A nova senha deve ter pelo menos 4 caracteres.");
    }
    UserModel.updatePassword(userId, hashPassword(next));
  },

  regenerateFeedToken(userId: number): string {
    const token = newFeedToken();
    UserModel.updateFeedToken(userId, token);
    return token;
  },
};
