import { clear, h, icon } from "../core/dom.js";

export function renderLogin(root: HTMLElement, onSubmit: (username: string, password: string) => Promise<string | null>): void {
  clear(root);
  const error = h("div", { class: "login-error", role: "alert", hidden: true });
  const userInput = h("input", { id: "login-user", name: "username", autocomplete: "username", required: true, placeholder: "ingrid ou felipe", autocapitalize: "none" });
  const passInput = h("input", { id: "login-pass", name: "password", type: "password", autocomplete: "current-password", required: true, placeholder: "Sua senha" });
  const submit = h("button", { class: "btn btn-primary btn-block", type: "submit" }, icon("lock"), h("span", {}, "Entrar"));

  const form = h(
    "form",
    {
      class: "login-form",
      onsubmit: (e: Event) => {
        e.preventDefault();
        submit.disabled = true;
        error.hidden = true;
        void onSubmit(userInput.value, passInput.value).then((message) => {
          submit.disabled = false;
          if (message) {
            error.textContent = message;
            error.hidden = false;
            passInput.select();
          }
        });
      },
    },
    h("label", { for: "login-user" }, "Usuario"),
    h("div", { class: "input-icon" }, icon("user"), userInput),
    h("label", { for: "login-pass" }, "Senha"),
    h("div", { class: "input-icon" }, icon("lock"), passInput),
    error,
    submit
  );

  root.appendChild(
    h(
      "main",
      { class: "login-page" },
      h(
        "section",
        { class: "login-brand" },
        h("div", { class: "brand-mark brand-mark-lg" }, h("img", { src: "/icons/apple-touch-icon.png", alt: "" })),
        h("h1", {}, "Financas Casal"),
        h("p", {}, "Controle financeiro pessoal e calendario de contas de Ingrid e Felipp, em um unico painel."),
        h(
          "ul",
          { class: "login-features" },
          h("li", {}, icon("chart"), "Saldo, distribuicao de gastos e analise do mes"),
          h("li", {}, icon("calendar"), "Calendario de compromissos e vencimentos"),
          h("li", {}, icon("phone"), "Sincronizacao com o Calendario do iPhone (.ics)")
        )
      ),
      h(
        "section",
        { class: "login-card" },
        h("h2", {}, "Acessar painel"),
        h("p", { class: "muted" }, "Entre com seu usuario para continuar."),
        form
      )
    )
  );
  userInput.focus();
}
