import { button, clear, h, icon } from "../core/dom.js";
import { daysInMonth, formatDateLong, formatMoney, isoDate, MONTHS, todayIso, WEEKDAYS_SHORT } from "../core/format.js";
import type { CalendarItem } from "../models/types.js";
import { CATEGORY_META, OWNER_NAMES } from "../models/types.js";

export interface CalendarHandlers {
  onSelectDay(date: string): void;
  onAdd(date: string): void;
  onEdit(item: CalendarItem): void;
  onDelete(item: CalendarItem): void;
  onToggleDone(item: CalendarItem): void;
  onExportItem(item: CalendarItem): void;
  onExportMonth(): void;
  onOpenSync(): void;
}

export interface CalendarData {
  year: number;
  month: number;
  selected: string;
  items: CalendarItem[];
  offline: boolean;
}

function chip(item: CalendarItem): HTMLElement {
  const el = h("span", { class: `chip ${item.done ? "chip-done" : ""}`, title: item.title }, item.time ? h("b", {}, item.time) : null, item.title.replace(/^Vencimento: /, "").replace(/ \((Ingrid|Felipp)\)$/, ""));
  el.style.setProperty("--c", CATEGORY_META[item.category].color);
  return el;
}

export function renderCalendar(container: HTMLElement, data: CalendarData, handlers: CalendarHandlers): void {
  clear(container);
  const today = todayIso();
  const firstWeekday = new Date(data.year, data.month - 1, 1).getDay();
  const total = daysInMonth(data.year, data.month);
  const byDate = new Map<string, CalendarItem[]>();
  data.items.forEach((i) => byDate.set(i.date, [...(byDate.get(i.date) ?? []), i]));

  const cells: HTMLElement[] = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(h("div", { class: "day day-out" }));
  for (let d = 1; d <= total; d += 1) {
    const iso = isoDate(data.year, data.month, d);
    const items = byDate.get(iso) ?? [];
    const pendingBills = items.filter((x) => !x.done && (x.category === "bill" || x.category === "card")).length;
    const cls = ["day", iso === today ? "day-today" : "", iso === data.selected ? "day-selected" : "", iso < today ? "day-past" : ""].filter(Boolean).join(" ");
    cells.push(
      h(
        "button",
        { class: cls, type: "button", "aria-label": `${d} de ${MONTHS[data.month - 1]}, ${items.length} item(s)`, onclick: () => handlers.onSelectDay(iso), ondblclick: () => handlers.onAdd(iso) },
        h("span", { class: "day-num" }, d, pendingBills > 0 ? h("span", { class: "day-alert", title: `${pendingBills} vencimento(s) em aberto` }) : null),
        h("span", { class: "day-chips" }, items.slice(0, 3).map(chip), items.length > 3 ? h("span", { class: "chip-more" }, `+${items.length - 3}`) : null),
        h(
          "span",
          { class: "day-dots" },
          items.slice(0, 4).map((x) => {
            const dot = h("i", {});
            dot.style.background = CATEGORY_META[x.category].color;
            return dot;
          })
        )
      )
    );
  }

  const monthTotal = data.items.filter((i) => i.amount !== null && (i.category === "bill" || i.category === "card")).reduce((s, i) => s + (i.amount ?? 0), 0);
  const openTotal = data.items.filter((i) => !i.done && i.amount !== null && (i.category === "bill" || i.category === "card")).reduce((s, i) => s + (i.amount ?? 0), 0);

  const grid = h(
    "article",
    { class: "card calendar-card" },
    h(
      "header",
      { class: "card-head" },
      h("div", {}, h("h2", {}, `${MONTHS[data.month - 1]} de ${data.year}`), h("p", {}, `Contas no mes: ${formatMoney(monthTotal)} - em aberto: ${formatMoney(openTotal)}`)),
      h(
        "div",
        { class: "head-actions" },
        button("Exportar mes (.ics)", { icon: "download", variant: "ghost", small: true, onClick: handlers.onExportMonth }),
        button("Sincronizar iPhone", { icon: "phone", variant: "ghost", small: true, onClick: handlers.onOpenSync })
      )
    ),
    h("div", { class: "weekdays" }, WEEKDAYS_SHORT.map((w) => h("span", {}, w))),
    h("div", { class: "month-grid" }, cells),
    h(
      "div",
      { class: "cal-legend" },
      (Object.keys(CATEGORY_META) as Array<keyof typeof CATEGORY_META>).map((k) => {
        const dot = h("i", {});
        dot.style.background = CATEGORY_META[k].color;
        return h("span", {}, dot, CATEGORY_META[k].label);
      })
    )
  );

  const dayItems = byDate.get(data.selected) ?? [];
  const panel = h(
    "article",
    { class: "card day-panel" },
    h(
      "header",
      { class: "card-head" },
      h("div", {}, h("h2", { class: "first-cap" }, formatDateLong(data.selected)), h("p", {}, `${dayItems.length} item(s)`)),
      button("Novo", { icon: "plus", variant: "primary", small: true, onClick: () => handlers.onAdd(data.selected) })
    ),
    dayItems.length === 0
      ? h("div", { class: "empty" }, icon("calendar"), h("p", {}, "Nada agendado. Clique em Novo para adicionar um compromisso ou vencimento."))
      : h(
          "ul",
          { class: "day-list" },
          dayItems.map((item) => {
            const bar = h("span", { class: "agenda-bar" });
            bar.style.background = CATEGORY_META[item.category].color;
            const derived = item.source === "entry";
            const external = item.source === "google";
            return h(
              "li",
              { class: item.done ? "done" : "" },
              bar,
              h(
                "div",
                { class: "day-item-main" },
                h("strong", {}, item.title),
                h(
                  "small",
                  {},
                  [item.time ?? "Dia inteiro", CATEGORY_META[item.category].label, OWNER_NAMES[item.owner], item.amount !== null ? formatMoney(item.amount) : ""].filter(Boolean).join(" - ")
                ),
                item.notes ? h("p", {}, item.notes) : null,
                external ? h("span", { class: "tag tag-muted" }, "Google Calendar - somente leitura") : null,
                derived ? h("span", { class: "tag tag-muted" }, "Gerado pelas financas") : null
              ),
              external ? null : h(
                "div",
                { class: "day-item-actions" },
                button("", { icon: "phone", variant: "ghost", small: true, title: "Adicionar ao Calendario do iPhone (.ics)", onClick: () => handlers.onExportItem(item) }),
                button("", { icon: "check", variant: "ghost", small: true, title: item.done ? "Marcar como pendente" : "Marcar como concluido/pago", onClick: () => handlers.onToggleDone(item) }),
                button("", { icon: "edit", variant: "ghost", small: true, title: derived ? "Editar no controle financeiro" : "Editar", onClick: () => handlers.onEdit(item) }),
                derived ? null : button("", { icon: "trash", variant: "ghost", small: true, title: "Excluir", onClick: () => handlers.onDelete(item) })
              )
            );
          })
        )
  );

  if (data.offline) {
    container.appendChild(h("div", { class: "banner banner-warning" }, icon("alert"), "Sem conexao: exibindo a ultima copia salva."));
  }
  container.appendChild(h("div", { class: "calendar-layout" }, grid, panel));
}
