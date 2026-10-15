"use client";

/*
 * PROTOTYPE: throwaway. A floating bar that flips a `?<param>=` search
 * variant, for judging UI prototypes in place. Hidden in production builds.
 */

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const EVENT = "quop:prototype-variant";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("popstate", onChange);
  };
}

/** The variant named in the address, or the first one. Read without useSearchParams, so no Suspense. */
export function usePrototypeVariant<K extends string>(param: string, keys: readonly K[]): K {
  const raw = useSyncExternalStore(
    subscribe,
    () => new URLSearchParams(window.location.search).get(param),
    () => null,
  );
  return keys.includes(raw as K) ? (raw as K) : keys[0];
}

function setVariant(param: string, key: string) {
  const params = new URLSearchParams(window.location.search);
  params.set(param, key);
  // Next's router picks up native history calls
  window.history.replaceState(null, "", `?${params.toString()}`);
  window.dispatchEvent(new Event(EVENT));
}

export function PrototypeSwitcher<K extends string>({
  param,
  variants,
}: {
  param: string;
  variants: readonly { key: K; name: string }[];
}) {
  const current = usePrototypeVariant(
    param,
    variants.map((variant) => variant.key),
  );
  const index = variants.findIndex((variant) => variant.key === current);
  const step = useCallback(
    (by: number) => setVariant(param, variants[(index + by + variants.length) % variants.length].key),
    [param, variants, index],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      // Alt + arrow: plain arrows already nudge parts on the table
      if (!event.altKey || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable], [role=menu], [role=slider]")) return;
      step(event.key === "ArrowLeft" ? -1 : 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step]);

  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  if (process.env.NODE_ENV === "production" || !mounted) return null;

  return createPortal(
    <div className="protoSwitcher" role="group" aria-label="Prototype variant" title="Alt + ← / → also cycles">
      <button type="button" onClick={() => step(-1)} aria-label="Previous variant">
        ←
      </button>
      <span>
        <b>{current}</b> {variants[index]?.name}
      </span>
      <button type="button" onClick={() => step(1)} aria-label="Next variant">
        →
      </button>
    </div>,
    document.body,
  );
}

const noop = () => () => {};
