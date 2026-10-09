"use client";

import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";

import { Icon, type IconName } from "@/components/builder/builder-icons";

/*
 * The quick guide comes in two sizes, both opened from the top centre:
 *
 * - Coach marks, from the Guide pill: a one-off tour that dims the builder and
 *   tags each real control where it sits, with the camera and selection keys
 *   in a card in the middle. Any click or Esc closes it.
 * - The cheat sheet, from the tab under the tool pill: a strip of short how-tos
 *   that stays open beside the work until it is closed.
 *
 * A control the coach marks tag carries `data-guide` with its key in TAGS.
 */

type Side = "below" | "above" | "right" | "left";

/**
 * One tag per control. They are placed in this order, each clear of those
 * before it. The + island's go right to left, so its tags step down and left
 * and no leader crosses a tag.
 */
const TAGS: { key: string; text: string; sides: Side[] }[] = [
  { key: "file", text: "Save · open · PNG", sides: ["right", "below"] },
  { key: "connect", text: "Fibre or cable", sides: ["below"] },
  { key: "frame", text: "Frame an area", sides: ["below"] },
  { key: "beam", text: "Draw a beam", sides: ["below"] },
  { key: "add", text: "Add a part", sides: ["below"] },
  { key: "tools", text: "Select · posts · grid · undo", sides: ["right", "below"] },
  { key: "inspector", text: "Edit the selection", sides: ["left", "above"] },
  { key: "beams", text: "Beams: drag a row to reorder", sides: ["above", "right"] },
  { key: "frames", text: "Frames: hide or delete", sides: ["right", "above"] },
  { key: "view", text: "Iso / top · fit · labels · day / night", sides: ["above", "left"] },
];

const GAP = 10;
const TAG_HEIGHT = 24;
const EDGE = 8;
/** how far a tag may step away from its control, in tag rows, looking for room */
const MAX_STEPS = 10;

type Box = { x: number; y: number; w: number; h: number };
type Segment = [x1: number, y1: number, x2: number, y2: number];
type Placed = { key: string; text: string; ring: Box; tag: Box; line: Segment };

const box = (rect: DOMRect): Box => ({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });

const overlaps = (a: Box, b: Box, pad = 3) =>
  a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

/** Whether a leader passes through a box, by points along it (its ends sit on edges, so they don't count). */
const crosses = ([x1, y1, x2, y2]: Segment, target: Box) =>
  [0.15, 0.3, 0.45, 0.6, 0.75, 0.9].some((t) =>
    overlaps({ x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t, w: 0, h: 0 }, target, -1),
  );

/**
 * The tag on one side of a ring, `step` rows further out, kept on screen.
 * Under or over a single button it starts at the button, so a row of them
 * makes a staircase; beside a tall island it sits by the island's head.
 */
function tagBeside(ring: Box, side: Side, w: number, step: number): Box {
  const along = side === "above" ? -step : step;
  const x =
    side === "right"
      ? ring.x + ring.w + GAP
      : side === "left"
        ? ring.x - GAP - w
        : ring.w < 60
          ? ring.x + ring.w / 2 - 12
          : ring.x + ring.w / 2 - w / 2;
  const y =
    (side === "below"
      ? ring.y + ring.h + GAP
      : side === "above"
        ? ring.y - GAP - TAG_HEIGHT
        : ring.y + Math.min(ring.h, 48) / 2 - TAG_HEIGHT / 2) +
    along * (TAG_HEIGHT + 4);
  return {
    x: Math.min(Math.max(x, EDGE), window.innerWidth - w - EDGE),
    y: Math.min(Math.max(y, EDGE), window.innerHeight - TAG_HEIGHT - EDGE),
    w,
    h: TAG_HEIGHT,
  };
}

/** A straight leader from the ring's edge to the near edge of its tag. */
function leader(ring: Box, side: Side, tag: Box): Segment {
  const x = Math.min(Math.max(ring.x + ring.w / 2, tag.x + 8), tag.x + tag.w - 8);
  const y = Math.min(Math.max(ring.y + ring.h / 2, tag.y + 6), tag.y + tag.h - 6);
  if (side === "below") return [x, ring.y + ring.h, x, tag.y];
  if (side === "above") return [x, ring.y, x, tag.y + tag.h];
  if (side === "right") return [ring.x + ring.w, y, tag.x, y];
  return [ring.x, y, tag.x + tag.w, y];
}

