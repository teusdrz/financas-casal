import type { CalendarItem } from "../types/domain";

/**
 * Gera arquivos iCalendar (RFC 5545) compativeis com o Calendario do iPhone,
 * Google Agenda e Outlook. Horarios sao "flutuantes" (sem fuso), entao o iPhone
 * os interpreta no fuso local do aparelho.
 */

const CATEGORY_LABEL: Record<CalendarItem["category"], string> = {
  bill: "Conta a pagar",
  card: "Fatura de cartao",
  appointment: "Compromisso",
  meeting: "Reuniao",
  health: "Saude",
  other: "Outro",
};

function escapeText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Dobra linhas longas em blocos de no maximo 75 octetos (exigencia da RFC). */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) {
    return line;
  }
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const char of line) {
    const size = Buffer.byteLength(char, "utf8");
    const limit = parts.length === 0 ? 75 : 74;
    if (currentBytes + size > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
    }
    current += char;
    currentBytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

function stamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function compactDate(date: string): string {
  return date.replace(/-/g, "");
}

function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10).replace(/-/g, "");
}

function addMinutes(date: string, time: string, minutes: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, hh, mm + minutes));
  return dt.toISOString().slice(0, 16).replace(/[-:]/g, "") + "00";
}

function formatMoney(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function vevent(item: CalendarItem, now: Date): string[] {
  const uid = item.source === "entry" ? `entry-${item.entryId ?? 0}@financas-casal` : `event-${item.id}@financas-casal`;
  const descriptionParts = [CATEGORY_LABEL[item.category]];
  if (item.amount !== null) descriptionParts.push(`Valor: ${formatMoney(item.amount)}`);
  if (item.notes) descriptionParts.push(item.notes);

  const lines = ["BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${stamp(now)}`];
  if (item.time) {
    lines.push(`DTSTART:${compactDate(item.date)}T${item.time.replace(":", "")}00`);
    lines.push(`DTEND:${addMinutes(item.date, item.time, 60)}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(item.date)}`);
    lines.push(`DTEND;VALUE=DATE:${nextDay(item.date)}`);
  }
  lines.push(`SUMMARY:${escapeText(item.title)}`);
  lines.push(`DESCRIPTION:${escapeText(descriptionParts.join("\n"))}`);
  lines.push(`CATEGORIES:${escapeText(CATEGORY_LABEL[item.category])}`);
  lines.push("TRANSP:TRANSPARENT");
  if (item.alarmMinutes >= 0) {
    // Para eventos de dia inteiro, o gatilho e relativo a 00:00 do dia.
    // Somamos 9h ao alarme para que "1 dia antes" dispare as 09:00 da vespera.
    const minutes = item.time ? item.alarmMinutes : Math.max(item.alarmMinutes - 540, -540);
    const trigger = minutes >= 0 ? `-PT${minutes}M` : `PT${Math.abs(minutes)}M`;
    lines.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${escapeText(item.title)}`, `TRIGGER:${trigger}`, "END:VALARM");
  }
  lines.push("END:VEVENT");
  return lines;
}

export const IcsService = {
  build(items: CalendarItem[], calendarName: string): string {
    const now = new Date();
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Financas Casal//Calendario Financeiro//PT-BR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      `X-WR-CALNAME:${escapeText(calendarName)}`,
      "X-WR-TIMEZONE:America/Sao_Paulo",
      "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
      "X-PUBLISHED-TTL:PT1H",
    ];
    for (const item of items) {
      lines.push(...vevent(item, now));
    }
    lines.push("END:VCALENDAR");
    return lines.map(fold).join("\r\n") + "\r\n";
  },
};
