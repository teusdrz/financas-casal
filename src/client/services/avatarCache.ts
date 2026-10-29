import type { User } from "../models/types.js";

const KEY_PREFIX = "financas-casal:profile-photo:";

interface CachedAvatar {
  avatarDataUrl: string | null;
}

function keyFor(username: string): string {
  return `${KEY_PREFIX}${encodeURIComponent(username.toLowerCase())}`;
}

export const AvatarCache = {
  read(username: string): { found: boolean; avatarDataUrl: string | null } {
    try {
      const value = localStorage.getItem(keyFor(username));
      if (value === null) return { found: false, avatarDataUrl: null };
      const cached = JSON.parse(value) as Partial<CachedAvatar>;
      if (cached.avatarDataUrl !== null && typeof cached.avatarDataUrl !== "string") {
        return { found: false, avatarDataUrl: null };
      }
      return { found: true, avatarDataUrl: cached.avatarDataUrl };
    } catch (error) {
      console.warn("[avatar] Nao foi possivel ler a foto salva neste navegador.", error);
      return { found: false, avatarDataUrl: null };
    }
  },

  save(username: string, avatarDataUrl: string | null): void {
    localStorage.setItem(keyFor(username), JSON.stringify({ avatarDataUrl } satisfies CachedAvatar));
  },

  restore(user: User): User {
    const cached = this.read(user.username);
    return cached.found ? { ...user, avatarDataUrl: cached.avatarDataUrl } : user;
  },
};
