import path from "path";
import crypto from "crypto";
import "dotenv/config";
import type { ProfileId } from "../types/domain";

/**
 * Configuracao centralizada lida das variaveis de ambiente.
 * No Render, defina SESSION_SECRET e (com disco persistente) DB_PATH=/var/data/financas.sqlite.
 */

const projectRoot = path.resolve(__dirname, "..", "..", "..");

function readSecret(): string {
  const fromEnv = process.env.SESSION_SECRET;
  if (fromEnv && fromEnv.length >= 16) {
    return fromEnv;
  }
  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[config] SESSION_SECRET ausente ou curto. Usando segredo aleatorio: as sessoes expiram a cada reinicio."
    );
  }
  return crypto.randomBytes(32).toString("hex");
}

export const env = {
  port: Number(process.env.PORT ?? 3000),
  isProduction: process.env.NODE_ENV === "production",
  sessionSecret: readSecret(),
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 72),
  dbPath: process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.join(projectRoot, "data", "financas.sqlite"),
  publicDir: path.join(projectRoot, "public"),
  chartJsFile: path.join(projectRoot, "node_modules", "chart.js", "dist", "chart.umd.js"),
  baseYear: 2026,
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  googleAccountEmails: {
    ingrid: (process.env.GOOGLE_INGRID_ACCOUNT_EMAIL ?? process.env.GOOGLE_ACCOUNT_EMAIL ?? "ingridregina031@gmail.com").toLowerCase(),
    felipp: (process.env.GOOGLE_FELIPP_ACCOUNT_EMAIL ?? "felipp.nolasco@gmail.com").toLowerCase(),
  } satisfies Record<ProfileId, string>,
  googleRedirectUri:
    process.env.GOOGLE_REDIRECT_URI ?? `http://localhost:${Number(process.env.PORT ?? 3000)}/api/calendar/google/callback`,
  googleCalendarConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
};
