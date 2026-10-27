import { h, icon } from "./dom.js";

export type ToastKind = "info" | "success" | "warning" | "error";

const ICONS: Record<ToastKind, string> = { info: "info", success: "check", warning: "bell", error: "alert" };

function container(): HTMLElement {
  let el = document.getElementById("toast-stack");
  if (!el) {
    el = h("div", { id: "toast-stack", class: "toast-stack", role: "status", "aria-live": "polite" });
    document.body.appendChild(el);
  }
  return el;
}

/** Exibe um banner/toast temporario no canto da tela. */
export function toast(title: string, message = "", kind: ToastKind = "info", timeoutMs = 5000): void {
  const close = (): void => {
    el.classList.add("toast-leave");
    window.setTimeout(() => el.remove(), 250);
  };
  const el = h(
    "div",
    { class: `toast toast-${kind}` },
    h("div", { class: "toast-icon" }, icon(ICONS[kind])),
    h("div", { class: "toast-body" }, h("strong", {}, title), message ? h("p", {}, message) : null),
    h("button", { class: "toast-close", type: "button", "aria-label": "Fechar", onclick: close }, icon("close"))
  );
  container().appendChild(el);
  if (timeoutMs > 0) {
    window.setTimeout(close, timeoutMs);
  }
}
