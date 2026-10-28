import { confirmDialog } from "../core/modal.js";
import { toast } from "../core/toast.js";
import { Api, ApiError } from "../services/api.js";
import { store } from "../services/store.js";
import { renderSettings } from "../views/SettingsView.js";
import type { NotificationController } from "./NotificationController.js";
import type { PageController } from "./PageController.js";
import { reportError } from "./helpers.js";

export class SettingsController implements PageController {
  private content: HTMLElement | null = null;

  constructor(private readonly notifications: NotificationController) {}

  async render(content: HTMLElement): Promise<void> {
    this.content = content;
    const user = store.get().user;
    if (!user) return;
    const feedUrl = Api.urls.feed(user.feedToken);
    let googleCalendar: {
      configured: boolean;
      accounts: Record<"ingrid" | "felipp", { connected: boolean; accountEmail: string | null }>;
    } | null = null;
    try {
      googleCalendar = await Api.googleCalendarStatus();
    } catch (error) {
      googleCalendar = null;
      reportError(error, "Nao foi possivel consultar o Google Calendar");
    }
    renderSettings(content, user, {
      feedUrl,
      googleCalendar,
      onSyncGoogleCalendar: () => void this.syncGoogleCalendar(),
      onProfilePhoto: (file) => void this.profilePhoto(file),
      onRemoveProfilePhoto: () => void this.removeProfilePhoto(),
      notificationState: this.notifications.permissionLabel(),
      onCopyFeed: () => void this.copy(feedUrl),
      onRegenerateFeed: () => void this.regenerate(),
      onImport: (file) => void this.importFile(file),
      onChangePassword: (current, next) => this.changePassword(current, next),
      onEnableNotifications: () => void this.notifications.requestPermission().then(() => this.refresh()),
    });
  }

  private refresh(): void {
    if (this.content) void this.render(this.content);
  }

  private async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      toast("Link copiado", "Cole no iPhone em Adicionar Calendario Assinado.", "success");
    } catch {
      window.prompt("Copie o link do calendario:", text);
    }
  }

  private async regenerate(): Promise<void> {
    const ok = await confirmDialog("Gerar novo link", "O link atual deixara de funcionar e o iPhone precisara assinar o novo link. Continuar?", "Gerar novo link");
    if (!ok) return;
    try {
      const { feedToken } = await Api.regenerateFeed();
      const user = store.get().user;
      if (user) store.set({ user: { ...user, feedToken } });
      toast("Novo link gerado", "Atualize a assinatura no iPhone.", "success");
      this.refresh();
    } catch (error) {
      reportError(error, "Erro ao gerar link");
    }
  }

  private async syncGoogleCalendar(): Promise<void> {
    try {
      await Api.syncGoogleCalendar();
      toast("Google Calendar sincronizado", "Os compromissos do app foram enviados para a agenda conectada.", "success");
      this.refresh();
    } catch (error) {
      reportError(error, "Falha ao sincronizar compromissos");
    }
  }

  private async profilePhoto(file: File): Promise<void> {
    if (!file.type.startsWith("image/")) {
      toast("Arquivo invalido", "Escolha uma imagem.", "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast("Imagem muito grande", "Escolha uma imagem de ate 10 MB.", "error");
      return;
    }

    try {
      const imageUrl = URL.createObjectURL(file);
      const image = new Image();
      image.src = imageUrl;
      try {
        await image.decode();
      } finally {
        URL.revokeObjectURL(imageUrl);
      }

      const size = Math.min(image.naturalWidth, image.naturalHeight);
      if (size === 0) throw new Error("A imagem selecionada nao pode ser aberta.");
      const sourceX = (image.naturalWidth - size) / 2;
      const sourceY = (image.naturalHeight - size) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Nao foi possivel processar a imagem neste navegador.");
      context.drawImage(image, sourceX, sourceY, size, size, 0, 0, canvas.width, canvas.height);

      let avatarDataUrl = "";
      for (const quality of [0.82, 0.68, 0.52]) {
        avatarDataUrl = canvas.toDataURL("image/jpeg", quality);
        const base64 = avatarDataUrl.split(",")[1] ?? "";
        if (Math.floor((base64.length * 3) / 4) <= 256 * 1024) break;
        avatarDataUrl = "";
      }
      if (!avatarDataUrl) throw new Error("Nao foi possivel reduzir a foto para o tamanho permitido.");

      const { user } = await Api.updateAvatar(avatarDataUrl);
      store.set({ user });
      toast("Foto atualizada", "Sua foto de perfil foi salva.", "success");
      this.refresh();
    } catch (error) {
      reportError(error, "Nao foi possivel salvar a foto");
    }
  }

  private async removeProfilePhoto(): Promise<void> {
    try {
      const { user } = await Api.updateAvatar(null);
      store.set({ user });
      toast("Foto removida", "Sua foto de perfil foi removida.", "success");
      this.refresh();
    } catch (error) {
      reportError(error, "Nao foi possivel remover a foto");
    }
  }

  private async importFile(file: File): Promise<void> {
    let payload: unknown;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      toast("Arquivo invalido", "O arquivo nao e um JSON valido.", "error");
      return;
    }
    const ok = await confirmDialog("Restaurar backup", "Todos os lancamentos e eventos atuais serao SUBSTITUIDOS pelo conteudo do arquivo. Recomenda-se exportar um backup antes. Continuar?", "Restaurar");
    if (!ok) return;
    try {
      const result = await Api.importBackup(payload);
      toast("Backup restaurado", `${result.entries} lancamentos e ${result.events} eventos importados.`, "success");
    } catch (error) {
      reportError(error, "Falha ao restaurar");
    }
  }

  private async changePassword(current: string, next: string): Promise<string | null> {
    try {
      await Api.changePassword(current, next);
      toast("Senha alterada", "Use a nova senha no proximo login.", "success");
      return null;
    } catch (error) {
      return error instanceof ApiError ? error.message : "Erro inesperado.";
    }
  }
}
