"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import { Icon, type IconName } from "@/components/builder/builder-icons";

/*
 * The HUD's corner menus: a column of boxes, the dock's own square buttons,
 * each in its own island, that unfolds from its trigger along the workspace's
 * edge, each name floating beside its box on the side towards the table. The
 * QUOP mark's file menu and the + open from the top left (sideways, clear of
 * each other), Share and the ? from the top right, the camera from the bottom
 * right.
 */

/** The workspace corner a menu opens from. */
export type Corner = "tl" | "tr" | "br";

export type CornerFanItem = {
  id: string;
  /** one word, beside its box */
  label: string;
  icon: IconName;
  run: () => void;
  /** its tooltip, when the word wants a few more */
  hint?: string;
  disabled?: boolean;
  /** marked as the current one (the camera's view, an open panel) */
  on?: boolean;
  /** a file format, such as .json or .png */
  file?: boolean;
  /** tinted orange on hover and focus, not the accent */
  danger?: boolean;
};

/** Only one corner menu is open at a time: opening one closes the last. */
let closeOpenFan: (() => void) | null = null;

/**
 * A column of boxes: a menu with one roving tab stop. Up/Down walk it (from
 * the bottom corner the column runs up, so there Up walks away from the
 * trigger), Home/End jump to its ends, Enter or Space runs the box, Esc or Tab
 * closes. Only those keys are kept off the table; the rest (undo, say) still
 * reach it.
 */
export function FanBoxes({
  corner,
  label,
  items,
  note,
  onPick,
  onClose,
}: {
  corner: Corner;
  label: string;
  items: CornerFanItem[];
  /** a caution floating under the column, plateless like the names */
  note?: string;
  onPick: (item: CornerFanItem) => void;
  onClose: () => void;
}) {
  const noteId = useId();
  const first = Math.max(
    0,
    items.findIndex((item) => !item.disabled),
  );
  const [focus, setFocus] = useState(first);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const n = items.length;

  useEffect(() => {
    refs.current[first]?.focus();
  }, [first]);

  const move = (to: number) => {
    const next = (to + n) % n;
    setFocus(next);
    refs.current[next]?.focus();
  };
  const forward = corner === "br" ? "ArrowUp" : "ArrowDown";
  const back = corner === "br" ? "ArrowDown" : "ArrowUp";
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let run: (() => void) | undefined;
    if (event.key === forward) run = () => move(focus + 1);
    else if (event.key === back) run = () => move(focus - 1);
    else if (event.key === "Home") run = () => move(0);
    else if (event.key === "End") run = () => move(n - 1);
    else if (event.key === "Escape" || event.key === "Tab") run = onClose;
    else if (event.key === "Enter" || event.key === " ") {
      // the box clicks itself; the table mustn't also act on the key
      event.stopPropagation();
      return;
    }
    if (!run) return;
    event.preventDefault();
    event.stopPropagation();
    run();
  };

  return (
    <div
      className={`fanBoxes fanBoxes--${corner}`}
      role="menu"
      aria-label={label}
      aria-orientation="vertical"
      aria-describedby={note ? noteId : undefined}
      onKeyDown={onKeyDown}
    >
      {items.map((item, i) => (
        // each box its own island, apart as the QUOP and + islands are; they unfold in turn
        <div key={item.id} className="builderIsland fanBoxes__island" style={{ "--i": i } as CSSProperties}>
          <button
            ref={(node) => {
              refs.current[i] = node;
            }}
            type="button"
            role="menuitem"
            className={`builderIconBtn fanBoxes__box${item.on ? " is-shown" : ""}${item.danger ? " is-danger" : ""}${item.file ? " is-file" : ""}`}
            aria-label={item.hint ? `${item.label}: ${item.hint}` : item.label}
            aria-current={item.on || undefined}
            disabled={item.disabled}
            tabIndex={i === focus ? 0 : -1}
            title={item.hint}
            onFocus={() => setFocus(i)}
            onClick={() => onPick(item)}
          >
            <Icon name={item.icon} />
            <span className="fanBoxes__name" aria-hidden="true">
              {item.label}
            </span>
          </button>
        </div>
      ))}
      {note ? (
        <p className="fanBoxes__note" id={noteId} role="none">
          {note}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A trigger and its corner menu. Picking a box runs it and closes the menu;
 * Esc closes it and hands focus back to the trigger; a pointer-down outside
 * closes it and lets its click land where it was aimed. With `onTrigger`, a
 * press runs that instead of opening whenever it returns true (the + cancels
 * what it started).
 */
export function CornerFan({
  corner,
  label,
  items,
  children,
  className = "builderIconBtn",
  active = false,
  onTrigger,
  guide,
  title = label,
}: {
  corner: Corner;
  /** the menu's name, and the trigger's unless it has words of its own */
  label: string;
  items: CornerFanItem[];
  /** the trigger's face */
  children: ReactNode;
  className?: string;
  /** the trigger lights while something it started is live */
  active?: boolean;
  onTrigger?: () => boolean;
  /** its key in the quick guide's coach marks */
  guide?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dismiss = useCallback(() => setOpen(false), []);
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    if (closeOpenFan !== dismiss) closeOpenFan?.();
    closeOpenFan = dismiss;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) dismiss();
    };
    // Esc with the focus outside the column, which handles its own
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      if (closeOpenFan === dismiss) closeOpenFan = null;
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, dismiss, close]);

  const pick = (item: CornerFanItem) => {
    if (item.disabled) return;
    close();
    item.run();
  };

  return (
    <div className="cornerFan__anchor" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`${className}${active || open ? " is-active" : ""}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        title={title}
        data-guide={guide}
        onClick={() => {
          if (!open && onTrigger?.()) return;
          setOpen((current) => !current);
        }}
      >
        {children}
      </button>
      {open ? <FanBoxes corner={corner} label={label} items={items} onPick={pick} onClose={close} /> : null}
    </div>
  );
}
