import { toast } from "../core/toast.js";
import { BrowserBackup } from "../services/BrowserBackup.js";
import { ApiError } from "../services/api.js";

/** Converte erros da API em mensagem amigavel (toast) e lista de detalhes para formularios. */
export function reportError(error: unknown, context: string): string[] {
  if (error instanceof ApiError) {
    if (error.status !== 401) {
      toast(context, error.details.length > 0 ? error.details.join(" ") : error.message, "error");
    }
    return error.details.length > 0 ? error.details : [error.message];
  }
  console.error(error);
  toast(context, "Erro inesperado. Tente novamente.", "error");
  return ["Erro inesperado."];
}

export async function captureBrowserBackup(): Promise<void> {
  try {
    await BrowserBackup.capture();
  } catch (error) {
    console.error("[backup] A alteracao foi enviada ao servidor, mas nao foi possivel atualizar a copia local.", error);
    toast(
      "Dados salvos no servidor; copia local falhou",
      "Mantenha este navegador aberto e tente novamente. Verifique o espaco de armazenamento do navegador.",
      "warning",
      8000
    );
  }
}

/**
 * Abre um .ics. No iPhone (Safari) isso exibe a tela "Adicionar ao Calendario";
 * no computador, baixa o arquivo para importar no app de calendario.
 */
export function openIcs(url: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
