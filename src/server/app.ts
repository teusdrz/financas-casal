import path from "path";
import express, { Express } from "express";
import cookieParser from "cookie-parser";
import { env } from "./config/env";
import { errorHandler } from "./middlewares/errorHandler";
import { securityHeaders } from "./middlewares/security";
import { buildApiRouter, buildFeedRouter } from "./routes";

/** Monta a aplicacao Express: API (Model/Controller) + SPA estatica (View). */
export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // Render fica atras de proxy reverso (HTTPS)

  app.use(securityHeaders);
  app.use(express.json({ limit: "5mb" }));
  app.use(cookieParser());

  app.use("/api", buildApiRouter());
  app.use("/calendar", buildFeedRouter());

  // Biblioteca de graficos servida localmente (sem CDN).
  app.get("/vendor/chart.umd.js", (_req, res) => {
    res.sendFile(env.chartJsFile);
  });

  app.use(
    express.static(env.publicDir, {
      index: "index.html",
      maxAge: env.isProduction ? "1h" : 0,
      setHeaders(res, filePath) {
        const extension = path.extname(filePath);
        if (extension === ".html" || extension === ".js") {
          res.setHeader("Cache-Control", "no-cache, must-revalidate");
        }
      },
    })
  );

  // Fallback da SPA: rotas sem extensao de arquivo (fora da API) devolvem o index.html.
  // Arquivos inexistentes (ex.: /js/x.js) recebem 404 em vez de HTML.
  app.get(/^\/(?!api\/|calendar\/)(?!.*\.[a-z0-9]+$).*/i, (_req, res) => {
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    res.sendFile(path.join(env.publicDir, "index.html"));
  });

  app.use(errorHandler);
  return app;
}
