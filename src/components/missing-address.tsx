"use client";

import { useSyncExternalStore } from "react";

const noSubscription = () => () => {};

/**
 * The 404's "There's nothing at /path." The page is exported once as static
 * HTML and served for every unknown address, so the address is only known in
 * the browser: the server render leaves the sentence out rather than guess.
 */
export function MissingAddress() {
  const pathname = useSyncExternalStore(
    noSubscription,
    () => window.location.pathname,
    () => null,
  );
  if (!pathname) return null;
  return (
    <>
      There&rsquo;s nothing at <code className="notFound__address">{pathname}</code>.{" "}
    </>
  );
}
