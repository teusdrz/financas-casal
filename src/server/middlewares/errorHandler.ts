import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/HttpError";

export function notFoundApi(_req: Request, _res: Response, next: NextFunction): void {
  next(new HttpError(404, "Rota da API nao encontrada."));
}

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, details: err.details ?? [] });
    return;
  }
  if (err instanceof SyntaxError) {
    res.status(400).json({ error: "JSON invalido no corpo da requisicao.", details: [] });
    return;
  }
  console.error("[erro]", err);
  res.status(500).json({ error: "Erro interno do servidor.", details: [] });
}
