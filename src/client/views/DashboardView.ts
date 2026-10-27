import { clear, h, icon } from "../core/dom.js";
import { formatDateShort, formatMoney, formatPercent, MONTHS, MONTHS_SHORT } from "../core/format.js";
import type { CalendarItem, Entry, MonthSummary, MonthSummaryResponse, ViewProfile, YearSummaryResponse } from "../models/types.js";
import { CATEGORY_META, OWNER_NAMES, PROFILE_NAMES, PROFILES, SECTIONS } from "../models/types.js";
import type { Insight } from "../services/insights.js";
import { barConfig, doughnutConfig, renderChart, trendConfig } from "./charts.js";

export interface DashboardData {
  view: ViewProfile;
  year: number;
  month: number;
  summary: MonthSummaryResponse;
  yearSummary: YearSummaryResponse;
  entries: Entry[];
  upcoming: CalendarItem[];
  insights: Insight[];
  offline: boolean;
}

function pick(summary: MonthSummaryResponse, view: ViewProfile): MonthSummary {
  if (view === "joint") return summary.joint;
  return summary.profiles.find((p) => p.profileId === view) ?? summary.joint;
}

function kpi(label: string, value: number, hint: string, iconName: string, tone: "neutral" | "good" | "bad" | "accent"): HTMLElement {
  return h(
    "article",
    { class: `kpi kpi-${tone}` },
    h("div", { class: "kpi-head" }, h("span", { class: "kpi-icon" }, icon(iconName)), h("span", { class: "kpi-label" }, label)),
    h("div", { class: "kpi-value" }, formatMoney(value)),
    h("div", { class: "kpi-hint" }, hint)
  );
}

function card(title: string, subtitle: string, body: HTMLElement, extraClass = ""): HTMLElement {
  return h("article", { class: `card ${extraClass}`.trim() }, h("header", { class: "card-head" }, h("div", {}, h("h2", {}, title), subtitle ? h("p", {}, subtitle) : null)), body);
}

const SPEND_SECTIONS = SECTIONS.filter((s) => s.id !== "income");

