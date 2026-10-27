import { button, clear, h, icon } from "../core/dom.js";
import { formatMoney, moneyInputValue, MONTHS, parseMoney } from "../core/format.js";
import type { Entry, EntrySection, MonthSummary, ViewProfile } from "../models/types.js";
import { PROFILE_NAMES, SECTIONS } from "../models/types.js";

export interface FinanceHandlers {
  onAdd(section: EntrySection): void;
  onEdit(entry: Entry): void;
  onDelete(entry: Entry): void;
  onAmount(entry: Entry, amount: number): void;
  onTogglePaid(entry: Entry, paid: boolean): void;
  onExportEntry(entry: Entry): void;
  onCopyMonth(): void;
}

export interface FinanceData {
  view: ViewProfile;
  year: number;
  month: number;
  entries: Entry[];
  summary: MonthSummary;
  offline: boolean;
}

function amountInput(entry: Entry, onCommit: (value: number) => void, disabled: boolean): HTMLInputElement {
  const input = h("input", {
    class: "input input-money",
    value: moneyInputValue(entry.amount),
    inputmode: "decimal",
    "aria-label": `Valor de ${entry.description}`,
    "data-entry-id": entry.id,
    disabled,
  });
  const commit = (): void => {
    const value = parseMoney(input.value);
    if (value === null) {
      input.classList.add("invalid");
      return;
    }
    input.classList.remove("invalid");
    input.value = moneyInputValue(value);
    if (value !== entry.amount) onCommit(value);
  };
  input.addEventListener("focus", () => input.select());
  input.addEventListener("blur", commit);
  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter") input.blur();
    if (e.key === "Escape") {
      input.value = moneyInputValue(entry.amount);
      input.blur();
    }
  });
  return input;
}

export function renderFinance(container: HTMLElement, data: FinanceData, handlers: FinanceHandlers): void {
  clear(container);
  const joint = data.view === "joint";
  const t = data.summary.totals;

  if (data.offline) {
    container.appendChild(h("div", { class: "banner banner-warning" }, icon("alert"), "Sem conexao: edicao desativada ate o servidor responder."));
  }

  container.appendChild(
    h(
      "div",
      { class: "toolbar" },
      h(
        "div",
        { class: "toolbar-summary" },
        h("span", {}, "Renda ", h("b", {}, formatMoney(t.income))),
        h("span", {}, "Saidas ", h("b", {}, formatMoney(data.summary.committed))),
        h("span", { class: data.summary.balance < 0 ? "neg" : "pos" }, "Saldo livre ", h("b", {}, formatMoney(data.summary.balance)))
      ),
      h(
        "div",
        { class: "toolbar-actions" },
        button(joint ? "Copiar mes anterior (ambos)" : "Copiar mes anterior", { icon: "copy", variant: "ghost", onClick: handlers.onCopyMonth, title: "Traz os itens do mes anterior que ainda nao existem neste mes" })
      )
    )
  );

  const grid = h("div", { class: "finance-grid" });
  for (const meta of SECTIONS) {
    const items = data.entries.filter((e) => e.section === meta.id);
    const total = items.reduce((s, e) => s + e.amount, 0);
    const head = h(
      "header",
      { class: "card-head" },
      h(
        "div",
        { class: "section-title" },
        (() => {
          const badge = h("span", { class: "section-icon" }, icon(meta.icon));
          badge.style.background = `${meta.color}1A`;
          badge.style.color = meta.color;
          return badge;
        })(),
        h("div", {}, h("h2", {}, meta.title), h("p", {}, meta.subtitle))
      ),
      button("", { icon: "plus", variant: "ghost", title: `Adicionar em ${meta.title}`, onClick: () => handlers.onAdd(meta.id), small: true })
    );

    const rows = items.map((e) =>
      h(
        "tr",
        {},
        h("td", { class: "cell-desc" }, h("div", { class: "desc-wrap" }, joint ? h("span", { class: `tag tag-${e.profileId}` }, PROFILE_NAMES[e.profileId]) : null, h("span", {}, e.description))),
        meta.hasDueDate ? h("td", { class: "cell-due" }, e.dueDay ? `dia ${e.dueDay}` : h("span", { class: "muted" }, "-")) : null,
        meta.hasDueDate
          ? h(
              "td",
              { class: "cell-paid" },
              h("input", {
                type: "checkbox",
                checked: e.paid,
                "aria-label": "Pago",
                title: "Marcar como pago",
                disabled: data.offline,
                onchange: (ev: Event) => handlers.onTogglePaid(e, (ev.target as HTMLInputElement).checked),
              })
            )
          : null,
        h("td", { class: "cell-amount" }, amountInput(e, (v) => handlers.onAmount(e, v), data.offline)),
        h(
          "td",
          { class: "cell-actions" },
          meta.hasDueDate && e.dueDay ? button("", { icon: "calendar", variant: "ghost", small: true, title: "Adicionar vencimento ao iPhone (.ics)", onClick: () => handlers.onExportEntry(e) }) : null,
          button("", { icon: "edit", variant: "ghost", small: true, title: "Editar", onClick: () => handlers.onEdit(e) }),
          button("", { icon: "trash", variant: "ghost", small: true, title: "Excluir", onClick: () => handlers.onDelete(e) })
        )
      )
    );

    const subtotals = joint
      ? h(
          "div",
          { class: "subtotals" },
          (["ingrid", "felipp"] as const).map((p) =>
            h("span", {}, PROFILE_NAMES[p], h("b", {}, formatMoney(items.filter((e) => e.profileId === p).reduce((s, e) => s + e.amount, 0))))
          )
        )
      : null;

    const table =
      items.length === 0
        ? h("div", { class: "empty empty-sm" }, h("p", {}, "Nenhum item."), button("Adicionar", { icon: "plus", variant: "ghost", small: true, onClick: () => handlers.onAdd(meta.id) }))
        : h(
            "div",
            { class: "table-wrap" },
            h(
              "table",
              { class: "table table-entries" },
              h(
                "thead",
                {},
                h(
                  "tr",
                  {},
                  h("th", {}, "Descricao"),
                  meta.hasDueDate ? h("th", {}, "Venc.") : null,
                  meta.hasDueDate ? h("th", {}, "Pago") : null,
                  h("th", { class: "num" }, "Valor (R$)"),
                  h("th", { class: "sr-only" }, "Acoes")
                )
              ),
              h("tbody", {}, rows)
            )
          );

    const foot = h("footer", { class: "card-foot" }, subtotals, h("div", { class: "total" }, "Total", h("strong", {}, formatMoney(total))));
    const card = h("article", { class: "card finance-card" }, head, table, foot);
    card.style.setProperty("--accent", meta.color);
    grid.appendChild(card);
  }
  container.appendChild(grid);
  container.appendChild(
    h(
      "p",
      { class: "footnote" },
      icon("info"),
      `Valores de ${MONTHS[data.month - 1]} de ${data.year}. Edite o valor direto no campo e pressione Enter. Dica: se uma compra foi feita no cartao, lance-a apenas em "Cartoes" ou apenas em "Gastos variaveis" para nao contar duas vezes.`
    )
  );
}
