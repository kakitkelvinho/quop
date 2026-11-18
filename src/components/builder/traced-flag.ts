export const TRACED_STORAGE_KEY = "quop-builder-traced";

export function resolveTracedFlag(search: string, stored: string | null): boolean {
  const requested = new URLSearchParams(search).get("traced");
  if (requested === "1") return true;
  if (requested === "0") return false;
  return stored === "1";
}

export function readTracedFlag(): boolean {
  try {
    const enabled = resolveTracedFlag(window.location.search, window.localStorage.getItem(TRACED_STORAGE_KEY));
    if (new URLSearchParams(window.location.search).has("traced")) {
      window.localStorage.setItem(TRACED_STORAGE_KEY, enabled ? "1" : "0");
    }
    return enabled;
  } catch {
    return typeof window !== "undefined" && resolveTracedFlag(window.location.search, null);
  }
}
