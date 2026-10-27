/**
 * Cache local (localStorage). O banco oficial e o SQLite no servidor;
 * o navegador guarda uma copia dos ultimos dados e as preferencias,
 * para a tela abrir instantaneamente e continuar legivel se a conexao cair.
 */

const PREFIX = "fc:v1:";

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(PREFIX + key, value);
  } catch {
    // Armazenamento cheio ou bloqueado (modo privado): segue sem cache.
  }
}

export const Cache = {
  read<T>(key: string, isValid: (value: unknown) => value is T): T | null {
    const raw = safeGet(key);
    if (raw === null) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return isValid(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },

  write(key: string, value: unknown): void {
    safeSet(key, JSON.stringify(value));
  },

  clearAll(): void {
    try {
      const keys: string[] = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(PREFIX)) keys.push(k);
      }
      keys.forEach((k) => window.localStorage.removeItem(k));
    } catch {
      // ignorado
    }
  },
};

export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
