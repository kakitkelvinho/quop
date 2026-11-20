const TRACED_VIEW_KEY = "quop:builder:traced-view";

export function resolveTracedFlag(search: string, stored: string | null = null): boolean {
  const requested = new URLSearchParams(search).get("traced");
  if (requested === "0") return false;
  if (requested === "1") return true;
  return stored !== "legacy";
}

export function readTracedFlag(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return resolveTracedFlag(window.location.search, window.localStorage.getItem(TRACED_VIEW_KEY));
  } catch {
    return resolveTracedFlag(window.location.search);
  }
}

export function storeTracedFlag(traced: boolean): void {
  try { window.localStorage.setItem(TRACED_VIEW_KEY, traced ? "traced" : "legacy"); } catch { /* storage can be unavailable */ }
}
