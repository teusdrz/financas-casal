import { clear, h, icon } from "../core/dom.js";
import { MONTHS } from "../core/format.js";
import type { CalendarItem, Route, User, ViewProfile } from "../models/types.js";
import { OWNER_NAMES } from "../models/types.js";
import type { AppState } from "../services/store.js";

export interface ShellHandlers {
  onNavigate(route: Route): void;
  onMonth(month: number): void;
  onYear(year: number): void;
  onView(view: ViewProfile): void;
  onLogout(): void;
  onOpenAlerts(): void;
}

export interface Shell {
  content: HTMLElement;
  update(state: Readonly<AppState>): void;
  setAlerts(items: CalendarItem[]): void;
}

const NAV: Array<{ route: Route; label: string; icon: string }> = [
  { route: "dashboard", label: "Painel", icon: "dashboard" },
  { route: "finance", label: "Financas", icon: "wallet" },
  { route: "calendar", label: "Calendario", icon: "calendar" },
  { route: "settings", label: "Integracoes e backup", icon: "settings" },
];

const TITLES: Record<Route, string> = {
  dashboard: "Painel financeiro",
  finance: "Lancamentos do mes",
  calendar: "Calendario de compromissos",
  settings: "Integracoes, backup e conta",
};

const YEARS = [2026, 2027];

export function renderShell(root: HTMLElement, user: User, handlers: ShellHandlers): Shell {
  clear(root);

  const navButtons = NAV.map((n) =>
    h("button", { class: "nav-item", type: "button", "data-route": n.route, onclick: () => { handlers.onNavigate(n.route); closeMenu(); } }, icon(n.icon), h("span", {}, n.label))
  );
  const bottomButtons = NAV.map((n) =>
    h("button", { class: "tab-item", type: "button", "data-route": n.route, onclick: () => handlers.onNavigate(n.route) }, icon(n.icon), h("span", {}, n.label.split(" ")[0]))
  );

  const sidebar = h(
    "aside",
    { class: "sidebar" },
    h("div", { class: "brand" }, h("div", { class: "brand-mark" }, h("img", { src: "/icons/favicon.png", alt: "" })), h("div", {}, h("strong", {}, "Financas Casal"), h("small", {}, "Ingrid e Felipp"))),
    h("nav", { class: "nav" }, navButtons),
    h(
      "div",
      { class: "sidebar-footer" },
      h(
        "div",
        { class: "user-chip" },
        h("div", { class: "avatar" }, h("span", { class: "avatar-initial" }, user.displayName.charAt(0)), h("img", { class: "avatar-image", ...(user.avatarDataUrl ? { src: user.avatarDataUrl } : {}), alt: `Foto de ${user.displayName}`, hidden: !user.avatarDataUrl })),
        h("div", {}, h("strong", {}, user.displayName), h("small", {}, `@${user.username}`))
      ),
      h("button", { class: "nav-item", type: "button", onclick: handlers.onLogout }, icon("logout"), h("span", {}, "Sair"))
    )
  );

  const title = h("h1", { class: "page-title" }, "");
  const monthSelect = h("select", { class: "select", "aria-label": "Mes", onchange: () => handlers.onMonth(Number(monthSelect.value)) }, MONTHS.map((m, i) => h("option", { value: i + 1 }, m)));
  const yearSelect = h("select", { class: "select select-year", "aria-label": "Ano", onchange: () => handlers.onYear(Number(yearSelect.value)) }, YEARS.map((y) => h("option", { value: y }, y)));
  const prev = h("button", { class: "btn btn-ghost btn-icon", type: "button", "aria-label": "Mes anterior", onclick: () => step(-1) }, icon("chevron-left"));
  const next = h("button", { class: "btn btn-ghost btn-icon", type: "button", "aria-label": "Proximo mes", onclick: () => step(1) }, icon("chevron-right"));

  let current: Readonly<AppState> | null = null;
  function step(delta: number): void {
    if (!current) return;
    let m = current.month + delta;
    let y = current.year;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    if (!YEARS.includes(y)) return;
    if (y !== current.year) handlers.onYear(y);
    handlers.onMonth(m);
  }

  const viewOptions: Array<{ id: ViewProfile; label: string }> = [
    { id: "ingrid", label: "Ingrid" },
    { id: "felipp", label: "Felipp" },
    { id: "joint", label: "Conjunto" },
  ];
  const viewButtons = viewOptions.map((v) =>
    h("button", { class: "seg-item", type: "button", "data-view": v.id, onclick: () => handlers.onView(v.id) }, v.label)
  );

  const alertCount = h("span", { class: "badge-count", hidden: true }, "0");
  const bell = h("button", { class: "btn btn-ghost btn-icon bell", type: "button", "aria-label": "Alertas", onclick: handlers.onOpenAlerts }, icon("bell"), alertCount);
  const menuBtn = h("button", { class: "btn btn-ghost btn-icon menu-toggle", type: "button", "aria-label": "Menu", onclick: () => root.classList.toggle("menu-open") }, icon("menu"));
  function closeMenu(): void {
    root.classList.remove("menu-open");
  }

  const topbar = h(
    "header",
    { class: "topbar" },
    h("div", { class: "topbar-left" }, menuBtn, title),
    h(
      "div",
      { class: "topbar-controls" },
      h("div", { class: "period" }, prev, monthSelect, yearSelect, next),
      h("div", { class: "segmented", role: "group", "aria-label": "Perfil" }, viewButtons),
      bell
    )
  );

  const content = h("section", { class: "content", id: "content" });
  const scrim = h("div", { class: "scrim", onclick: closeMenu });
  root.appendChild(h("div", { class: "app" }, sidebar, scrim, h("div", { class: "main" }, topbar, content), h("nav", { class: "tabbar" }, bottomButtons)));

  return {
    content,
    update(state) {
      current = state;
      const avatar = sidebar.querySelector<HTMLImageElement>(".avatar-image");
      const initial = sidebar.querySelector<HTMLElement>(".avatar-initial");
      if (avatar && initial) {
        avatar.hidden = !state.user?.avatarDataUrl;
        if (state.user?.avatarDataUrl) avatar.src = state.user.avatarDataUrl;
        else avatar.removeAttribute("src");
        initial.hidden = Boolean(state.user?.avatarDataUrl);
        initial.textContent = state.user?.displayName.charAt(0) ?? "";
      }
      title.textContent = TITLES[state.route];
      monthSelect.value = String(state.month);
      yearSelect.value = String(state.year);
      [...navButtons, ...bottomButtons].forEach((b) => b.classList.toggle("active", b.dataset.route === state.route));
      viewButtons.forEach((b) => b.classList.toggle("active", b.dataset.view === state.view));
    },
    setAlerts(items) {
      alertCount.textContent = String(items.length);
      alertCount.hidden = items.length === 0;
      bell.title = items.length > 0 ? items.map((i) => `${i.title} (${OWNER_NAMES[i.owner]})`).join("\n") : "Sem alertas";
    },
  };
}
