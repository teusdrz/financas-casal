import { Router } from "express";
import { AuthController } from "../controllers/AuthController";
import { EntryController } from "../controllers/EntryController";
import { EventController } from "../controllers/EventController";
import { GoogleCalendarController } from "../controllers/GoogleCalendarController";
import { ReportController } from "../controllers/ReportController";
import { requireAuth } from "../middlewares/auth";
import { notFoundApi } from "../middlewares/errorHandler";
import { loginRateLimit } from "../middlewares/security";

/** Rotas da API REST. Express 5 encaminha erros de handlers ao errorHandler. */
export function buildApiRouter(): Router {
  const api = Router();

  api.get("/health", (_req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Autenticacao
  api.post("/auth/login", loginRateLimit, AuthController.login);
  api.post("/auth/logout", AuthController.logout);
  api.get("/auth/session", AuthController.session);
  api.get("/auth/me", requireAuth, AuthController.me);
  api.post("/auth/password", requireAuth, AuthController.changePassword);
  api.post("/auth/feed-token", requireAuth, AuthController.regenerateFeed);

  // Integracao Google Calendar
  api.get("/calendar/google/status", requireAuth, GoogleCalendarController.status);
  api.post("/calendar/google/sync", requireAuth, GoogleCalendarController.sync);
  api.get("/calendar/google/connect", requireAuth, GoogleCalendarController.connect);
  api.get("/calendar/google/callback", GoogleCalendarController.callback);

  // Lancamentos financeiros
  api.get("/entries", requireAuth, EntryController.list);
  api.post("/entries", requireAuth, EntryController.create);
  api.post("/entries/copy-month", requireAuth, EntryController.copyMonth);
  api.put("/entries/:id", requireAuth, EntryController.update);
  api.delete("/entries/:id", requireAuth, EntryController.remove);

  // Resumos
  api.get("/summary/month", requireAuth, ReportController.month);
  api.get("/summary/year", requireAuth, ReportController.year);

  // Calendario
  api.get("/events", requireAuth, EventController.list);
  api.get("/events/export.ics", requireAuth, EventController.exportRange);
  api.post("/events", requireAuth, EventController.create);
  api.get("/events/entry/:id/export.ics", requireAuth, EventController.exportEntry);
  api.get("/events/:id/export.ics", requireAuth, EventController.exportOne);
  api.put("/events/:id", requireAuth, EventController.update);
  api.delete("/events/:id", requireAuth, EventController.remove);

  // Backup
  api.get("/backup/json", requireAuth, ReportController.exportJson);
  api.get("/backup/csv/:kind", requireAuth, ReportController.exportCsv);
  api.post("/backup/import", requireAuth, ReportController.importJson);

  api.use(notFoundApi);
  return api;
}

/** Rotas publicas do feed de calendario (assinatura pelo iPhone). */
export function buildFeedRouter(): Router {
  const feed = Router();
  feed.get("/:token", EventController.feed);
  return feed;
}
