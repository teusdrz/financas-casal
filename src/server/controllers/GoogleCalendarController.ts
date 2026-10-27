import crypto from "crypto";
import type { Request, Response } from "express";
import { env } from "../config/env";
import { UserModel } from "../models/UserModel";
import { SESSION_COOKIE } from "../middlewares/auth";
import { readSessionToken } from "../services/AuthService";
import { GoogleCalendarService } from "../services/GoogleCalendarService";
import { HttpError } from "../utils/HttpError";
import type { ProfileId } from "../types/domain";

const PROFILES: readonly ProfileId[] = ["ingrid", "felipp"];
const STATE_TTL_MS = 10 * 60 * 1000;

function stateSignature(payload: string): string {
  return crypto.createHmac("sha256", env.sessionSecret).update(payload).digest("hex");
}

function validState(state: string): ProfileId | null {
  const [profileValue, timestampValue, nonce, signature, ...rest] = state.split(".");
  if (
    rest.length > 0 ||
    !PROFILES.includes(profileValue as ProfileId) ||
    !/^\d{13}$/.test(timestampValue ?? "") ||
    !/^[a-f0-9]{64}$/.test(nonce ?? "") ||
    !/^[a-f0-9]{64}$/.test(signature ?? "")
  ) {
    return null;
  }

  const timestamp = Number(timestampValue);
  if (!Number.isSafeInteger(timestamp) || Date.now() - timestamp > STATE_TTL_MS || timestamp > Date.now() + 60_000) {
    return null;
  }

  const payload = `${profileValue}.${timestampValue}.${nonce}`;
  const expected = Buffer.from(stateSignature(payload), "hex");
  const received = Buffer.from(signature, "hex");
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    return null;
  }
  return profileValue as ProfileId;
}

export const GoogleCalendarController = {
  status(_req: Request, res: Response): void {
    res.json(GoogleCalendarService.getStatus());
  },

  async sync(_req: Request, res: Response): Promise<void> {
    await GoogleCalendarService.syncAll();
    res.json({ ok: true });
  },

  connect(req: Request, res: Response): void {
    const profile = typeof req.query.account === "string" ? req.query.account : "";
    if (!PROFILES.includes(profile as ProfileId)) {
      throw new HttpError(400, "Informe a conta Google que deseja conectar.");
    }
    const payload = `${profile}.${Date.now()}.${crypto.randomBytes(32).toString("hex")}`;
    const state = `${payload}.${stateSignature(payload)}`;
    res.redirect(GoogleCalendarService.authorizationUrl(state));
  },

  async callback(req: Request, res: Response): Promise<void> {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const profile = validState(state);
    if (!profile) {
      throw new HttpError(400, "Autorizacao Google invalida ou expirada. Tente conectar novamente.");
    }
    if (typeof req.query.error === "string") {
      throw new HttpError(400, "A autorizacao do Google foi cancelada.");
    }
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!code) {
      throw new HttpError(400, "O Google nao retornou o codigo de autorizacao.");
    }

    const session = cookies?.[SESSION_COOKIE];
    const userId = readSessionToken(session);
    if (userId === null || !UserModel.findById(userId)) {
      throw new HttpError(401, "Sua sessao expirou. Entre novamente e tente conectar o Google.");
    }

    await GoogleCalendarService.completeAuthorization(code, profile);
    res.redirect("/?googleCalendar=connected");
  },
};
