import { EntryModel } from "../models/EntryModel";
import { EventModel } from "../models/EventModel";
import type { BackupPayload, CalendarEvent, Entry } from "../types/domain";
import { PROFILE_NAMES } from "../types/domain";
import { HttpError } from "../utils/HttpError";
import { nowIso } from "../utils/helpers";
import { ValidationService } from "./ValidationService";

const SECTION_LABEL: Record<Entry["section"], string> = {
  income: "Renda",
  fixed: "Gasto fixo",
  emergency: "Reserva de emergencia",
  investment: "Investimento",
  variable: "Gasto variavel",
  card: "Cartao de credito",
};

const CATEGORY_LABEL: Record<CalendarEvent["category"], string> = {
  bill: "Conta a pagar",
  card: "Fatura de cartao",
  appointment: "Compromisso",
  meeting: "Reuniao",
  health: "Saude",
  other: "Outro",
};

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const text = typeof value === "number" ? value.toFixed(2).replace(".", ",") : value;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV com separador ";" e BOM UTF-8 para abrir corretamente no Excel em portugues. */
function toCsv(header: string[], rows: Array<Array<string | number | null>>): string {
  const body = [header, ...rows].map((r) => r.map((c) => csvCell(c)).join(";")).join("\r\n");
  return `﻿${body}\r\n`;
}

export const BackupService = {
  exportJson(): BackupPayload {
    return {
      app: "financas-casal",
      version: 1,
      exportedAt: nowIso(),
      entries: EntryModel.list(),
      events: EventModel.list(),
    };
  },

  exportEntriesCsv(): string {
    const rows = EntryModel.list().map((e) => [
      PROFILE_NAMES[e.profileId],
      e.year,
      e.month,
      SECTION_LABEL[e.section],
      e.description,
      e.amount,
      e.dueDay === null ? "" : String(e.dueDay),
      e.paid ? "Sim" : "Nao",
    ]);
    return toCsv(["Perfil", "Ano", "Mes", "Secao", "Descricao", "Valor", "Vencimento", "Pago"], rows);
  },

  exportEventsCsv(): string {
    const rows = EventModel.list().map((e) => [
      e.owner === "shared" ? "Casal" : PROFILE_NAMES[e.owner],
      e.date,
      e.time ?? "Dia inteiro",
      e.title,
      CATEGORY_LABEL[e.category],
      e.amount,
      e.notes,
      String(e.alarmMinutes),
      e.done ? "Sim" : "Nao",
    ]);
    return toCsv(["Responsavel", "Data", "Horario", "Titulo", "Categoria", "Valor", "Observacoes", "Alarme (min)", "Concluido"], rows);
  },

  /** Restaura um backup JSON. Valida tudo antes de substituir os dados atuais. */
  importJson(raw: unknown): { entries: number; events: number } {
    if (typeof raw !== "object" || raw === null) {
      throw new HttpError(400, "Arquivo de backup invalido.");
    }
    const payload = raw as Partial<BackupPayload>;
    if (payload.app !== "financas-casal" || !Array.isArray(payload.entries) || !Array.isArray(payload.events)) {
      throw new HttpError(400, "Este arquivo nao e um backup do Financas Casal.");
    }
    const now = nowIso();
    const entries: Entry[] = payload.entries.map((e, i) => {
      try {
        return { ...ValidationService.entry(e), id: 0, createdAt: now, updatedAt: now };
      } catch {
        throw new HttpError(400, `Lancamento ${i + 1} do backup e invalido.`);
      }
    });
    const events: CalendarEvent[] = payload.events.map((e, i) => {
      try {
        return { ...ValidationService.event(e), id: 0, createdAt: now, updatedAt: now };
      } catch {
        throw new HttpError(400, `Evento ${i + 1} do backup e invalido.`);
      }
    });
    EntryModel.replaceAll(entries);
    EventModel.replaceAll(events);
    return { entries: entries.length, events: events.length };
  },
};
