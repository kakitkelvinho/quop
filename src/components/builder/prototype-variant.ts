"use client";

/**
 * PROTOTYPE — throwaway. Lives on branch `prototype/builder-no-posts` only.
 *
 * Question: does the bench read clearer without posts? And does a mirror
 * mount drawn after the lab's real LIOP-TEC one (black plate, anodised L
 * frame, black knurled knobs, silvered mirror with a green substrate edge)
 * read better than the current MARS drawing?
 *
 * Five variants on the existing /experiment/builder route, via `?variant=`.
 * A plain external store over the URL rather than Next's router, because the
 * models render inside the R3F canvas.
 */
import { useSyncExternalStore } from "react";

export const PROTOTYPE_VARIANTS = [
  { key: "A", name: "Current: grey posts" },
  { key: "B", name: "No posts, shadow only" },
  { key: "C", name: "No posts, base puck on the table" },
  { key: "D", name: "Real mount, stainless posts" },
  { key: "E", name: "Real mount, no posts" },
] as const;

export type PrototypeVariant = (typeof PROTOTYPE_VARIANTS)[number]["key"];

const EVENT = "prototype-variant";

function read(): PrototypeVariant {
  const raw = new URLSearchParams(window.location.search).get("variant");
  return PROTOTYPE_VARIANTS.find((v) => v.key === raw)?.key ?? "A";
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("popstate", onChange);
  };
}

export function setPrototypeVariant(key: PrototypeVariant) {
  const url = new URL(window.location.href);
  url.searchParams.set("variant", key);
  window.history.replaceState(window.history.state, "", url);
  window.dispatchEvent(new Event(EVENT));
}

export function usePrototypeVariant(): PrototypeVariant {
  return useSyncExternalStore(subscribe, read, () => "A");
}

/** What each variant changes, so the models ask a flag rather than a letter. */
export function usePrototypeFlags() {
  const v = usePrototypeVariant();
  return {
    posts: v === "A" || v === "D",
    basePuck: v === "C",
    stainlessPosts: v === "D",
    realMount: v === "D" || v === "E",
  };
}
