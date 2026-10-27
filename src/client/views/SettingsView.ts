import { button, clear, h, icon } from "../core/dom.js";
import type { ProfileId, User } from "../models/types.js";

export interface SettingsHandlers {
  feedUrl: string;
  googleCalendar: {
    configured: boolean;
    accounts: Record<ProfileId, { connected: boolean; accountEmail: string | null }>;
  } | null;
  onSyncGoogleCalendar(): void;
  onCopyFeed(): void;
  onRegenerateFeed(): void;
  onImport(file: File): void;
  onChangePassword(current: string, next: string): Promise<string | null>;
  onEnableNotifications(): void;
  notificationState: string;
}

function card(title: string, subtitle: string, ...body: HTMLElement[]): HTMLElement {
  return h("article", { class: "card" }, h("header", { class: "card-head" }, h("div", {}, h("h2", {}, title), h("p", {}, subtitle))), ...body);
}

function steps(items: string[]): HTMLElement {
  return h("ol", { class: "steps" }, items.map((s) => h("li", {}, s)));
}

/** Instrucoes de sincronizacao reaproveitadas no modal do calendario. */
export function syncInstructions(feedUrl: string): HTMLElement {
  const webcal = feedUrl.replace(/^https?:\/\//, "webcal://");
  const isLocal = /localhost|127\.0\.0\.1/.test(feedUrl);
  return h(
    "div",
    { class: "sync" },
    isLocal
      ? h("div", { class: "banner banner-info" }, icon("info"), "Voce esta em localhost. A assinatura pelo iPhone so funciona depois de publicar no Render (endereco publico com HTTPS). O metodo 1 funciona em qualquer caso.")
      : null,
    h("h3", {}, "Metodo 1 - Adicionar um evento ou o mes (.ics)"),
    steps([
      "No iPhone, abra o app pelo Safari.",
      "No calendario, toque no icone de celular ao lado do compromisso, ou em \"Exportar mes (.ics)\".",
      "O Safari mostra a tela do Calendario: toque em \"Adicionar Todos\" e escolha o calendario.",
      "Os alarmes configurados (ex.: 1 dia antes) ja vao junto no arquivo.",
    ]),
    h("p", { class: "muted" }, "Limitacao: e uma copia. Alteracoes posteriores no app nao atualizam o evento ja importado."),
    h("h3", {}, "Metodo 2 - Assinar o calendario (sincronizacao automatica)"),
    steps([
      "Toque no botao \"Assinar no iPhone\" abaixo (abre o link webcal://) ou copie o link.",
      "Se copiou: Ajustes > Apps > Calendario > Contas > Adicionar Conta > Outra > Adicionar Calendario Assinado, e cole o link.",
      "Confirme. O iPhone passa a buscar os eventos e vencimentos periodicamente.",
      "Em Ajustes > Calendario > Contas > Buscar, defina a frequencia (ex.: a cada 15 minutos ou de hora em hora).",
    ]),
    h("p", { class: "muted" }, "Calendarios assinados sao somente leitura no iPhone e o iOS costuma ignorar alarmes de assinaturas. Para alarmes garantidos, use o Metodo 1 nos vencimentos mais importantes."),
    h("div", { class: "feed-box" }, h("code", {}, feedUrl), h("a", { class: "btn btn-primary btn-sm", href: webcal }, icon("phone"), h("span", {}, "Assinar no iPhone")))
  );
}

export function renderSettings(container: HTMLElement, user: User, handlers: SettingsHandlers): void {
  clear(container);

  const fileInput = h("input", { type: "file", accept: "application/json,.json", class: "sr-only", id: "import-file" });
  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (file) handlers.onImport(file);
    fileInput.value = "";
  });

  const current = h("input", { class: "input", type: "password", autocomplete: "current-password", required: true });
  const next = h("input", { class: "input", type: "password", autocomplete: "new-password", required: true, minlength: 4 });
  const msg = h("div", { class: "form-error", hidden: true });
  const pwForm = h(
    "form",
    {
      class: "form",
      onsubmit: (e: Event) => {
        e.preventDefault();
        void handlers.onChangePassword(current.value, next.value).then((err) => {
          msg.hidden = err === null;
          msg.textContent = err ?? "";
          if (err === null) {
            current.value = "";
            next.value = "";
          }
        });
      },
    },
    h("label", { class: "field" }, h("span", { class: "field-label" }, "Senha atual"), current),
    h("label", { class: "field" }, h("span", { class: "field-label" }, "Nova senha"), next),
    msg,
    h("div", { class: "form-actions" }, button("Alterar senha", { variant: "primary", icon: "lock", type: "submit" }))
  );

  container.appendChild(
    h(
      "div",
      { class: "grid-2 grid-top" },
      card(
        "Calendario do iPhone",
        `Link pessoal de ${user.displayName}: seus eventos, os do casal e seus vencimentos`,
        syncInstructions(handlers.feedUrl),
        h(
          "div",
          { class: "btn-row" },
          button("Copiar link", { icon: "copy", variant: "ghost", onClick: handlers.onCopyFeed }),
          button("Gerar novo link", { icon: "refresh", variant: "ghost", onClick: handlers.onRegenerateFeed, title: "Invalida o link antigo (use se ele vazou)" })
        )
      ),
      card(
        "Google Calendar",
        "Sincroniza compromissos do app com cada agenda Google conectada.",
        handlers.googleCalendar
          ? h(
              "div",
              { class: "stack" },
              ...([
                ["ingrid", "Ingrid"],
                ["felipp", "Felipp"],
              ] as const).map(([profile, displayName]) => {
                const account = handlers.googleCalendar?.accounts[profile];
                return h(
                  "div",
                  { class: "stack" },
                  h("p", { class: "muted" }, account?.connected
                    ? `Conectado ${displayName}: ${account.accountEmail ?? "conta Google"}`
                    : `Desconectado ${displayName}: ${profile === "ingrid" ? "ingridregina031@gmail.com" : "felipp.nolasco@gmail.com"}`),
                  handlers.googleCalendar?.configured
                    ? h(
                        "a",
                        { class: "btn btn-primary btn-sm", href: `/api/calendar/google/connect?account=${profile}` },
                        icon("calendar"),
                        h("span", {}, account?.connected ? `Reconectar agenda ${displayName} e atualizar permissões` : `Conectar agenda ${displayName}`)
                      )
                    : null
                );
              }),
              button("Sincronizar compromissos", { icon: "refresh", variant: "ghost", onClick: handlers.onSyncGoogleCalendar })
            )
          : h("p", { class: "muted" }, "Nao foi possivel consultar o estado da integracao."),
        h("p", { class: "muted small" }, "Use o mesmo cliente OAuth. Cada pessoa autoriza sua propria conta. Eventos da Ingrid vao para a agenda dela; eventos do Felipp, para a dele; eventos compartilhados vao para ambas. Vencimentos financeiros nao sao sincronizados.")
      ),
      h(
        "div",
        { class: "stack" },
        card(
          "Backup e exportacao",
          "Os dados ficam no banco SQLite do servidor. Faca backups periodicos.",
          h(
            "div",
            { class: "btn-col" },
            h("a", { class: "btn btn-subtle", href: "/api/backup/json", download: "" }, icon("download"), h("span", {}, "Backup completo (JSON)")),
            h("a", { class: "btn btn-subtle", href: "/api/backup/csv/lancamentos", download: "" }, icon("download"), h("span", {}, "Lancamentos financeiros (CSV / Excel)")),
            h("a", { class: "btn btn-subtle", href: "/api/backup/csv/eventos", download: "" }, icon("download"), h("span", {}, "Compromissos do calendario (CSV / Excel)")),
            fileInput,
            h("label", { class: "btn btn-subtle", for: "import-file" }, icon("upload"), h("span", {}, "Restaurar backup (JSON)"))
          ),
          h("p", { class: "muted small" }, "Restaurar substitui TODOS os lancamentos e eventos atuais pelo conteudo do arquivo.")
        ),
        card(
          "Notificacoes",
          "Alertas na tela para eventos de hoje e amanha",
          h("p", { class: "muted" }, `Status do navegador: ${handlers.notificationState}`),
          h("div", { class: "btn-row" }, button("Ativar notificacoes do navegador", { icon: "bell", variant: "ghost", onClick: handlers.onEnableNotifications }))
        ),
        card("Seguranca da conta", `Usuario: ${user.username}`, pwForm)
      )
    )
  );
}
