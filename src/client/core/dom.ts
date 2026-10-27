/** Helpers de DOM tipados (sem framework). */

export type Child = Node | string | number | null | undefined | false;
export type Handler = (event: Event) => void;
export type AttrValue = string | number | boolean | Handler | null | undefined;
export type Attrs = Record<string, AttrValue>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Array<Child | Child[]>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (typeof value === "function") {
      el.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "class") {
      el.className = String(value);
    } else if (key === "value" && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) {
      el.value = String(value);
    } else if (key === "checked" && el instanceof HTMLInputElement) {
      el.checked = value === true;
    } else if (value === true) {
      el.setAttribute(key, "");
    } else {
      el.setAttribute(key, String(value));
    }
  }
  append(el, children);
  return el;
}

export function append(parent: Node, children: Array<Child | Child[]>): void {
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(typeof child === "string" || typeof child === "number" ? document.createTextNode(String(child)) : child);
  }
}

export function clear(el: Element): void {
  while (el.firstChild) el.removeChild(el.firstChild);
}

/** Icone PNG da pasta /icons, colorido via CSS mask (herda a cor do texto). */
export function icon(name: string, extraClass = ""): HTMLSpanElement {
  const span = h("span", { class: `ico ${extraClass}`.trim(), "aria-hidden": "true" });
  span.style.setProperty("--icon", `url("/icons/${name}.png")`);
  return span;
}

export function button(
  label: string,
  options: { icon?: string; variant?: "primary" | "ghost" | "danger" | "subtle"; onClick?: Handler; title?: string; small?: boolean; type?: "button" | "submit" } = {}
): HTMLButtonElement {
  const cls = ["btn", `btn-${options.variant ?? "subtle"}`, options.small ? "btn-sm" : "", label === "" ? "btn-icon" : ""].filter(Boolean).join(" ");
  return h(
    "button",
    { class: cls, type: options.type ?? "button", title: options.title ?? (label || null), "aria-label": options.title ?? (label || null), onclick: options.onClick },
    options.icon ? icon(options.icon) : null,
    label ? h("span", {}, label) : null
  );
}

export function byId<T extends HTMLElement>(id: string, ctor: new () => T): T {
  const el = document.getElementById(id);
  if (!(el instanceof ctor)) {
    throw new Error(`Elemento #${id} nao encontrado.`);
  }
  return el;
}