/** The controls the coach marks can tag: on screen, and not under another island (the phone's inspector sheet). */
function visibleControls(overlay: HTMLElement) {
  return TAGS.flatMap((tag) => {
    const element = document.querySelector(`[data-guide="${tag.key}"]`);
    const rect = element?.getBoundingClientRect();
    if (!element || !rect?.width) return [];
    const top = document
      .elementsFromPoint(rect.left + rect.width / 2, rect.top + Math.min(rect.height, 40) / 2)
      .find((hit) => !overlay.contains(hit));
    return top && (element.contains(top) || top.contains(element)) ? [{ ...tag, ring: box(rect) }] : [];
  });
}

/**
 * Centre the card on the screen, or higher if that would sit it on a control
 * in the lower half (the phone's inspector sheet), leaving room above that
 * control for its tag; but never over the controls and tags of the upper half.
 */
function placeCard(overlay: HTMLElement, card: HTMLElement, tags: Placed[]) {
  const height = card.offsetHeight;
  const middle = window.innerHeight / 2;
  const rings = visibleControls(overlay).map((control) => control.ring);
  const floor = rings.filter((ring) => ring.y > middle).map((ring) => ring.y - 3 * GAP - TAG_HEIGHT - height);
  const ceiling = [...rings, ...tags.filter((spot) => spot.ring.y < middle).map((spot) => spot.tag)]
    .filter((other) => other.y + other.h < middle)
    .map((other) => other.y + other.h + GAP);
  const top = Math.max(Math.min((window.innerHeight - height) / 2, ...floor), ...ceiling, EDGE);
  card.style.top = `${top}px`;
}

/**
 * Lay each tag on the nearest spot, trying each of its sides one row further
 * out at a time, where neither it nor its leader covers a control, the card or
 * a tag already placed. With no such spot the control goes untagged rather than
 * under another tag; its tooltip still names it.
 */
function placeTags(overlay: HTMLElement, card: Box | null, measure: (text: string) => number): Placed[] {
  const found = visibleControls(overlay);
  // every control is an obstacle, a covered one too
  const obstacles = Array.from(document.querySelectorAll("[data-guide]"), (element) => ({
    key: element.getAttribute("data-guide"),
    box: box(element.getBoundingClientRect()),
  })).concat(card ? [{ key: "card", box: card }] : []);
  const placed: Placed[] = [];
  for (const { key, text, sides, ring } of found) {
    const w = measure(text);
    const clear = (tag: Box, line: Segment) =>
      !obstacles.some((other) => overlaps(tag, other.box) || (other.key !== key && crosses(line, other.box))) &&
      !placed.some((other) => overlaps(tag, other.tag) || crosses(line, other.tag) || crosses(other.line, tag));
    let best: { tag: Box; line: Segment } | null = null;
    search: for (let step = 0; step < MAX_STEPS; step++) {
      // beside a control a tag can't step away: its leader would run backwards
      for (const side of step ? sides.filter((side) => side === "below" || side === "above") : sides) {
        const tag = tagBeside(ring, side, w, step);
        const line = leader(ring, side, tag);
        if (clear(tag, line)) {
          best = { tag, line };
          break search;
        }
      }
    }
    if (best) placed.push({ key, text, ring, ...best });
  }
  return placed;
}

