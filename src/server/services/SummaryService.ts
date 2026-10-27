import { EntryModel } from "../models/EntryModel";
import type { Entry, MonthSummary, ProfileId, SectionTotals } from "../types/domain";
import { PROFILE_IDS } from "../types/domain";
import { roundMoney } from "../utils/helpers";

function emptyTotals(): SectionTotals {
  return { income: 0, fixed: 0, emergency: 0, investment: 0, variable: 0, card: 0 };
}

function totalsOf(entries: Entry[]): SectionTotals {
  const t = emptyTotals();
  for (const e of entries) {
    t[e.section] = roundMoney(t[e.section] + e.amount);
  }
  return t;
}

/**
 * Regra de saldo:
 *   saldo = renda - fixos - reserva - investimentos - variaveis - faturas de cartao.
 * Reserva e investimentos entram como "saida" do caixa do mes (dinheiro alocado),
 * para o saldo representar o que esta realmente livre para gastar.
 */
function buildSummary(profileId: ProfileId | "joint", year: number, month: number, entries: Entry[]): MonthSummary {
  const totals = totalsOf(entries);
  const committed = roundMoney(totals.fixed + totals.emergency + totals.investment + totals.variable + totals.card);
  const balance = roundMoney(totals.income - committed);
  const savingsRate = totals.income > 0 ? (totals.emergency + totals.investment) / totals.income : 0;
  const commitmentRate = totals.income > 0 ? (totals.fixed + totals.variable + totals.card) / totals.income : 0;
  return { profileId, year, month, totals, committed, balance, savingsRate, commitmentRate };
}

export const SummaryService = {
  month(year: number, month: number): { profiles: MonthSummary[]; joint: MonthSummary } {
    const entries = EntryModel.list({ year, month });
    const profiles = PROFILE_IDS.map((p) => buildSummary(p, year, month, entries.filter((e) => e.profileId === p)));
    return { profiles, joint: buildSummary("joint", year, month, entries) };
  },

  year(year: number): Array<{ month: number; profiles: MonthSummary[]; joint: MonthSummary }> {
    const entries = EntryModel.list({ year });
    const out: Array<{ month: number; profiles: MonthSummary[]; joint: MonthSummary }> = [];
    for (let month = 1; month <= 12; month += 1) {
      const monthEntries = entries.filter((e) => e.month === month);
      out.push({
        month,
        profiles: PROFILE_IDS.map((p) => buildSummary(p, year, month, monthEntries.filter((e) => e.profileId === p))),
        joint: buildSummary("joint", year, month, monthEntries),
      });
    }
    return out;
  },
};
