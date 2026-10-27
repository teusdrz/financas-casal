import { button, h, icon } from "./dom.js";

export interface ModalHandle {
  close(): void;
  body: HTMLElement;
}

/** Abre um modal acessivel. Fecha com ESC, clique fora ou no botao fechar. */
export function openModal(title: string, content: HTMLElement, options: { wide?: boolean; footer?: HTMLElement[] } = {}): ModalHandle {
  const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") close();
  };
  const close = (): void => {
    document.removeEventListener("keydown", onKey);
    overlay.classList.add("modal-leave");
    window.setTimeout(() => overlay.remove(), 180);
    previous?.focus();
  };
  const body = h("div", { class: "modal-body" }, content);
  const dialog = h(
    "div",
    { class: `modal ${options.wide ? "modal-wide" : ""}`, role: "dialog", "aria-modal": "true", "aria-label": title },
    h(
      "header",
      { class: "modal-header" },
      h("h3", {}, title),
      h("button", { class: "btn btn-ghost btn-icon", type: "button", "aria-label": "Fechar", onclick: close }, icon("close"))
    ),
    body,
    options.footer && options.footer.length > 0 ? h("footer", { class: "modal-footer" }, options.footer) : null
  );
  const overlay = h("div", {
    class: "modal-overlay",
    onmousedown: (e: Event) => {
      if (e.target === overlay) close();
    },
  });
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  document.addEventListener("keydown", onKey);
  const firstInput = dialog.querySelector<HTMLElement>("input, select, textarea");
  (firstInput ?? dialog.querySelector<HTMLElement>("button"))?.focus();
  return { close, body };
}

/** Dialogo de confirmacao que resolve true/false. */
export function confirmDialog(title: string, message: string, confirmLabel = "Confirmar", danger = true): Promise<boolean> {
  return new Promise((resolve) => {
    let decided = false;
    const finish = (value: boolean): void => {
      if (decided) return;
      decided = true;
      handle.close();
      resolve(value);
    };
    const ok = button(confirmLabel, { variant: danger ? "danger" : "primary", onClick: () => finish(true) });
    const cancel = button("Cancelar", { variant: "ghost", onClick: () => finish(false) });
    const handle = openModal(title, h("p", { class: "confirm-text" }, message), { footer: [cancel, ok] });
    const observer = new MutationObserver(() => {
      if (!document.body.contains(ok)) {
        observer.disconnect();
        finish(false);
      }
    });
    observer.observe(document.body, { childList: true });
    ok.focus();
  });
}
