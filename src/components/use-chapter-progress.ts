"use client";

import { useEffect, type RefObject } from "react";

/** Below this width chapters stop pinning: touch momentum and a collapsing
 *  address bar make scroll-scrubbing feel broken on phones. */
const PIN_QUERY = "(min-width: 700px)";

/** How long an unpinned chapter takes to play through once it is in view. */
const PLAY_MS = 1800;

/**
 * Drives a chapter's `--p` custom property from 0 to 1, and hands the same
 * value to `onProgress` for anything CSS cannot compute (ticking numbers,
 * regenerated paths).
 *
 * - scrub: while the section is pinned, progress follows the scroll position
 *   across the section's extra height.
 * - play: once the section is well into view, progress runs 0 → 1 on its own.
 *
 * Scrub chapters fall back to play below 700px, and reduced motion jumps
 * straight to the finished drawing.
 */
export function useChapterProgress(
  sectionRef: RefObject<HTMLElement | null>,
  stageRef: RefObject<HTMLElement | null>,
  mode: "play" | "scrub",
  onProgress?: (p: number) => void,
) {
  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    if (!section || !stage) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pin = window.matchMedia(PIN_QUERY);
    let frame = 0;
    let observer: IntersectionObserver | undefined;
    let played = false;

    const set = (p: number) => {
      section.style.setProperty("--p", p.toFixed(4));
      onProgress?.(p);
    };

    const scrub = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = section.getBoundingClientRect();
        const top = parseFloat(getComputedStyle(stage).top) || 0;
        const travel = rect.height - stage.offsetHeight;
        set(travel > 0 ? Math.min(1, Math.max(0, (top - rect.top) / travel)) : 1);
      });
    };

    const play = () => {
      if (played) return;
      played = true;
      const started = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - started) / PLAY_MS);
        set(t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    };

    const teardown = () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scrub);
      window.removeEventListener("resize", scrub);
      observer?.disconnect();
      observer = undefined;
    };

    const setup = () => {
      teardown();
      if (reduce.matches) {
        set(1);
        return;
      }
      if (mode === "scrub" && pin.matches) {
        window.addEventListener("scroll", scrub, { passive: true });
        window.addEventListener("resize", scrub);
        scrub();
        return;
      }
      if (played) {
        set(1);
        return;
      }
      set(0);
      observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            observer?.disconnect();
            play();
          }
        },
        { threshold: 0.35 },
      );
      observer.observe(section);
    };

    setup();
    reduce.addEventListener("change", setup);
    pin.addEventListener("change", setup);
    return () => {
      teardown();
      reduce.removeEventListener("change", setup);
      pin.removeEventListener("change", setup);
    };
  }, [sectionRef, stageRef, mode, onProgress]);
}
