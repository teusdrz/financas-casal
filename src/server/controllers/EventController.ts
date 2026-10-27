import type { Request, Response } from "express";
import { EventModel } from "../models/EventModel";
import { UserModel } from "../models/UserModel";
import { CalendarService, entryToItem } from "../services/CalendarService";
import { EntryModel } from "../models/EntryModel";
import { IcsService } from "../services/IcsService";
import { GoogleCalendarService } from "../services/GoogleCalendarService";
import { isValidDate, ValidationService } from "../services/ValidationService";
import type { CalendarItem, ProfileId } from "../types/domain";
import { PROFILE_IDS } from "../types/domain";
import { HttpError } from "../utils/HttpError";

function parseId(raw: unknown): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, "Identificador invalido.");
  }
  return id;
}

function parseRange(req: Request): { from: string; to: string } {
  const from = typeof req.query.from === "string" ? req.query.from : "";
  const to = typeof req.query.to === "string" ? req.query.to : "";
  if (!isValidDate(from) || !isValidDate(to) || from > to) {
    throw new HttpError(400, "Periodo invalido. Use from=AAAA-MM-DD e to=AAAA-MM-DD.");
  }
  return { from, to };
}

function parseProfiles(raw: unknown): ProfileId[] {
  if (typeof raw !== "string" || raw === "joint" || raw === "") {
    return [...PROFILE_IDS];
  }
  return [ValidationService.profile(raw)];
}

function sendIcs(res: Response, fileName: string, content: string): void {
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  // "inline" faz o Safari do iPhone abrir direto a tela "Adicionar ao Calendario".
  res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
  res.send(content);
}

export const EventController = {
  /** Lista eventos + vencimentos derivados das financas no periodo. */
  async list(req: Request, res: Response): Promise<void> {
    const { from, to } = parseRange(req);
    const profiles = parseProfiles(req.query.profile);
    const localItems = CalendarService.items(from, to, profiles);
    const googleItems = await GoogleCalendarService.listExternalItems(from, to, profiles);
    res.json({ items: [...localItems, ...googleItems].sort((a, b) =>
      a.date === b.date ? (a.time ?? "00:00").localeCompare(b.time ?? "00:00") : a.date.localeCompare(b.date)
    ) });
  },

  async create(req: Request, res: Response): Promise<void> {
    const event = EventModel.create(ValidationService.event(req.body));
    await GoogleCalendarService.syncEvent(event);
    res.status(201).json({ event });
  },

  async update(req: Request, res: Response): Promise<void> {
    const updated = EventModel.update(parseId(req.params.id), ValidationService.event(req.body));
    if (!updated) {
      throw new HttpError(404, "Evento nao encontrado.");
    }
    await GoogleCalendarService.syncEvent(updated);
    res.json({ event: updated });
  },

  async remove(req: Request, res: Response): Promise<void> {
    const id = parseId(req.params.id);
    if (!EventModel.findById(id)) {
      throw new HttpError(404, "Evento nao encontrado.");
    }
    await GoogleCalendarService.deleteEvent(id);
    EventModel.remove(id);
    res.status(204).end();
  },

  /** Exporta um unico evento como .ics (abre direto no Calendario do iPhone). */
  exportOne(req: Request, res: Response): void {
    const event = EventModel.findById(parseId(req.params.id));
    if (!event) {
      throw new HttpError(404, "Evento nao encontrado.");
    }
    const item: CalendarItem = { ...event, source: "event", entryId: null };
    sendIcs(res, `evento-${event.id}.ics`, IcsService.build([item], "Financas Casal"));
  },

  /** Exporta o vencimento de um lancamento financeiro (gasto fixo ou cartao) como .ics. */
  exportEntry(req: Request, res: Response): void {
    const entry = EntryModel.findById(parseId(req.params.id));
    const item = entry ? entryToItem(entry) : null;
    if (!item) {
      throw new HttpError(404, "Lancamento sem dia de vencimento.");
    }
    sendIcs(res, `vencimento-${entry?.id ?? 0}.ics`, IcsService.build([item], "Financas Casal"));
  },

  /** Exporta todos os itens do periodo (eventos + vencimentos) em um .ics. */
  exportRange(req: Request, res: Response): void {
    const { from, to } = parseRange(req);
    const items = CalendarService.items(from, to, parseProfiles(req.query.profile));
    sendIcs(res, `calendario-${from}_a_${to}.ics`, IcsService.build(items, "Financas Casal"));
  },

  /**
   * Feed de assinatura (webcal://) por usuario, autenticado pelo token secreto na URL.
   * O iPhone consulta periodicamente e mantem o calendario sincronizado.
   */
  feed(req: Request, res: Response): void {
    const raw = typeof req.params.token === "string" ? req.params.token : "";
    const token = raw.replace(/\.ics$/i, "");
    const user = /^[a-f0-9]{48}$/.test(token) ? UserModel.findByFeedToken(token) : null;
    if (!user) {
      throw new HttpError(404, "Calendario nao encontrado.");
    }
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 10);
    const to = `${today.getFullYear() + 1}-12-31`;
    const items = CalendarService.items(from, to, [user.profileId]);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.send(IcsService.build(items, `Financas - ${user.displayName}`));
  },
};