/** The coach marks: the builder dimmed, each control ringed and tagged in place. */
export function CoachMarks({ onClose, onShowCheatSheet }: { onClose: () => void; onShowCheatSheet: () => void }) {
  const [placed, setPlaced] = useState<Placed[]>([]);
  const overlayRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // read while rendering: by the first effect the Guide pill is hidden, and has lost focus
  const [opener] = useState(() => document.activeElement);

  useLayoutEffect(() => {
    const layout = () => {
      const probe = probeRef.current;
      const overlay = overlayRef.current;
      if (!probe || !overlay) return;
      const measure = (text: string) => {
        probe.textContent = text;
        return Math.ceil(probe.getBoundingClientRect().width);
      };
      // the tags first, to find room for the card between them, then again round it
      const card = cardRef.current;
      if (card) placeCard(overlay, card, placeTags(overlay, null, measure));
      setPlaced(placeTags(overlay, card ? box(card.getBoundingClientRect()) : null, measure));
    };
    layout();
    window.addEventListener("resize", layout);
    return () => window.removeEventListener("resize", layout);
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    // The scene reads keys on window: Esc would also deselect, and arrows, R
    // or Delete would edit the selection under the overlay. Tab stays inside.
    const onKeyDown = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Tab") {
        const buttons = Array.from(overlayRef.current?.querySelectorAll("button") ?? []);
        const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
        event.preventDefault();
        buttons[(at + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [onClose, opener]);

  // portalled: the top centre's centring transform would trap a fixed overlay
  return createPortal(
    <div
      ref={overlayRef}
      className="builderCoach"
      role="dialog"
      aria-modal="true"
      aria-labelledby="builder-coach-title"
      // on click, not pointerdown, so the release doesn't land on the scene
      onClick={onClose}
    >
      <span ref={probeRef} className="builderCoach__tag builderCoach__probe" aria-hidden="true" />
      <svg className="builderCoach__lines" aria-hidden="true">
        {placed.map((spot) => (
          <line key={spot.key} x1={spot.line[0]} y1={spot.line[1]} x2={spot.line[2]} y2={spot.line[3]} />
        ))}
      </svg>
      {placed.map((spot) => (
        <span
          key={spot.key}
          className="builderCoach__ring"
          aria-hidden="true"
          style={{ left: spot.ring.x - 3, top: spot.ring.y - 3, width: spot.ring.w + 6, height: spot.ring.h + 6 }}
        />
      ))}
      <ul className="builderCoach__tags" aria-label="Controls">
        {placed.map((spot) => (
          <li key={spot.key} className="builderCoach__tag" style={{ left: spot.tag.x, top: spot.tag.y }}>
            {spot.text}
          </li>
        ))}
      </ul>
      <div ref={cardRef} className="builderCoach__card">
        <h2 id="builder-coach-title" className="builderCoach__title">
          Quick guide
        </h2>
        <p>
          <kbd>drag</kbd> pan · <kbd>scroll</kbd> zoom · <kbd>⇧ drag</kbd> orbit
        </p>
        <p>
          <kbd>⌘ click</kbd> <kbd>⌘ drag</kbd> <kbd>⌘A</kbd> select several
        </p>
        <p className="builderCoach__hover">Hover a button for its name and shortcut.</p>
        <div className="builderCoach__actions">
          <button
            type="button"
            className="builderCoach__button"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
              onShowCheatSheet();
            }}
          >
            Open the cheat sheet
          </button>
          {/* closes like any other click on the overlay */}
          <button ref={closeRef} type="button" className="builderCoach__button is-primary">
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type Line = { icon: IconName; keys?: never; text: string } | { icon?: never; keys: string; text: string };

/** The cheat sheet's lines, in groups. Each fits on one line at the strip's width. */
const SHEET: { title: string; lines: Line[] }[] = [
  {
    title: "Build",
    lines: [
      { icon: "add", text: "Pick a part, click to place" },
      { icon: "beam", text: "Beam: click parts, Enter" },
      { icon: "frame", text: "Frame: drag its edge to move" },
      { icon: "connect", text: "Fibre or cable: from, then to" },
    ],
  },
  {
    title: "Edit",
    lines: [
      { keys: "drag", text: "Move a part (⇧ for 5 mm)" },
      { icon: "beam", text: "Stops snap back onto a beam" },
      { keys: "⌘ drag", text: "Box select; ⌘ click adds" },
      { keys: "R D ⌫", text: "Turn, copy, delete" },
    ],
  },
  {
    title: "Reorder, hide",
    lines: [
      { icon: "grip", text: "Drag a beam or stop row" },
      { keys: "Alt ↑↓", text: "Move a focused row" },
      { icon: "eye", text: "Hide a beam or frame" },
      { icon: "trash", text: "Delete one" },
    ],
  },
  {
    title: "Camera",
    lines: [
      { keys: "drag", text: "Pan the table" },
      { keys: "scroll", text: "Zoom" },
      { keys: "⇧ drag", text: "Orbit, or right drag" },
      { icon: "iso", text: "Iso / top, then fit" },
    ],
  },
];

/**
 * The cheat sheet: a strip under the tool pill. It doesn't block the table,
 * so it can stay open while you work; Esc inside it, or its close button,
 * closes it.
 */
export function CheatSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const onKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key !== "Escape") return;
    // stop here, so the scene's Esc doesn't also deselect
    event.stopPropagation();
    onClose();
  };

  return (
    <section id={id} className="builderIsland builderSheet" aria-labelledby={`${id}-title`} onKeyDown={onKeyDown}>
      <h2 id={`${id}-title`} className="builderSheet__title">
        Cheat sheet
      </h2>
      {SHEET.map((group) => (
        <div key={group.title} className="builderSheet__group">
          <h3 className="builderSheet__groupTitle">{group.title}</h3>
          <ul role="list">
            {group.lines.map((line) => (
              <li key={line.text}>
                {line.icon ? (
                  <span className="builderSheet__icon">
                    <Icon name={line.icon} size={15} />
                  </span>
                ) : (
                  <kbd>{line.keys}</kbd>
                )}
                {line.text}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <button
        type="button"
        className="builderHud__close"
        aria-label="Close cheat sheet"
        title="Close (Esc)"
        onClick={onClose}
      >
        <Icon name="close" size={16} />
      </button>
    </section>
  );
}
