import { h, icon } from "../core/dom.js";
import { formatDateShort, formatMoney } from "../core/format.js";
import { openModal } from "../core/modal.js";
import { toast } from "../core/toast.js";
import type { Route } from "../models/types.js";
import { CATEGORY_META, OWNER_NAMES } from "../models/types.js";
import { Api, ApiError, UNAUTHORIZED_EVENT } from "../services/api.js";
import { AvatarCache } from "../services/avatarCache.js";
import { BrowserBackup } from "../services/BrowserBackup.js";
import { Cache } from "../services/cache.js";
import { store } from "../services/store.js";
import { destroyAllCharts } from "../views/charts.js";
import { renderShell, Shell } from "../views/LayoutView.js";
import { renderLogin } from "../views/LoginView.js";
import { CalendarController } from "./CalendarController.js";
import { DashboardController } from "./DashboardController.js";
import { FinanceController } from "./FinanceController.js";
import { NotificationController } from "./NotificationController.js";
import type { PageController } from "./PageController.js";
import { SettingsController } from "./SettingsController.js";

const ROUTES: readonly Route[] = ["dashboard", "finance", "calendar", "settings"];
const HASH: Record<Route, string> = { dashboard: "#/painel", finance: "#/financas", calendar: "#/calendario", settings: "#/integracoes" };

function routeFromHash(): Route {
  const found = ROUTES.find((r) => HASH[r] === window.location.hash);
  return found ?? "dashboard";
}

/** Controller raiz: autenticacao, roteamento por hash e orquestracao das paginas. */
export class AppController {
  private shell: Shell | null = null;
  private readonly notifications = new NotificationController();
  private readonly pages: Record<Route, PageController>;
  private renderSeq = 0;

  constructor(private readonly root: HTMLElement) {
    const navigate = (route: Route): void => this.navigate(route);
    this.pages = {
      dashboard: new DashboardController(navigate),
      finance: new FinanceController(),
      calendar: new CalendarController(navigate, () => void this.notifications.check()),
      settings: new SettingsController(this.notifications),
    };
    this.notifications.onChange((items) => this.shell?.setAlerts(items));
  }

  async start(): Promise<void> {
    window.addEventListener(UNAUTHORIZED_EVENT, () => this.showLogin("Sua sessao expirou. Entre novamente."));
    window.addEventListener("hashchange", () => {
      if (store.get().user) store.set({ route: routeFromHash() });
    });
    store.subscribe((state, changed) => {
      if (!state.user || !this.shell) return;
      this.shell.update(state);
      if (changed.some((k) => k === "route" || k === "month" || k === "year" || k === "view")) {
        void this.renderPage();
      }
    });

    try {
      const { user } = await Api.session();
      if (user) {
        await this.enter(AvatarCache.restore(user));
        return;
      }
    } catch {
      toast("Servidor indisponivel", "Verifique se o servidor esta rodando.", "error", 0);
    }
    this.showLogin();
  }

  private async enter(user: NonNullable<ReturnType<typeof store.get>["user"]>): Promise<void> {
    const backupStatus = await BrowserBackup.initialize();
    if (backupStatus.restored) {
      toast("Dados recuperados", "Os dados deste navegador foram restaurados para o app.", "success");
    }
    if (backupStatus.warning) {
      toast("Copia de seguranca local", backupStatus.warning, "warning", 10000);
    }

    // Atualiza o estado antes de montar o layout para evitar renderizacao duplicada.
    store.set({ user, route: routeFromHash() });
    this.shell = renderShell(this.root, user, {
      onNavigate: (route) => this.navigate(route),
      onMonth: (month) => store.set({ month }),
      onYear: (year) => store.set({ year }),
      onView: (view) => store.set({ view }),
      onLogout: () => void this.logout(),
      onOpenAlerts: () => this.openAlerts(),
    });
    this.shell.update(store.get());
    void this.renderPage();
    this.notifications.start();
  }

  private navigate(route: Route): void {
    if (window.location.hash !== HASH[route]) {
      window.location.hash = HASH[route];
    }
    store.set({ route });
  }

  private async renderPage(): Promise<void> {
    if (!this.shell) return;
    const seq = ++this.renderSeq;
    const { route } = store.get();
    destroyAllCharts();
    const content = this.shell.content;
    content.setAttribute("aria-busy", "true");
    content.classList.add("loading");
    await this.pages[route].render(content);
    if (seq === this.renderSeq) {
      content.classList.remove("loading");
      content.removeAttribute("aria-busy");
      window.scrollTo({ top: 0 });
    }
  }

  private showLogin(message?: string): void {
    this.notifications.stop();
    this.shell = null;
    store.set({ user: null });
    renderLogin(this.root, async (username, password) => {
      try {
        const { user } = await Api.login(username, password);
        await this.enter(AvatarCache.restore(user));
        toast(`Bem-vindo(a), ${user.displayName}`, "Dados carregados do banco local.", "success", 3000);
        return null;
      } catch (error) {
        return error instanceof ApiError ? error.message : "Falha ao entrar.";
      }
    });
    if (message) toast("Sessao encerrada", message, "warning");
  }

  private async logout(): Promise<void> {
    try {
      await Api.logout();
    } finally {
      Cache.clearAll();
      window.location.hash = "";
      this.showLogin();
    }
  }

  private openAlerts(): void {
    const items = this.notifications.items();
    const body =
      items.length === 0
        ? h("div", { class: "empty" }, icon("bell"), h("p", {}, "Nenhum compromisso ou vencimento em aberto para hoje e amanha."))
        : h(
            "ul",
            { class: "agenda" },
            items.map((i) => {
              const bar = h("span", { class: "agenda-bar" });
              bar.style.background = CATEGORY_META[i.category].color;
              return h(
                "li",
                {},
                bar,
                h("div", { class: "agenda-date" }, formatDateShort(i.date), h("small", {}, i.time ?? "dia")),
                h("div", { class: "agenda-main" }, h("strong", {}, i.title), h("small", {}, `${CATEGORY_META[i.category].label} - ${OWNER_NAMES[i.owner]}`)),
                i.amount !== null ? h("span", { class: "agenda-amount" }, formatMoney(i.amount)) : null
              );
            })
          );
    const goTo = h("button", { class: "btn btn-primary", type: "button", onclick: () => { handle.close(); this.navigate("calendar"); } }, icon("calendar"), h("span", {}, "Abrir calendario"));
    const handle = openModal("Alertas de hoje e amanha", body, { footer: [goTo] });
  }
}
