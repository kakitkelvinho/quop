export function resolveTracedFlag(search: string): boolean {
  return new URLSearchParams(search).get("traced") !== "0";
}

export function readTracedFlag(): boolean {
  try {
    return resolveTracedFlag(window.location.search);
  } catch {
    return true;
  }
}
