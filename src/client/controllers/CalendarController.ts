import { h } from "../core/dom.js";
import { daysInMonth, isoDate, todayIso } from "../core/format.js";
import { confirmDialog, openModal } from "../core/modal.js";
import { toast } from "../core/toast.js";
import type { CalendarItem, EventOwner, Route } from "../models/types.js";
import { Api } from "../services/api.js";
import { Repository } from "../services/repository.js";
import { store } from "../services/store.js";
import { renderCalendar } from "../views/CalendarView.js";
import { emptyEvent, eventToInput, openEventForm } from "../views/forms.js";
import { syncInstructions } from "../views/SettingsView.js";
import type { PageController } from "./PageController.js";
import { captureBrowserBackup, openIcs, reportError } from "./helpers.js";

export class CalendarController implements PageController {
  private content: HTMLElement | null = null;
  private selected = todayIso();

  constructor(private readonly navigate: (route: Route) => void, private readonly onChanged: () => void) {}

  async render(content: HTMLElement): Promise<void> {
    this.content = content;
    const { year, month, view } = store.get();
    const from = isoDate(year, month, 1);
    const to = isoDate(year, month, daysInMonth(year, month));
    if (this.selected < from || this.selected > to) {
      this.selected = todayIso() >= from && todayIso() <= to ? todayIso() : from;
    }
    try {
      const { items, offline } = await Repository.events(from, to, view);
      renderCalendar(
        content,
        { year, month, selected: this.selected, items, offline },
        {
          onSelectDay: (date) => {
            this.selected = date;
            this.refresh();
          },
          onAdd: (date) => this.add(date),
          onEdit: (item) => this.edit(item),
          onDelete: (item) => void this.remove(item),
          onToggleDone: (item) => void this.toggleDone(item),
          onExportItem: (item) => openIcs(item.source === "entry" && item.entryId !== null ? Api.urls.entryIcs(item.entryId) : Api.urls.eventIcs(item.id)),
          onExportMonth: () => openIcs(Api.urls.rangeIcs(from, to, view)),
          onOpenSync: () => this.openSync(),
        }
      );
    } catch (error) {
      reportError(error, "Nao foi possivel carregar o calendario");
    }
  }

  private refresh(): void {
    if (this.content) void this.render(this.content);
  }

  private changed(): void {
    this.refresh();
    this.onChanged();
  }

  private defaultOwner(): EventOwner {
    const { view } = store.get();
    return view === "joint" ? "shared" : view;
  }

  private add(date: string): void {
    this.selected = date;
    openEventForm(emptyEvent(date, this.defaultOwner()), true, async (input) => {
      try {
        await Api.createEvent(input);
        await captureBrowserBackup();
        toast("Compromisso criado", input.title, "success", 2500);
        this.selected = input.date;
        this.changed();
        return null;
      } catch (error) {
        return reportError(error, "Erro ao salvar");
      }
    });
  }

  private edit(item: CalendarItem): void {
    if (item.source === "google") {
      toast("Evento da agenda Google", "Este evento e somente leitura no app. Edite-o no Google Calendar.", "info");
      return;
    }
    if (item.source === "entry") {
      toast("Vencimento vinculado as financas", "Edite valor, dia ou status na tela Financas.", "info");
      this.navigate("finance");
      return;
    }
    openEventForm(eventToInput(item), false, async (input) => {
      try {
        await Api.updateEvent(item.id, input);
        await captureBrowserBackup();
        toast("Compromisso atualizado", input.title, "success", 2500);
        this.selected = input.date;
        this.changed();
        return null;
      } catch (error) {
        return reportError(error, "Erro ao salvar");
      }
    });
  }

  private async remove(item: CalendarItem): Promise<void> {
    if (item.source === "google") {
      toast("Evento da agenda Google", "Este evento e somente leitura no app. Exclua-o no Google Calendar.", "info");
      return;
    }
    const ok = await confirmDialog("Excluir compromisso", `Excluir "${item.title}"? Se ja foi adicionado ao iPhone via .ics, remova-o tambem por la.`, "Excluir");
    if (!ok) return;
    try {
      await Api.deleteEvent(item.id);
      await captureBrowserBackup();
      toast("Compromisso excluido", item.title, "success", 2500);
      this.changed();
    } catch (error) {
      reportError(error, "Erro ao excluir");
    }
  }

  private async toggleDone(item: CalendarItem): Promise<void> {
    if (item.source === "google") {
      toast("Evento da agenda Google", "Este evento e somente leitura no app. Altere-o no Google Calendar.", "info");
      return;
    }
    try {
      if (item.source === "entry" && item.entryId !== null) {
        const { year, month } = store.get();
        const { entries } = await Api.entries(year, month);
        const entry = entries.find((e) => e.id === item.entryId);
        if (!entry) return;
        await Api.updateEntry(entry.id, { ...entry, paid: !entry.paid });
        await captureBrowserBackup();
      } else {
        await Api.updateEvent(item.id, { ...eventToInput(item), done: !item.done });
        await captureBrowserBackup();
      }
      toast(item.done ? "Marcado como pendente" : "Marcado como concluido", item.title, "success", 2000);
      this.changed();
    } catch (error) {
      reportError(error, "Erro ao atualizar");
    }
  }

  private openSync(): void {
    const user = store.get().user;
    if (!user) return;
    openModal("Sincronizar com o Calendario do iPhone", h("div", {}, syncInstructions(Api.urls.feed(user.feedToken))), { wide: true });
  }
}