export function renderDashboard(container: HTMLElement, data: DashboardData, onGoTo: (route: "finance" | "calendar") => void): void {
  clear(container);
  const s = pick(data.summary, data.view);
  const t = s.totals;
  const income = t.income;
  const pct = (v: number): string => (income > 0 ? `${formatPercent(v / income)} da renda` : "sem renda informada");
  const scopeLabel = data.view === "joint" ? "Ingrid + Felipp" : PROFILE_NAMES[data.view];

  if (data.offline) {
    container.appendChild(h("div", { class: "banner banner-warning" }, icon("alert"), "Sem conexao: exibindo a ultima copia salva neste navegador."));
  }

  // KPIs
  container.appendChild(
    h(
      "div",
      { class: "kpi-grid" },
      kpi("Renda do mes", income, `${MONTHS[data.month - 1]} ${data.year} - ${scopeLabel}`, "income", "neutral"),
      kpi("Gastos (fixos + variaveis + cartoes)", t.fixed + t.variable + t.card, pct(t.fixed + t.variable + t.card), "cart", "accent"),
      kpi("Poupado (reserva + investimentos)", t.emergency + t.investment, pct(t.emergency + t.investment), "shield", "good"),
      kpi("Saldo livre", s.balance, s.balance < 0 ? "Atencao: mes negativo" : pct(s.balance), "wallet", s.balance < 0 ? "bad" : "good")
    )
  );

  // Composicao da renda (barra empilhada horizontal)
  const total = Math.max(income, s.committed, 1);
  const segments = SPEND_SECTIONS.map((sec) => ({ sec, value: t[sec.id] })).filter((x) => x.value > 0);
  const stack = h(
    "div",
    { class: "stackbar" },
    segments.map((x) => {
      const el = h("span", { class: "stackbar-seg", title: `${x.sec.title}: ${formatMoney(x.value)}` });
      el.style.width = `${(x.value / total) * 100}%`;
      el.style.background = x.sec.color;
      return el;
    }),
    (() => {
      if (s.balance <= 0) return null;
      const el = h("span", { class: "stackbar-seg stackbar-free", title: `Saldo livre: ${formatMoney(s.balance)}` });
      el.style.width = `${(s.balance / total) * 100}%`;
      return el;
    })()
  );
  const legend = h(
    "div",
    { class: "stack-legend" },
    SPEND_SECTIONS.map((sec) => {
      const dot = h("i", {});
      dot.style.background = sec.color;
      return h("span", {}, dot, sec.short, h("b", {}, formatMoney(t[sec.id])));
    }),
    h("span", {}, h("i", { class: "free-dot" }), "Saldo livre", h("b", {}, formatMoney(s.balance)))
  );
  container.appendChild(card("Para onde vai a renda", "Renda - fixos - reserva - investimentos - variaveis - cartoes = saldo livre", h("div", {}, stack, legend), "card-full"));

  // Graficos
  const distCanvas = h("canvas", { "aria-label": "Distribuicao de gastos" });
  const trendCanvas = h("canvas", { "aria-label": "Evolucao anual" });
  container.appendChild(
    h(
      "div",
      { class: "grid-2" },
      card(
        data.view === "joint" ? "Comparativo Ingrid x Felipp" : "Distribuicao de gastos",
        data.view === "joint" ? "Valores por secao no mes" : `Por secao - ${scopeLabel}`,
        h("div", { class: "chart-box" }, distCanvas)
      ),
      card(`Evolucao ${data.year}`, "Renda, saidas e saldo livre por mes", h("div", { class: "chart-box" }, trendCanvas))
    )
  );

  if (data.view === "joint") {
    renderChart(
      "dist",
      distCanvas,
      barConfig(
        SECTIONS.map((x) => x.short),
        PROFILES.map((p) => {
          const ps = data.summary.profiles.find((x) => x.profileId === p);
          return {
            label: PROFILE_NAMES[p],
            data: SECTIONS.map((x) => (ps ? ps.totals[x.id] : 0)),
            backgroundColor: SECTIONS.map((section) => section.color),
          };
        })
      )
    );
  } else {
    const parts = SPEND_SECTIONS.filter((x) => t[x.id] > 0);
    if (parts.length === 0) {
      distCanvas.replaceWith(h("div", { class: "empty" }, icon("chart"), h("p", {}, "Sem gastos lancados neste mes.")));
    } else {
      renderChart("dist", distCanvas, doughnutConfig(parts.map((x) => x.title), parts.map((x) => t[x.id]), parts.map((x) => x.color)));
    }
  }

  const monthly = data.yearSummary.months.map((m) => (data.view === "joint" ? m.joint : m.profiles.find((p) => p.profileId === data.view) ?? m.joint));
  renderChart(
    "trend",
    trendCanvas,
    trendConfig(MONTHS_SHORT.slice(), [
      { label: "Renda", data: monthly.map((m) => m.totals.income), color: "#CBD5E1", type: "bar" },
      { label: "Saidas", data: monthly.map((m) => m.committed), color: "#1F6FEB", type: "bar" },
      { label: "Saldo livre", data: monthly.map((m) => m.balance), color: "#0E9F6E", type: "line" },
    ])
  );

  // Analise + proximos compromissos
  const insightList = h(
    "ul",
    { class: "insights" },
    data.insights.map((i) =>
      h("li", { class: `insight insight-${i.level}` }, h("span", { class: "insight-dot" }), h("div", {}, h("strong", {}, i.title), h("p", {}, i.text)))
    )
  );
  const upcomingList =
    data.upcoming.length === 0
      ? h("div", { class: "empty" }, icon("calendar"), h("p", {}, "Nenhum compromisso nos proximos 7 dias."))
      : h(
          "ul",
          { class: "agenda" },
          data.upcoming.slice(0, 8).map((i) => {
            const bar = h("span", { class: "agenda-bar" });
            bar.style.background = CATEGORY_META[i.category].color;
            return h(
              "li",
              { class: i.done ? "done" : "" },
              bar,
              h("div", { class: "agenda-date" }, formatDateShort(i.date), h("small", {}, i.time ?? "dia")),
              h("div", { class: "agenda-main" }, h("strong", {}, i.title), h("small", {}, `${CATEGORY_META[i.category].label} - ${OWNER_NAMES[i.owner]}`)),
              i.amount !== null ? h("span", { class: "agenda-amount" }, formatMoney(i.amount)) : null
            );
          })
        );

  container.appendChild(
    h(
      "div",
      { class: "grid-2" },
      card("Analise do mes", "Leitura critica com base na referencia 50/30/20", insightList),
      (() => {
        const c = card("Proximos 7 dias", "Compromissos e vencimentos", upcomingList);
        c.querySelector(".card-head")?.appendChild(h("button", { class: "btn btn-ghost btn-sm", type: "button", onclick: () => onGoTo("calendar") }, "Abrir calendario", icon("chevron-right")));
        return c;
      })()
    )
  );

  // Tabela resumo por perfil (sempre visivel, util para comparar)
  const rows = [...data.summary.profiles, data.summary.joint];
  container.appendChild(
    card(
      "Resumo por perfil",
      `${MONTHS[data.month - 1]} de ${data.year}`,
      h(
        "div",
        { class: "table-wrap" },
        h(
          "table",
          { class: "table table-summary" },
          h("thead", {}, h("tr", {}, h("th", {}, "Perfil"), SECTIONS.map((x) => h("th", { class: "num" }, x.short)), h("th", { class: "num" }, "Saldo"))),
          h(
            "tbody",
            {},
            rows.map((r) =>
              h(
                "tr",
                { class: r.profileId === "joint" ? "row-total" : "" },
                h("td", {}, r.profileId === "joint" ? "Conjunto" : PROFILE_NAMES[r.profileId]),
                SECTIONS.map((x) => h("td", { class: "num" }, formatMoney(r.totals[x.id]))),
                h("td", { class: `num ${r.balance < 0 ? "neg" : "pos"}` }, formatMoney(r.balance))
              )
            )
          )
        )
      ),
      "card-full"
    )
  );
  const editBtn = h("button", { class: "btn btn-primary", type: "button", onclick: () => onGoTo("finance") }, icon("edit"), h("span", {}, "Editar lancamentos"));
  container.appendChild(h("div", { class: "page-actions" }, editBtn));
}
