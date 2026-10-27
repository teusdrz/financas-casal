import type { Request, Response } from "express";
import { env } from "../config/env";
import { currentUser, SESSION_COOKIE } from "../middlewares/auth";
import { AuthService, readSessionToken } from "../services/AuthService";
import { UserModel } from "../models/UserModel";
import { HttpError } from "../utils/HttpError";

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.isProduction,
    maxAge: env.sessionTtlHours * 3600 * 1000,
    path: "/",
  };
}

export const AuthController = {
  login(req: Request, res: Response): void {
    const body = (req.body ?? {}) as { username?: unknown; password?: unknown };
    if (typeof body.username !== "string" || typeof body.password !== "string") {
      throw new HttpError(400, "Informe usuario e senha.");
    }
    const { user, token } = AuthService.login(body.username, body.password);
    res.cookie(SESSION_COOKIE, token, cookieOptions());
    res.json({ user });
  },

  logout(_req: Request, res: Response): void {
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ ok: true });
  },

  /** Verifica a sessao sem gerar erro 401 (usado na abertura do app). */
  session(req: Request, res: Response): void {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    const userId = readSessionToken(cookies?.[SESSION_COOKIE]);
    res.json({ user: userId === null ? null : UserModel.findById(userId) });
  },

  me(_req: Request, res: Response): void {
    res.json({ user: currentUser(res) });
  },

  changePassword(req: Request, res: Response): void {
    const body = (req.body ?? {}) as { current?: unknown; next?: unknown };
    if (typeof body.current !== "string" || typeof body.next !== "string") {
      throw new HttpError(400, "Informe a senha atual e a nova senha.");
    }
    AuthService.changePassword(currentUser(res).id, body.current, body.next);
    res.json({ ok: true });
  },

  regenerateFeed(_req: Request, res: Response): void {
    const feedToken = AuthService.regenerateFeedToken(currentUser(res).id);
    res.json({ feedToken });
  },
};
