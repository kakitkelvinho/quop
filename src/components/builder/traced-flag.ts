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

/** The same page in the other view, keeping its other settings; traced is the default, so it needs no flag. */
export function tracedViewHref(href: string, traced: boolean): string {
  const url = new URL(href);
  if (traced) url.searchParams.delete("traced");
  else url.searchParams.set("traced", "0");
  url.hash = "";
  return url.toString();
}
