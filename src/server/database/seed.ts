import { env } from "../config/env";
import { EntryModel } from "../models/EntryModel";
import { UserModel } from "../models/UserModel";
import { hashPassword, newFeedToken } from "../services/AuthService";
import type { EntrySection, ProfileId } from "../types/domain";
import { PROFILE_IDS } from "../types/domain";
import { getDatabase } from "./connection";

/**
 * Estrutura inicial de categorias (baseada na estrutura de planilha descrita).
 * Os valores comecam zerados para serem preenchidos pelos usuarios na interface.
 */
const TEMPLATE: Array<{ section: EntrySection; items: string[] }> = [
  { section: "income", items: ["Salario mensal"] },
  {
    section: "fixed",
    items: [
      "Aluguel",
      "Condominio",
      "Energia",
      "Agua",
      "Gas",
      "Internet",
      "Celular",
      "Plano de saude",
      "Seguro do carro",
      "Combustivel",
      "Transporte",
    ],
  },
  { section: "emergency", items: ["Reserva de emergencia"] },
  { section: "investment", items: ["Caixinha Nubank"] },
  { section: "variable", items: ["Mercado", "Farmacia", "Lazer / Restaurantes", "Roupas", "Presentes", "Academia"] },
  { section: "card", items: ["Fatura cartao de credito"] },
];

const USERS: Array<{ username: string; password: string; displayName: string; profileId: ProfileId }> = [
  { username: "ingrid", password: "ingrid", displayName: "Ingrid", profileId: "ingrid" },
  { username: "felipe", password: "felipe", displayName: "Felipp", profileId: "felipp" },
];

export function seedUsers(): void {
  for (const u of USERS) {
    if (!UserModel.findRecordByUsername(u.username)) {
      UserModel.create({
        username: u.username,
        displayName: u.displayName,
        profileId: u.profileId,
        passwordHash: hashPassword(u.password),
        feedToken: newFeedToken(),
      });
    }
  }
}

export function seedEntryTemplate(): void {
  const hasEntries = EntryModel.list({ year: env.baseYear }).length > 0;
  if (hasEntries) {
    return;
  }
  getDatabase().transaction(() => {
    for (const profileId of PROFILE_IDS) {
      for (let month = 1; month <= 12; month += 1) {
        for (const group of TEMPLATE) {
          for (const description of group.items) {
            EntryModel.create({
              profileId,
              year: env.baseYear,
              month,
              section: group.section,
              description,
              amount: 0,
              dueDay: null,
              paid: false,
            });
          }
        }
      }
    }
  });
}

export function runSeed(): void {
  seedUsers();
  seedEntryTemplate();
}
