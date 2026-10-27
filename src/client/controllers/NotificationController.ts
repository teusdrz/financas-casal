import { addDaysIso, formatMoney, todayIso } from "../core/format.js";
import { toast } from "../core/toast.js";
import type { CalendarItem } from "../models/types.js";
import { OWNER_NAMES } from "../models/types.js";
import { Repository } from "../services/repository.js";
import { store } from "../services/store.js";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Alertas inteligentes: verifica eventos de hoje e de amanha, mostra banners (toasts)
 * uma vez por sessao para cada item e, se autorizado, notificacoes do navegador.
 */
export class NotificationController {
  private timer: number | null = null;
  private shown = new Set<string>();
  private listeners: Array<(items: CalendarItem[]) => void> = [];
  private current: CalendarItem[] = [];

  constructor() {
    try {
      const raw = window.sessionStorage.getItem("fc:alerts-shown");
      if (raw) (JSON.parse(raw) as string[]).forEach((k) => this.shown.add(k));
    } catch {
      // sessionStorage indisponivel
    }
  }

  start(): void {
    this.stop();
    void this.check();
    this.timer = window.setInterval(() => void this.check(), CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
  }

  onChange(listener: (items: CalendarItem[]) => void): void {
    this.listeners.push(listener);
  }

  items(): CalendarItem[] {
    return this.current;
  }

  async check(): Promise<void> {
    if (!store.get().user) return;
    const today = todayIso();
    const tomorrow = addDaysIso(today, 1);
    try {
      const { items } = await Repository.events(today, tomorrow, "joint");
      this.current = items.filter((i) => !i.done);
      this.listeners.forEach((l) => l(this.current));
      const fresh = this.current.filter((item) => !this.shown.has(`${item.source}-${item.id}-${item.date}`));
      fresh.forEach((item) => this.shown.add(`${item.source}-${item.id}-${item.date}`));
      // Evita "enxurrada" de banners: acima de 3 alertas novos, mostra um resumo unico.
      if (fresh.length > 3) {
        const todayCount = fresh.filter((i) => i.date === today).length;
        const total = fresh.filter((i) => i.amount !== null).reduce((s, i) => s + (i.amount ?? 0), 0);
        const text = `${todayCount} para hoje e ${fresh.length - todayCount} para amanha${total > 0 ? ` - ${formatMoney(total)} em contas` : ""}. Toque no sino para ver a lista.`;
        toast(`${fresh.length} alertas de compromissos e vencimentos`, text, todayCount > 0 ? "warning" : "info", 10000);
        this.browserNotify(`${fresh.length} alertas no Financas Casal`, text);
      }
      for (const item of fresh.length > 3 ? [] : fresh) {
        const when = item.date === today ? "Hoje" : "Amanha";
        const detail = [when + (item.time ? ` as ${item.time}` : ""), OWNER_NAMES[item.owner], item.amount !== null ? formatMoney(item.amount) : ""].filter(Boolean).join(" - ");
        const isBill = item.category === "bill" || item.category === "card";
        toast(isBill ? `Vencimento: ${item.title.replace(/^Vencimento: /, "")}` : item.title, detail, item.date === today ? "warning" : "info", 9000);
        this.browserNotify(item.title, detail);
      }
      try {
        window.sessionStorage.setItem("fc:alerts-shown", JSON.stringify([...this.shown]));
      } catch {
        // ignorado
      }
    } catch {
      // Falha silenciosa: os alertas tentam novamente no proximo ciclo.
    }
  }

  permissionLabel(): string {
    if (!("Notification" in window)) return "nao suportado neste navegador (no iPhone, adicione o app a Tela de Inicio)";
    const map: Record<NotificationPermission, string> = { granted: "permitidas", denied: "bloqueadas (libere nas configuracoes do navegador)", default: "ainda nao solicitadas" };
    return map[Notification.permission];
  }

  async requestPermission(): Promise<void> {
    if (!("Notification" in window)) {
      toast("Nao suportado", "Este navegador nao oferece notificacoes. Os alertas continuam aparecendo na tela.", "info");
      return;
    }
    const result = await Notification.requestPermission();
    toast(result === "granted" ? "Notificacoes ativadas" : "Notificacoes nao permitidas", "", result === "granted" ? "success" : "warning");
  }

  private browserNotify(title: string, body: string): void {
    if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
      try {
        new Notification(title, { body, icon: "/icons/apple-touch-icon.png" });
      } catch {
        // Alguns navegadores moveis exigem service worker; o toast ja foi exibido.
      }
    }
  }
}
