import type { Request, Response } from "express";
import { EntryModel } from "../models/EntryModel";
import { ValidationService } from "../services/ValidationService";
import type { EntrySection } from "../types/domain";
import { ENTRY_SECTIONS } from "../types/domain";
import { HttpError } from "../utils/HttpError";

function parseId(raw: unknown): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(400, "Identificador invalido.");
  }
  return id;
}

export const EntryController = {
  list(req: Request, res: Response): void {
    const { year, month } = ValidationService.period(req.query.year, req.query.month);
    res.json({ entries: EntryModel.list({ year, month }) });
  },

  create(req: Request, res: Response): void {
    const input = ValidationService.entry(req.body);
    res.status(201).json({ entry: EntryModel.create(input) });
  },

  update(req: Request, res: Response): void {
    const id = parseId(req.params.id);
    const input = ValidationService.entry(req.body);
    const updated = EntryModel.update(id, input);
    if (!updated) {
      throw new HttpError(404, "Lancamento nao encontrado.");
    }
    res.json({ entry: updated });
  },

  remove(req: Request, res: Response): void {
    const id = parseId(req.params.id);
    if (!EntryModel.remove(id)) {
      throw new HttpError(404, "Lancamento nao encontrado.");
    }
    res.status(204).end();
  },

  /** Copia a estrutura do mes anterior (ou de um mes informado) para o mes atual. */
  copyMonth(req: Request, res: Response): void {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const profileId = ValidationService.profile(body.profileId);
    const to = ValidationService.period(body.year, body.month);
    const from =
      body.fromYear !== undefined && body.fromMonth !== undefined
        ? ValidationService.period(body.fromYear, body.fromMonth)
        : to.month === 1
          ? { year: to.year - 1, month: 12 }
          : { year: to.year, month: to.month - 1 };
    const sectionsRaw = Array.isArray(body.sections) ? body.sections : ENTRY_SECTIONS;
    const sections = sectionsRaw.filter((s): s is EntrySection =>
      typeof s === "string" && (ENTRY_SECTIONS as readonly string[]).includes(s)
    );
    const copied = EntryModel.copyMonth(profileId, from, to, sections);
    res.json({ copied, from });
  },
};
