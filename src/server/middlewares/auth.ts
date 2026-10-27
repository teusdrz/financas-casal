import type { NextFunction, Request, Response } from "express";
import { UserModel } from "../models/UserModel";
import { readSessionToken } from "../services/AuthService";
import type { User } from "../types/domain";
import { HttpError } from "../utils/HttpError";

export const SESSION_COOKIE = "fc_session";

/** Exige sessao valida e disponibiliza o usuario em res.locals.user. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const userId = readSessionToken(cookies?.[SESSION_COOKIE]);
  const user = userId === null ? null : UserModel.findById(userId);
  if (!user) {
    next(new HttpError(401, "Sessao expirada. Faca login novamente."));
    return;
  }
  res.locals.user = user;
  next();
}

export function currentUser(res: Response): User {
  const user = res.locals.user as User | undefined;
  if (!user) {
    throw new HttpError(401, "Nao autenticado.");
  }
  return user;
}
