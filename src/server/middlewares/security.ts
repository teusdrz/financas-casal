import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/HttpError";

/** Cabecalhos basicos de seguranca (equivalente enxuto ao helmet). */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'"
  );
  next();
}

/** Limita tentativas de login por IP (10 a cada 15 minutos). */
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function loginRateLimit(req: Request, _res: Response, next: NextFunction): void {
  const key = req.ip ?? "desconhecido";
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    next();
    return;
  }
  current.count += 1;
  if (current.count > MAX_ATTEMPTS) {
    next(new HttpError(429, "Muitas tentativas de login. Aguarde alguns minutos."));
    return;
  }
  next();
}
