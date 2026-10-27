import { addDaysIso, todayIso } from "../core/format.js";
import type { Route } from "../models/types.js";
import { buildInsights } from "../services/insights.js";
import { filterByView, Repository } from "../services/repository.js";
import { store } from "../services/store.js";
import { renderDashboard } from "../views/DashboardView.js";
import type { PageController } from "./PageController.js";
import { reportError } from "./helpers.js";

export class DashboardController implements PageController {
  constructor(private readonly navigate: (route: Route) => void) {}

  async render(content: HTMLElement): Promise<void> {
    const { year, month, view } = store.get();
    try {
      const today = todayIso();
      const [bundle, upcoming] = await Promise.all([Repository.month(year, month), Repository.events(today, addDaysIso(today, 7), view)]);
      const summary = view === "joint" ? bundle.summary.joint : bundle.summary.profiles.find((p) => p.profileId === view) ?? bundle.summary.joint;
      const entries = filterByView(bundle.entries, view);
      renderDashboard(
        content,
        {
          view,
          year,
          month,
          summary: bundle.summary,
          yearSummary: bundle.yearSummary,
          entries,
          upcoming: upcoming.items,
          insights: buildInsights(summary, entries, upcoming.items),
          offline: bundle.offline || upcoming.offline,
        },
        (route) => this.navigate(route)
      );
    } catch (error) {
      reportError(error, "Nao foi possivel carregar o painel");
    }
  }
}
