import type { BackupPayload } from "../models/types.js";
import { Api } from "./api.js";

const DATABASE_NAME = "financas-casal-persistent-data";
const STORE_NAME = "backups";
const BACKUP_ID = "household";
let captureQueue: Promise<void> = Promise.resolve();

interface StoredBackup {
  id: string;
  savedAt: string;
  payload: BackupPayload;
}

function openDatabase(): Promise<IDBDatabase> {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("Este navegador nao oferece armazenamento local persistente."));
  }
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao abrir o armazenamento local."));
    request.onblocked = () => reject(new Error("O armazenamento local esta bloqueado por outra aba do app."));
  });
}

async function readBackup(): Promise<StoredBackup | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(BACKUP_ID);
      request.onsuccess = () => resolve((request.result as StoredBackup | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Falha ao ler o backup local."));
    });
  } finally {
    database.close();
  }
}

async function writeBackup(payload: BackupPayload): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({ id: BACKUP_ID, savedAt: new Date().toISOString(), payload } satisfies StoredBackup);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Falha ao salvar o backup local."));
      transaction.onabort = () => reject(transaction.error ?? new Error("O navegador cancelou o salvamento do backup local."));
    });
  } finally {
    database.close();
  }
}

function contentSignature(payload: BackupPayload): string {
  const entries = payload.entries
    .map(({ profileId, year, month, section, description, amount, dueDay, paid }) =>
      JSON.stringify([profileId, year, month, section, description, amount, dueDay, paid])
    )
    .sort();
  const events = payload.events
    .map(({ owner, title, date, time, category, amount, notes, alarmMinutes, done }) =>
      JSON.stringify([owner, title, date, time, category, amount, notes, alarmMinutes, done])
    )
    .sort();
  return JSON.stringify([entries, events]);
}

function validBackup(value: unknown): value is BackupPayload {
  if (typeof value !== "object" || value === null) return false;
  const payload = value as Partial<BackupPayload>;
  return payload.app === "financas-casal" && Array.isArray(payload.entries) && Array.isArray(payload.events);
}

export const BrowserBackup = {
  async initialize(): Promise<{ restored: boolean; warning: string | null }> {
    let local: StoredBackup | null;
    try {
      local = await readBackup();
    } catch (error) {
      console.error("[backup] Falha ao acessar o armazenamento persistente do navegador.", error);
      return { restored: false, warning: "Nao foi possivel abrir o armazenamento deste navegador. Os dados continuarao dependendo do servidor." };
    }

    let remote: BackupPayload;
    try {
      remote = await Api.exportBackup();
    } catch (error) {
      console.error("[backup] Falha ao obter dados do servidor para o backup local.", error);
      return { restored: false, warning: "Nao foi possivel atualizar o backup local. Verifique a conexao e tente novamente." };
    }

    if (!local || !validBackup(local.payload)) {
      try {
        await writeBackup(remote);
        return { restored: false, warning: null };
      } catch (error) {
        console.error("[backup] Falha ao criar o primeiro backup local.", error);
        return { restored: false, warning: "O navegador nao conseguiu guardar uma copia dos dados. Verifique o espaco disponivel." };
      }
    }

    if (contentSignature(local.payload) === contentSignature(remote)) {
      return { restored: false, warning: null };
    }

    try {
      await Api.importBackup(local.payload);
      await writeBackup(await Api.exportBackup());
      return { restored: true, warning: null };
    } catch (error) {
      console.error("[backup] Falha ao restaurar a copia local para o servidor.", error);
      return { restored: false, warning: "A copia deste navegador esta preservada, mas nao foi possivel restaura-la no servidor. Os dados locais permanecem guardados." };
    }
  },

  async capture(): Promise<void> {
    const capture = captureQueue.then(async () => {
      const payload = await Api.exportBackup();
      await writeBackup(payload);
    });
    captureQueue = capture.catch(() => undefined);
    await capture;
  },
};
