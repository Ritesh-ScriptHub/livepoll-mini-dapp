const memoryCache = new Map<string, string>();

type CachedEnvelope<T> = {
  value: T;
  savedAt: number;
};

function hasStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readRaw(key: string) {
  if (hasStorage()) {
    return window.localStorage.getItem(key);
  }

  return memoryCache.get(key) ?? null;
}

function writeRaw(key: string, value: string) {
  if (hasStorage()) {
    window.localStorage.setItem(key, value);
    return;
  }

  memoryCache.set(key, value);
}

function removeRaw(key: string) {
  if (hasStorage()) {
    window.localStorage.removeItem(key);
    return;
  }

  memoryCache.delete(key);
}

export function setCachedItem<T>(key: string, value: T) {
  const envelope: CachedEnvelope<T> = {
    value,
    savedAt: Date.now(),
  };

  writeRaw(key, JSON.stringify(envelope));
}

export function getCachedItem<T>(key: string, ttlMs: number): CachedEnvelope<T> | null {
  const raw = readRaw(key);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CachedEnvelope<T>;
    if (Date.now() - parsed.savedAt > ttlMs) {
      removeRaw(key);
      return null;
    }

    return parsed;
  } catch {
    removeRaw(key);
    return null;
  }
}

export function clearCachedItem(key: string) {
  removeRaw(key);
}
