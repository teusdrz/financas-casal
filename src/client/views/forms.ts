import { button, h } from "../core/dom.js";
import { moneyInputValue, parseMoney } from "../core/format.js";
import { openModal } from "../core/modal.js";
import type { CalendarItem, EntryInput, EntrySection, EventCategory, EventInput, EventOwner, ProfileId } from "../models/types.js";
import { ALARM_OPTIONS, CATEGORY_META, OWNER_NAMES, PROFILE_NAMES, PROFILES, SECTIONS } from "../models/types.js";

function field(label: string, control: HTMLElement, hint = ""): HTMLElement {
  return h("label", { class: "field" }, h("span", { class: "field-label" }, label), control, hint ? h("small", { class: "field-hint" }, hint) : null);
}

function errorBox(): HTMLElement {
  return h("div", { class: "form-error", role: "alert", hidden: true });
}

function showErrors(box: HTMLElement, messages: string[]): void {
  box.textContent = messages.join(" ");
  box.hidden = messages.length === 0;
}

/** Modal de criacao/edicao de lancamento financeiro. */
export function openEntryForm(initial: EntryInput, isNew: boolean, onSave: (input: EntryInput) => Promise<string[] | null>): void {
  const profile = h("select", { class: "select" }, PROFILES.map((p) => h("option", { value: p }, PROFILE_NAMES[p])));
  profile.value = initial.profileId;
  const section = h("select", { class: "select" }, SECTIONS.map((s) => h("option", { value: s.id }, s.title)));
  section.value = initial.section;
  const description = h("input", { class: "input", value: initial.description, maxlength: 120, required: true, placeholder: "Ex.: Aluguel" });
  const amount = h("input", { class: "input", value: moneyInputValue(initial.amount), inputmode: "decimal", placeholder: "0,00" });
  const dueDay = h("input", { class: "input", type: "number", min: 1, max: 31, value: initial.dueDay ?? "", placeholder: "Ex.: 10" });
  const paid = h("input", { type: "checkbox", checked: initial.paid });
  const errors = errorBox();
  const dueWrap = h("div", { class: "form-row" }, field("Dia de vencimento", dueDay, "Gera alerta no calendario"), h("label", { class: "check" }, paid, h("span", {}, "Ja foi pago")));

  const syncDue = (): void => {
    const meta = SECTIONS.find((s) => s.id === section.value);
    dueWrap.hidden = !(meta?.hasDueDate ?? false);
  };
  section.addEventListener("change", syncDue);
  syncDue();

  const save = button(isNew ? "Adicionar" : "Salvar alteracoes", { variant: "primary", icon: "check", type: "submit" });
  const form = h(
    "form",
    {
      class: "form",
      onsubmit: (e: Event) => {
        e.preventDefault();
        const value = parseMoney(amount.value);
        if (value === null) {
          showErrors(errors, ["Valor invalido. Use o formato 1.234,56."]);
          return;
        }
        const meta = SECTIONS.find((s) => s.id === section.value);
        const input: EntryInput = {
          profileId: profile.value as ProfileId,
          section: section.value as EntrySection,
          description: description.value.trim(),
          amount: value,
          dueDay: meta?.hasDueDate && dueDay.value !== "" ? Number(dueDay.value) : null,
          paid: meta?.hasDueDate ? paid.checked : false,
          year: initial.year,
          month: initial.month,
        };
        save.disabled = true;
        void onSave(input).then((errs) => {
          save.disabled = false;
          if (errs) showErrors(errors, errs);
          else handle.close();
        });
      },
    },
    h("div", { class: "form-row" }, field("Perfil", profile), field("Secao", section)),
    field("Descricao", description),
    field("Valor (R$)", amount),
    dueWrap,
    errors,
    h("div", { class: "form-actions" }, save)
  );
  const handle = openModal(isNew ? "Novo lancamento" : "Editar lancamento", form);
}

/** Modal de criacao/edicao de evento do calendario. */
export function openEventForm(initial: EventInput, isNew: boolean, onSave: (input: EventInput) => Promise<string[] | null>): void {
  const title = h("input", { class: "input", value: initial.title, maxlength: 120, required: true, placeholder: "Ex.: Vencimento do aluguel" });
  const date = h("input", { class: "input", type: "date", value: initial.date, required: true });
  const time = h("input", { class: "input", type: "time", value: initial.time ?? "" });
  const category = h("select", { class: "select" }, (Object.keys(CATEGORY_META) as EventCategory[]).map((c) => h("option", { value: c }, CATEGORY_META[c].label)));
  category.value = initial.category;
  const owner = h("select", { class: "select" }, (Object.keys(OWNER_NAMES) as EventOwner[]).map((o) => h("option", { value: o }, OWNER_NAMES[o])));
  owner.value = initial.owner;
  const amount = h("input", { class: "input", value: initial.amount === null ? "" : moneyInputValue(initial.amount), inputmode: "decimal", placeholder: "Opcional" });
  const alarm = h("select", { class: "select" }, ALARM_OPTIONS.map((a) => h("option", { value: a.value }, a.label)));
  alarm.value = String(initial.alarmMinutes);
  const notes = h("textarea", { class: "input", rows: 3, maxlength: 1000, placeholder: "Observacoes" });
  notes.value = initial.notes;
  const done = h("input", { type: "checkbox", checked: initial.done });
  const errors = errorBox();
  const save = button(isNew ? "Adicionar ao calendario" : "Salvar alteracoes", { variant: "primary", icon: "check", type: "submit" });

  const form = h(
    "form",
    {
      class: "form",
      onsubmit: (e: Event) => {
        e.preventDefault();
        const value = amount.value.trim() === "" ? null : parseMoney(amount.value);
        if (amount.value.trim() !== "" && value === null) {
          showErrors(errors, ["Valor invalido."]);
          return;
        }
        const input: EventInput = {
          title: title.value.trim(),
          date: date.value,
          time: time.value === "" ? null : time.value,
          category: category.value as EventCategory,
          owner: owner.value as EventOwner,
          amount: value,
          alarmMinutes: Number(alarm.value),
          notes: notes.value.trim(),
          done: done.checked,
        };
        save.disabled = true;
        void onSave(input).then((errs) => {
          save.disabled = false;
          if (errs) showErrors(errors, errs);
          else handle.close();
        });
      },
    },
    field("Titulo", title),
    h("div", { class: "form-row" }, field("Data", date), field("Horario", time, "Vazio = dia inteiro")),
    h("div", { class: "form-row" }, field("Categoria", category), field("Responsavel", owner)),
    h("div", { class: "form-row" }, field("Valor (R$)", amount), field("Alarme no iPhone", alarm)),
    field("Observacoes", notes),
    h("label", { class: "check" }, done, h("span", {}, "Concluido / pago")),
    errors,
    h("div", { class: "form-actions" }, save)
  );
  const handle = openModal(isNew ? "Novo compromisso" : "Editar compromisso", form);
}

export function emptyEvent(date: string, owner: EventOwner): EventInput {
  return { title: "", date, time: null, category: "bill", owner, amount: null, notes: "", alarmMinutes: 1440, done: false };
}

export function eventToInput(item: CalendarItem): EventInput {
  return {
    title: item.title,
    date: item.date,
    time: item.time,
    category: item.category,
    owner: item.owner,
    amount: item.amount,
    notes: item.notes,
    alarmMinutes: item.alarmMinutes,
    done: item.done,
  };
}
