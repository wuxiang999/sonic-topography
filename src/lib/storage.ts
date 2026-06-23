export function readStorage<T>(key: string, defaultValue: T, normalize?: (raw: unknown) => T): T {
  if (typeof window === 'undefined') return defaultValue;

  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    const parsed = JSON.parse(raw);
    return normalize ? normalize(parsed) : (parsed as T);
  } catch {
    return defaultValue;
  }
}

export function writeStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
