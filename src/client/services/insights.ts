import { formatMoney, formatPercent } from "../core/format.js";
import type { CalendarItem, Entry, MonthSummary } from "../models/types.js";

export type InsightLevel = "good" | "warning" | "critical" | "info";

export interface Insight {
  level: InsightLevel;
  title: string;
  text: string;
}

/**
 * Analise critica do mes. Usa a referencia 50/30/20
 * (ate 50% em necessidades, ate 30% em desejos, ao menos 20% poupado)
 * apenas como parametro de comparacao, nao como regra rigida.
 */
export function buildInsights(summary: MonthSummary, entries: Entry[], upcoming: CalendarItem[]): Insight[] {
  const out: Insight[] = [];
  const t = summary.totals;
  const income = t.income;

  if (income <= 0) {
    const hasSpending = t.fixed + t.variable + t.card > 0;
    out.push({
      level: hasSpending ? "critical" : "info",
      title: "Renda nao informada",
      text: hasSpending
        ? "Ha gastos lancados mas nenhuma renda neste mes. Sem a renda, o saldo e os percentuais ficam distorcidos."
        : "Comece preenchendo o salario em Financas. Todos os indicadores dependem da renda do mes.",
    });
    return out;
  }

  if (summary.balance < 0) {
    out.push({
      level: "critical",
      title: "Mes fechando no negativo",
      text: `Os compromissos superam a renda em ${formatMoney(Math.abs(summary.balance))}. Revise os gastos variaveis antes de reduzir a reserva.`,
    });
  } else {
    out.push({
      level: summary.balance / income < 0.05 ? "warning" : "good",
      title: "Saldo livre",
      text: `Sobram ${formatMoney(summary.balance)} (${formatPercent(summary.balance / income)} da renda) apos todos os compromissos e aportes.`,
    });
  }

  const fixedShare = t.fixed / income;
  if (fixedShare > 0.5) {
    out.push({
      level: fixedShare > 0.65 ? "critical" : "warning",
      title: "Gastos fixos elevados",
      text: `Fixos consomem ${formatPercent(fixedShare)} da renda (referencia: ate 50%). Custo fixo alto reduz a margem para imprevistos.`,
    });
  }

  const savings = summary.savingsRate;
  out.push({
    level: savings >= 0.2 ? "good" : savings >= 0.1 ? "warning" : "critical",
    title: "Taxa de poupanca",
    text:
      savings >= 0.2
        ? `${formatPercent(savings)} da renda foi para reserva e investimentos. Acima da referencia de 20%.`
        : `Apenas ${formatPercent(savings)} da renda foi poupada (referencia: 20%). Faltam ${formatMoney(Math.max(0, income * 0.2 - t.emergency - t.investment))} para atingir a meta.`,
  });

  const variable = entries.filter((e) => e.section === "variable" && e.amount > 0).sort((a, b) => b.amount - a.amount);
  if (variable.length > 0 && t.variable > 0) {
    const top = variable[0];
    out.push({
      level: "info",
      title: "Maior gasto variavel",
      text: `${top.description} representa ${formatPercent(top.amount / t.variable)} dos gastos variaveis (${formatMoney(top.amount)}).`,
    });
  }

  if (t.card > 0 && t.card / income > 0.3) {
    out.push({
      level: "warning",
      title: "Faturas de cartao altas",
      text: `Cartoes somam ${formatPercent(t.card / income)} da renda. Confirme se nenhuma compra foi lancada tambem em gastos variaveis (contagem dupla).`,
    });
  }

  const unpaid = entries.filter((e) => (e.section === "fixed" || e.section === "card") && e.amount > 0 && !e.paid);
  if (unpaid.length > 0) {
    const total = unpaid.reduce((s, e) => s + e.amount, 0);
    out.push({
      level: "info",
      title: "Contas em aberto",
      text: `${unpaid.length} conta(s) ainda nao marcadas como pagas, somando ${formatMoney(total)}.`,
    });
  }

  const dueSoon = upcoming.filter((i) => !i.done && (i.category === "bill" || i.category === "card"));
  if (dueSoon.length > 0) {
    out.push({
      level: "warning",
      title: "Vencimentos proximos",
      text: `${dueSoon.length} vencimento(s) nos proximos 7 dias. Confira o calendario.`,
    });
  }

  return out;
}
