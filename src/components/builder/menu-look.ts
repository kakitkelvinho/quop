"use client";

// PROTOTYPE (prototype/status-row-fade): the HUD's menus as rings (today's fans
// and Show wheel) or as boxes (islands of square buttons, names floating beside
// them). One switch flips them all; ?menus=ring or ?menus=boxes picks one, and
// the choice is remembered in this browser.

import { useSyncExternalStore } from "react";

export type MenuLook = "boxes" | "ring";

const KEY = "quop.prototype.menuLook";
const listeners = new Set<() => void>();
let current: MenuLook | null = null;

function read(): MenuLook {
  if (current) return current;
  try {
    const asked = new URLSearchParams(window.location.search).get("menus");
    const look = asked === "ring" || asked === "boxes" ? asked : window.localStorage.getItem(KEY);
    current = look === "ring" ? "ring" : "boxes";
  } catch {
    current = "boxes";
  }
  return current;
}

export function setMenuLook(look: MenuLook) {
  current = look;
  try {
    window.localStorage.setItem(KEY, look);
  } catch {
    // not remembered, still switched
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useMenuLook(): MenuLook {
  return useSyncExternalStore(subscribe, read, () => "boxes");
}
