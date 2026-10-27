import { confirmDialog } from "../core/modal.js";
import { toast } from "../core/toast.js";
import { MONTHS } from "../core/format.js";
import type { Entry, EntryInput, EntrySection, ProfileId } from "../models/types.js";
import { PROFILES, PROFILE_NAMES, SECTIONS } from "../models/types.js";
import { Api } from "../services/api.js";
import { filterByView, Repository } from "../services/repository.js";
import { store } from "../services/store.js";
import { renderFinance } from "../views/FinanceView.js";
import { openEntryForm } from "../views/forms.js";
import type { PageController } from "./PageController.js";
import { openIcs, reportError } from "./helpers.js";

function toInput(e: Entry): EntryInput {
  return { profileId: e.profileId, year: e.year, month: e.month, section: e.section, description: e.description, amount: e.amount, dueDay: e.dueDay, paid: e.paid };
}

export class FinanceController implements PageController {
  private content: HTMLElement | null = null;

  async render(content: HTMLElement): Promise<void> {
    this.content = content;
    const { year, month, view } = store.get();
    try {
      const bundle = await Repository.month(year, month);
      const summary = view === "joint" ? bundle.summary.joint : bundle.summary.profiles.find((p) => p.profileId === view) ?? bundle.summary.joint;
      const focusedId = document.activeElement instanceof HTMLInputElement ? document.activeElement.dataset.entryId : undefined;
      renderFinance(
        content,
        { view, year, month, entries: filterByView(bundle.entries, view), summary, offline: bundle.offline },
        {
          onAdd: (section) => this.add(section),
          onEdit: (entry) => this.edit(entry),
          onDelete: (entry) => void this.remove(entry),
          onAmount: (entry, amount) => void this.save(entry.id, { ...toInput(entry), amount }, false),
          onTogglePaid: (entry, paid) => void this.save(entry.id, { ...toInput(entry), paid }, false),
          onExportEntry: (entry) => openIcs(Api.urls.entryIcs(entry.id)),
          onCopyMonth: () => void this.copyMonth(),
        }
      );
      if (focusedId) {
        const next = content.querySelector<HTMLInputElement>(`input[data-entry-id="${focusedId}"]`);
        next?.focus();
      }
    } catch (error) {
      reportError(error, "Nao foi possivel carregar os lancamentos");
    }
  }

  private refresh(): void {
    if (this.content) void this.render(this.content);
  }

  private defaultProfile(): ProfileId {
    const { view, user } = store.get();
    return view === "joint" ? user?.profileId ?? "ingrid" : view;
  }

  private add(section: EntrySection): void {
    const { year, month } = store.get();
    openEntryForm(
      { profileId: this.defaultProfile(), section, description: "", amount: 0, dueDay: null, paid: false, year, month },
      true,
      async (input) => {
        try {
          await Api.createEntry(input);
          toast("Lancamento adicionado", input.description, "success", 2500);
          this.refresh();
          return null;
        } catch (error) {
          return reportError(error, "Erro ao salvar");
        }
      }
    );
  }

  private edit(entry: Entry): void {
    openEntryForm(toInput(entry), false, (input) => this.save(entry.id, input, true));
  }

  private async save(id: number, input: EntryInput, notify: boolean): Promise<string[] | null> {
    try {
      await Api.updateEntry(id, input);
      if (notify) toast("Lancamento atualizado", input.description, "success", 2500);
      this.refresh();
      return null;
    } catch (error) {
      this.refresh();
      return reportError(error, "Erro ao salvar");
    }
  }

  private async remove(entry: Entry): Promise<void> {
    const section = SECTIONS.find((s) => s.id === entry.section)?.title ?? "";
    const ok = await confirmDialog("Excluir lancamento", `Excluir "${entry.description}" de ${section} (${PROFILE_NAMES[entry.profileId]})? Esta acao nao pode ser desfeita.`, "Excluir");
    if (!ok) return;
    try {
      await Api.deleteEntry(entry.id);
      toast("Lancamento excluido", entry.description, "success", 2500);
      this.refresh();
    } catch (error) {
      reportError(error, "Erro ao excluir");
    }
  }

  private async copyMonth(): Promise<void> {
    const { year, month, view } = store.get();
    const prev = month === 1 ? `Dezembro de ${year - 1}` : `${MONTHS[month - 2]} de ${year}`;
    const ok = await confirmDialog(
      "Copiar mes anterior",
      `Trazer de ${prev} os itens que ainda nao existem em ${MONTHS[month - 1]} (mesmos valores, marcados como nao pagos)?`,
      "Copiar",
      false
    );
    if (!ok) return;
    const targets: ProfileId[] = view === "joint" ? [...PROFILES] : [view];
    try {
      let copied = 0;
      for (const p of targets) {
        copied += (await Api.copyMonth(p, year, month)).copied;
      }
      toast("Copia concluida", copied === 0 ? "Nenhum item novo: este mes ja tem todos os itens do anterior." : `${copied} item(s) copiado(s).`, "success");
      this.refresh();
    } catch (error) {
      reportError(error, "Erro ao copiar");
    }
  }
}
