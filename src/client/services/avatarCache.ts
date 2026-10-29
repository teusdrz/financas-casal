import type { User } from "../models/types.js";

const DATABASE_NAME = "financas-casal-profile-photos";
const STORE_NAME = "avatars";
const LEGACY_KEY_PREFIX = "financas-casal:profile-photo:";

interface StoredAvatar {
  username: string;
  avatarDataUrl: string | null;
}

function usernameKey(username: string): string {
  return username.toLowerCase();
}

function legacyKey(username: string): string {
  return `${LEGACY_KEY_PREFIX}${encodeURIComponent(usernameKey(username))}`;
}

function openDatabase(): Promise<IDBDatabase> {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("Este navegador nao oferece armazenamento local persistente."));
  }
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "username" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Falha ao abrir o armazenamento da foto."));
    request.onblocked = () => reject(new Error("O armazenamento da foto esta bloqueado por outra aba do app."));
  });
}

async function readIndexedDb(username: string): Promise<StoredAvatar | null> {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(usernameKey(username));
      request.onsuccess = () => resolve((request.result as StoredAvatar | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Falha ao ler a foto salva."));
    });
  } finally {
    database.close();
  }
}

async function writeIndexedDb(username: string, avatarDataUrl: string | null): Promise<void> {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      transaction.objectStore(STORE_NAME).put({ username: usernameKey(username), avatarDataUrl } satisfies StoredAvatar);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Falha ao salvar a foto neste aparelho."));
      transaction.onabort = () => reject(transaction.error ?? new Error("O navegador cancelou o salvamento da foto."));
    });
  } finally {
    database.close();
  }
}

function readLegacy(username: string): StoredAvatar | null {
  const raw = localStorage.getItem(legacyKey(username));
  if (raw === null) return null;
  const cached: unknown = JSON.parse(raw);
  if (typeof cached !== "object" || cached === null || !("avatarDataUrl" in cached)) return null;
  const avatarDataUrl = cached.avatarDataUrl;
  if (avatarDataUrl !== null && typeof avatarDataUrl !== "string") return null;
  return { username: usernameKey(username), avatarDataUrl };
}

async function requestPersistentStorage(): Promise<void> {
  if (navigator.storage?.persist) {
    await navigator.storage.persist();
  }
}

export const AvatarCache = {
  async read(username: string): Promise<{ found: boolean; avatarDataUrl: string | null }> {
    try {
      const stored = await readIndexedDb(username);
      if (stored) return { found: true, avatarDataUrl: stored.avatarDataUrl };
    } catch (error) {
      console.warn("[avatar] Nao foi possivel ler a foto no armazenamento do navegador.", error);
    }

    try {
      const legacy = readLegacy(username);
      if (!legacy) return { found: false, avatarDataUrl: null };
      try {
        await writeIndexedDb(username, legacy.avatarDataUrl);
        localStorage.removeItem(legacyKey(username));
        await requestPersistentStorage();
      } catch (error) {
        console.warn("[avatar] Foto antiga mantida no armazenamento local legado.", error);
      }
      return { found: true, avatarDataUrl: legacy.avatarDataUrl };
    } catch (error) {
      console.warn("[avatar] Nao foi possivel recuperar a foto antiga.", error);
      return { found: false, avatarDataUrl: null };
    }
  },

  async save(username: string, avatarDataUrl: string | null): Promise<void> {
    try {
      await writeIndexedDb(username, avatarDataUrl);
      await requestPersistentStorage();
      return;
    } catch (indexedDbError) {
      console.warn("[avatar] IndexedDB indisponivel; tentando armazenamento local alternativo.", indexedDbError);
    }
    try {
      localStorage.setItem(legacyKey(username), JSON.stringify({ avatarDataUrl }));
    } catch {
      throw new Error("O navegador nao conseguiu guardar a foto. Verifique o espaco de armazenamento.");
    }
  },

  async restore(user: User): Promise<User> {
    const cached = await this.read(user.username);
    return cached.found ? { ...user, avatarDataUrl: cached.avatarDataUrl } : user;
  },
};
