"use client";

import Link, { type LinkProps } from "next/link";
import {
  type ComponentPropsWithoutRef,
  type MouseEvent,
} from "react";

import { usePageTransition } from "@/components/transition-provider";

type AnchorProps = Omit<ComponentPropsWithoutRef<"a">, "href">;

type NavTransitionLinkProps = LinkProps &
  AnchorProps & {
    onNavigate?: () => void;
  };

export function NavTransitionLink({
  children,
  href,
  onClick,
  onNavigate,
  ...props
}: NavTransitionLinkProps) {
  const { isTransitioning, startTransition } = usePageTransition();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (
      event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      props.target === "_blank" ||
      typeof href !== "string"
    ) {
      return;
    }

    event.preventDefault();
    onNavigate?.();
    startTransition(href);
  }

  return (
    <Link
      {...props}
      aria-disabled={isTransitioning || undefined}
      href={href}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
}
