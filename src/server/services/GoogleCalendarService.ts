import crypto from "crypto";
import fs from "fs";
import path from "path";
import { google, type calendar_v3 } from "googleapis";
import { env } from "../config/env";
import { EventModel } from "../models/EventModel";
import { CalendarIntegrationModel } from "../models/CalendarIntegrationModel";
import type { CalendarEvent, ProfileId } from "../types/domain";
import { HttpError } from "../utils/HttpError";
import { isoDate } from "../utils/helpers";

const PROFILES: readonly ProfileId[] = ["ingrid", "felipp"];
const TIME_ZONE = "America/Sao_Paulo";
const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.events.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

function providerFor(profile: ProfileId): string {
  return `google:${profile}`;
}

function oauthClient(): InstanceType<typeof google.auth.OAuth2> {
  if (!env.googleCalendarConfigured) {
    throw new HttpError(503, "A integracao Google Calendar ainda nao foi configurada no servidor.");
  }
  return new google.auth.OAuth2(env.googleClientId, env.googleClientSecret, env.googleRedirectUri);
}

function encryptionKey(): Buffer {
  const keyPath = `${env.dbPath}.google-token-key`;
  fs.mkdirSync(path.dirname(keyPath), { recursive: true });
  try {
    const key = Buffer.from(fs.readFileSync(keyPath, "utf8").trim(), "hex");
    if (key.length !== 32) {
      throw new Error("Chave persistente do Google Calendar invalida.");
    }
    return key;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const key = crypto.randomBytes(32);
  try {
    fs.writeFileSync(keyPath, key.toString("hex"), { encoding: "utf8", flag: "wx", mode: 0o600 });
    return key;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
    const existing = Buffer.from(fs.readFileSync(keyPath, "utf8").trim(), "hex");
    if (existing.length !== 32) {
      throw new Error("Chave persistente do Google Calendar invalida.");
    }
    return existing;
  }
}

function encrypt(value: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}.${cipher.getAuthTag().toString("hex")}.${encrypted.toString("hex")}`;
}

function decrypt(value: string): string {
  const [ivHex, tagHex, encryptedHex] = value.split(".");
  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error("Credencial Google armazenada em formato invalido.");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedHex, "hex")), decipher.final()]).toString("utf8");
}

function calendarEvent(event: CalendarEvent): calendar_v3.Schema$Event {
  const description = event.notes.trim();
  const reminder = Math.min(event.alarmMinutes, 40320);
  const common = {
    summary: event.title,
    description,
    reminders: { useDefault: false, overrides: [{ method: "popup" as const, minutes: reminder }] },
  };
  if (!event.time) {
    const dayAfter = new Date(`${event.date}T00:00:00Z`);
    dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
    return {
      ...common,
      start: { date: event.date },
      end: { date: isoDate(dayAfter.getUTCFullYear(), dayAfter.getUTCMonth() + 1, dayAfter.getUTCDate()) },
    };
  }
  const dateTime = `${event.date}T${event.time}:00`;
  const start = new Date(`${dateTime}-03:00`);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    ...common,
    start: { dateTime: start.toISOString(), timeZone: TIME_ZONE },
    end: { dateTime: end.toISOString(), timeZone: TIME_ZONE },
  };
}

function authenticatedCalendar(profile: ProfileId): calendar_v3.Calendar | null {
  const integration = CalendarIntegrationModel.get(providerFor(profile));
  if (!integration) {
    return null;
  }
  const auth = oauthClient();
  let refreshToken: string;
  try {
    refreshToken = decrypt(integration.encryptedRefreshToken);
  } catch {
    throw new HttpError(
      409,
      "A autorizacao Google antiga nao pode ser recuperada. Reconecte o Google Calendar em Integracoes e backup."
    );
  }
  auth.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth });
}

function googleErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message.replace(/\s+/g, " ").trim();
    return message.length > 300 ? `${message.slice(0, 297)}...` : message;
  }
  return "Erro desconhecido retornado pelo Google Calendar.";
}

function comparableEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const [localPart, domain] = normalized.split("@");
  if (domain === "gmail.com" || domain === "googlemail.com") {
    return `${(localPart ?? "").replace(/\./g, "")}@gmail.com`;
  }
  return normalized;
}

function dateInAppTimeZone(dateTime: string): string {
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Google Calendar retornou uma data invalida.");
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function googleItem(profile: ProfileId, remote: calendar_v3.Schema$Event): import("../types/domain").CalendarItem | null {
  if (!remote.id || !remote.start || remote.status === "cancelled") {
    return null;
  }
  const date = remote.start.date ?? (remote.start.dateTime ? dateInAppTimeZone(remote.start.dateTime) : null);
  if (!date) {
    return null;
  }
  const time = remote.start.dateTime
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(new Date(remote.start.dateTime))
    : null;
  return {
    id: 0,
    owner: profile,
    title: remote.summary?.trim() || "(Sem titulo)",
    date,
    time: time ?? null,
    category: "other",
    amount: null,
    notes: remote.description ?? "",
    alarmMinutes: 0,
    done: false,
    source: "google",
    entryId: null,
    createdAt: remote.created ?? "",
    updatedAt: remote.updated ?? "",
  };
}

export const GoogleCalendarService = {
  getStatus(): {
    configured: boolean;
    accounts: Record<ProfileId, { connected: boolean; accountEmail: string | null }>;
  } {
    const accounts = {} as Record<ProfileId, { connected: boolean; accountEmail: string | null }>;
    for (const profile of PROFILES) {
      const provider = providerFor(profile);
      let integration = CalendarIntegrationModel.get(provider);
      if (integration) {
        try {
          decrypt(integration.encryptedRefreshToken);
        } catch {
          console.warn(`[google-calendar] Credencial de ${profile} invalida; solicitando nova autorizacao.`);
          CalendarIntegrationModel.remove(provider);
          integration = null;
        }
      }
      accounts[profile] = {
        connected: integration !== null,
        accountEmail: integration?.accountEmail ?? null,
      };
    }
    return {
      configured: env.googleCalendarConfigured,
      accounts,
    };
  },

  authorizationUrl(state: string): string {
    return oauthClient().generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: false,
      scope: [...REQUIRED_SCOPES],
      state,
    });
  },

  async completeAuthorization(code: string, profile: ProfileId): Promise<void> {
    const auth = oauthClient();
    const { tokens } = await auth.getToken(code);
    const grantedScopes = new Set((tokens.scope ?? "").split(/\s+/).filter(Boolean));
    const missingScopes = REQUIRED_SCOPES.filter((scope) => !grantedScopes.has(scope));
    if (missingScopes.length > 0) {
      throw new HttpError(
        403,
        `A conta Google nao concedeu todas as permissoes necessarias para ${profile}. Reconecte e aceite leitura e edicao dos eventos.`
      );
    }
    auth.setCredentials(tokens);
    const userInfo = await google.oauth2({ version: "v2", auth }).userinfo.get();
    const email = userInfo.data.email?.toLowerCase();
    const expectedEmail = env.googleAccountEmails[profile];
    if (!email || comparableEmail(email) !== comparableEmail(expectedEmail) || userInfo.data.verified_email !== true) {
      throw new HttpError(403, `Para conectar ${profile}, autorize a conta Google esperada: ${expectedEmail}.`);
    }
    const provider = providerFor(profile);
    if (!tokens.refresh_token) {
      throw new HttpError(
        400,
        "O Google nao retornou uma nova autorizacao persistente. Remova o acesso antigo em myaccount.google.com/permissions e conecte novamente."
      );
    }
    CalendarIntegrationModel.save(provider, email, encrypt(tokens.refresh_token));
    await this.syncProfile(profile);
  },

  async syncEvent(event: CalendarEvent): Promise<void> {
    for (const profile of PROFILES) {
      await this.syncEventToProfile(profile, event);
    }
  },

  async syncEventToProfile(profile: ProfileId, event: CalendarEvent): Promise<void> {
    const provider = providerFor(profile);
    const calendar = authenticatedCalendar(profile);
    if (!calendar) return;
    if (event.owner !== "shared" && event.owner !== profile) {
      await this.deleteRemoteEvent(profile, event.id, calendar);
      return;
    }
    const remoteEventId = CalendarIntegrationModel.remoteEventId(provider, event.id);
    try {
      if (remoteEventId) {
        await calendar.events.update({
          calendarId: "primary",
          eventId: remoteEventId,
          requestBody: calendarEvent(event),
        });
        return;
      }
      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody: calendarEvent(event),
      });
      if (!response.data.id) {
        throw new Error("Google Calendar criou um evento sem retornar identificador.");
      }
      CalendarIntegrationModel.saveRemoteEventId(provider, event.id, response.data.id);
    } catch (error) {
      const reason = googleErrorMessage(error);
      console.error(`[google-calendar] Falha ao sincronizar evento para ${profile}:`, reason);
      throw new HttpError(502, `Evento salvo no app, mas nao foi possivel sincronizar com o Google Calendar de ${profile}: ${reason}`);
    }
  },

  async deleteEvent(eventId: number): Promise<void> {
    for (const profile of PROFILES) {
      const calendar = authenticatedCalendar(profile);
      if (!calendar) continue;
      await this.deleteRemoteEvent(profile, eventId, calendar);
    }
  },

  async deleteRemoteEvent(
    profile: ProfileId,
    eventId: number,
    calendar = authenticatedCalendar(profile)
  ): Promise<void> {
    if (!calendar) return;
    const provider = providerFor(profile);
    const remoteEventId = CalendarIntegrationModel.remoteEventId(provider, eventId);
    if (!remoteEventId) return;
    try {
      await calendar.events.delete({ calendarId: "primary", eventId: remoteEventId });
    } catch (error) {
      const reason = googleErrorMessage(error);
      console.error(`[google-calendar] Falha ao excluir evento para ${profile}:`, reason);
      throw new HttpError(502, `Nao foi possivel atualizar o compromisso no Google Calendar de ${profile}: ${reason}`);
    }
    CalendarIntegrationModel.removeRemoteEventId(provider, eventId);
  },

  async syncAll(): Promise<void> {
    for (const profile of PROFILES) {
      await this.syncProfile(profile);
    }
  },

  async syncProfile(profile: ProfileId): Promise<void> {
    for (const event of EventModel.list()) {
      await this.syncEventToProfile(profile, event);
    }
  },

  async listExternalItems(
    from: string,
    to: string,
    profiles: ProfileId[]
  ): Promise<import("../types/domain").CalendarItem[]> {
    const externalItems: import("../types/domain").CalendarItem[] = [];
    const exclusiveEndDate = new Date(`${to}T00:00:00Z`);
    exclusiveEndDate.setUTCDate(exclusiveEndDate.getUTCDate() + 1);
    const timeMax = `${isoDate(exclusiveEndDate.getUTCFullYear(), exclusiveEndDate.getUTCMonth() + 1, exclusiveEndDate.getUTCDate())}T00:00:00-03:00`;

    for (const profile of profiles) {
      const calendar = authenticatedCalendar(profile);
      if (!calendar) continue;
      let pageToken: string | undefined;
      do {
        let response: calendar_v3.Schema$Events;
        try {
          const result = await calendar.events.list({
            calendarId: "primary",
            timeMin: `${from}T00:00:00-03:00`,
            timeMax,
            singleEvents: true,
            orderBy: "startTime",
            maxResults: 2500,
            pageToken,
          });
          response = result.data;
        } catch (error) {
          const reason = googleErrorMessage(error);
          console.error(`[google-calendar] Falha ao ler agenda de ${profile}:`, reason);
          throw new HttpError(502, `Nao foi possivel carregar a agenda Google de ${profile}: ${reason}`);
        }
        for (const remote of response.items ?? []) {
          if (!remote.id || CalendarIntegrationModel.isRemoteEventSynced(providerFor(profile), remote.id)) {
            continue;
          }
          const item = googleItem(profile, remote);
          if (item && item.date >= from && item.date <= to) {
            externalItems.push(item);
          }
        }
        pageToken = response.nextPageToken ?? undefined;
      } while (pageToken);
    }
    return externalItems;
  },
};
