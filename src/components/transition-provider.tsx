"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { usePathname, useRouter } from "next/navigation";

import { navSections } from "@/components/navigation";

type TransitionState = {
  accent: string;
  href: string;
  label: string;
  stage: "launch" | "settle";
};

type PageTransitionContextValue = {
  isTransitioning: boolean;
  startTransition: (href: string) => void;
};

const PageTransitionContext = createContext<PageTransitionContextValue | null>(null);

function findSectionByHref(href: string) {
  return navSections.find(
    (section) => href === section.href || href.startsWith(`${section.href}/`),
  );
}

export function TransitionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [transition, setTransition] = useState<TransitionState | null>(null);
  const timers = useRef<number[]>([]);

  const clearTimers = useCallback(() => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const startTransition = useCallback(
    (href: string) => {
      if (!href || href === pathname || transition) {
        if (href && href !== pathname && !transition) {
          router.push(href);
        }

        return;
      }

      const section = findSectionByHref(href);

      setTransition({
        accent: section?.accent ?? "#ff9d5c",
        href,
        label: section?.label ?? "Section",
        stage: "launch",
      });

      clearTimers();
      timers.current.push(window.setTimeout(() => router.push(href), 380));
      timers.current.push(
        window.setTimeout(
          () =>
            setTransition((current) =>
              current && current.href === href
                ? { ...current, stage: "settle" }
                : current,
            ),
          560,
        ),
      );
      timers.current.push(window.setTimeout(() => setTransition(null), 980));
    },
    [clearTimers, pathname, router, transition],
  );

  const value = useMemo(
    () => ({
      isTransitioning: Boolean(transition),
      startTransition,
    }),
    [startTransition, transition],
  );

  return (
    <PageTransitionContext.Provider value={value}>
      {children}
      {transition ? (
        <div
          aria-hidden="true"
          className={`pageTransition pageTransition--${transition.stage}`}
          style={{
            "--transition-accent": transition.accent,
          } as CSSProperties}
        >
          <div className="pageTransition__veil" />
          <div className="pageTransition__orbit" />
          <div className="pageTransition__beam" />
          <div className="pageTransition__photon" />
          <div className="pageTransition__labelWrap">
            <p className="pageTransition__eyebrow">Photon route</p>
            <p className="pageTransition__label">{transition.label}</p>
          </div>
        </div>
      ) : null}
    </PageTransitionContext.Provider>
  );
}

export function usePageTransition() {
  const context = useContext(PageTransitionContext);

  if (!context) {
    throw new Error("usePageTransition must be used within TransitionProvider");
  }

  return context;
}
