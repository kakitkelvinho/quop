# Library or hand-rolled drag, resize and snap for the Tabletop's panels

Research for [#225](https://github.com/kakitkelvinho/quop/issues/225), part of map [#222](https://github.com/kakitkelvinho/quop/issues/222).
The behaviour being built is decided in [#223](https://github.com/kakitkelvinho/quop/issues/223): all six panels (Parts, Inspector,
Frames, Groups, Brief, JSON) float, move by the title bar, resize from edges and corners with a minimum size, maximise,
minimise to the title bar, snap to the canvas edges **and to each other**, stay in view when the window shrinks, and are off
on small and touch screens.

Date: 2026-10-15. No production code was changed.

## Recommendation

**Hand-roll it on pointer events**, as a small `usePanelFrame`-style hook beside `use-row-drag.ts` and `use-box-select.ts`,
with the geometry (snap, clamp, min size, maximise) as pure functions tested with `node --test` like the rest of
`src/components/builder/`.

No candidate library does the two hardest parts, snapping to *other panels* and clamping into view *when the window
resizes*; both have to be written by us whatever we pick. What a library would save is the gesture plumbing (pointer
capture, eight resize handles, min size), which is around a hundred lines and already a solved pattern in this codebase.
The one library that would be worth adopting if we wanted to buy rather than build is **interact.js** (pointer-event based,
snap targets can be functions, size restriction built in); it is the fallback, not the pick. `react-rnd` is the most
convenient drop-in but runs on mouse/touch events, has only grid snapping, and adds three packages.

## What the codebase already does

- Every Tabletop drag is hand-rolled on pointer events: `use-row-drag.ts` (243 lines: slop, touch hold, pointer id tracking,
  keyboard Alt+arrows), `use-box-select.ts` (105 lines, capture-phase press on the canvas host), `use-frame-drawing.ts` and
  the part drag in `builder-scene.tsx`. All of them listen on `window` for move/up and handle `pointercancel`.
- The panels are `.builderIsland` elements (`src/app/globals.css` from line 2281) laid out by the HUD's grid/flex containers
  (`.builderHud__center > .builderIsland { position: static }` etc.). Making them float means taking them out of that layout
  whatever drives the gesture.
- `builder-hud.tsx` and `builder-parts-panel.tsx` are already `"use client"`, so a client-only library would not need an extra
  wrapper. Next's own docs say a third-party component that uses client-only features works when rendered from a Client
  Component (`node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`, line 428 on).
- Installed: `next` ^16.2.2, `react` / `react-dom` 19.2.3 (`package.json`). No drag library is in the lockfile today.

## Candidates

Versions, dates and peer ranges are from the npm registry (`registry.npmjs.org/<pkg>`); repo activity from the GitHub API
(`api.github.com/repos/<owner>/<repo>`), both read 2026-10-15. Sizes marked *measured* are gzip -9 of the file the package
ships, from the published tarball; sizes marked *bundlephobia* are minified + gzip from `bundlephobia.com/api/size`.

| Package | Latest (published) | React peer | Size | Repo last push / open issues |
| --- | --- | --- | --- | --- |
| `react-rnd` | 10.5.3 (2026-03-10) | `>=16.3.0` | 5.0 KB own (*measured*, unminified) + `re-resizable` 6.8 KB + `react-draggable` 9.7 KB (*measured*, unminified CJS) + `tslib` | bokuweb/react-rnd 2026-05-12 / 181 |
| `re-resizable` | 6.11.2 (2025-02-24) | `^16.13.1 \|\| … \|\| ^19.0.0` | 6.8 KB (*measured*) | 2026-05-12 / 90 |
| `react-draggable` | 4.7.2 (2026-09-16) | `>= 16.3.0` | 11.4 KB UMD min (*measured*) | 2026-10-14 / 57 |
| `@dnd-kit/core` (+`/modifiers`) | 6.3.1 (2024-12-05) | `>=16.8.0` | 14.2 KB (*bundlephobia*) | clauderic/dnd-kit 2026-09-12 / 144 |
| `@dnd-kit/react` | 0.5.0 (2026-06-11), pre-1.0 | `^18 \|\| ^19` | 33.1 KB (*bundlephobia*) | same repo |
| `react-grid-layout` | 2.3.0 (2026-10-05) | `>= 16.3.0` | 24.8 KB (*bundlephobia*) | 2026-10-14 / 65 |
| `interactjs` | 1.10.28 (2026-08-01) | none (framework-agnostic) | 29.0 KB `interact.min.js` (*measured*, full build) | taye/interact.js 2026-08-01 / 95 |
| `react-moveable` | 0.56.0 (2023-12-03) | none declared | 107.7 KB `moveable.esm.js` (*measured*) | daybrush/moveable 2024-06-03 / 454 |
| hand-rolled | n/a | n/a | a few KB of our own code | ours |

### react-rnd (react-draggable + re-resizable)

- **React 19: works.** React 19 removed `ReactDOM.findDOMNode`; `react-draggable` 4.7.2 says so in its source
  ("React 19 removed ReactDOM.findDOMNode, so nodeRef is now required", `build/cjs/Draggable.js` ~line 532) and falls back
  to `nodeRef`. `react-rnd` 10.5.3 passes `nodeRef: this.resizableElement` to `Draggable` (`lib/index.js` line 451), so it is
  safe without a `findDOMNode`.
- **Events: mouse + touch, not pointer events.** `react-draggable` binds `mousedown/mousemove` and `touchstart/touchmove`
  (`Draggable.js` lines 389-395); `re-resizable` binds `mousemove/mouseup/touchmove/touchend` (`lib/index.js`). The rest of
  the Tabletop uses pointer events and `pointercancel`; mixing models makes "a panel drag must not also pan the camera"
  harder to reason about.
- **Snap: grid only.** `dragGrid` / `resizeGrid` (snap to a fixed step), and `re-resizable` has `snap: { x?: number[], y?: number[] }`
  with `snapGap` (snap the *size* to absolute values, `lib/index.d.ts` line 60). No snapping of the position to another
  element's edges. Panel-to-panel snap would be done by us in `onDrag`, fighting the component's own controlled `position`.
- **Bounds:** `bounds="parent" | "window" | selector | HTMLElement` restricts the drag, but bounds are computed in
  `onDragStart` / `onResizeStart` (`lib/index.js` lines 156, 251). Nothing re-clamps a resting panel when the window shrinks;
  that would be ours.
- Min size, maximum size, eight handles with custom classes and components: built in (`minWidth`, `minHeight`,
  `enableResizing`, `resizeHandleComponent`).

### dnd-kit

Built for drag **and drop** (sortables, droppable zones, keyboard sensors). Neither `@dnd-kit/core` 6.3.1 nor
`@dnd-kit/react` 0.5.0 has resizing (no match for "resiz" anywhere in the `@dnd-kit/react` tarball). `@dnd-kit/modifiers`
offers `restrictToWindowEdges` and a grid snap modifier, not snap to other draggables. The stable line (`core` 6.3.1) has not
been published since 2024-12; the new `@dnd-kit/react` is still 0.x. Wrong tool for free-floating resizable panels.

### react-grid-layout

A dashboard grid: items are `{ i, x, y, w, h }` "in grid units" (`README.md` line 782 on) inside a container with
`gridConfig={{ cols, rowHeight }}`. v2 adds `noCompactor` ("free positioning") and `allowOverlap`, but positions are still
quantised to columns and rows. Panels of the Tabletop overlap a 3D canvas and float freely, which this does not model.
Well maintained (2.3.0, 2026-10-05), but a mismatch.

### interact.js

- Framework-agnostic, attached to a DOM element through a ref; no React peer, so no React 19 risk beyond our own effect cleanup.
- Uses pointer events where available (`pointerdown` is in `dist/interact.min.js`, with mouse/touch fallbacks).
- **Snap targets may be functions:** `type SnapTarget = SnapPosition | SnapFunction`, `SnapFunction = (x, y, interaction, offset, index) => SnapPosition`
  with a `range` (`@interactjs/types` 1.10.28 `index.d.ts` lines 2344-2353). That is the hook for panel-to-panel snapping: we
  would still compute the other panels' edges, but the library applies them. `snapEdges` and `snapSize` exist for resize.
- `restrict`, `restrictEdges`, `restrictSize` (`min`, line 2647) cover keep-in-canvas and min size during a gesture. Like
  react-rnd, nothing re-clamps on window resize.
- `resizable({ edges, margin })` gives edge and corner resizing on one element without extra handle elements.
- About 29 KB gzip for the full build; the scoped `@interactjs/*` packages can tree-shake. The 1.10.x line is maintained
  (1.10.28 in 2026-08), but the API is imperative and the interaction state lives outside React.

### react-moveable

The only candidate with built-in snapping to other elements (guidelines), but it is ~108 KB gzip, last published
2023-12-03, last pushed 2024-06, 454 open issues, and declares no React peer range, so React 19 support is unverified.
Ruled out.

## Weighing it against the requirements

| Requirement | react-rnd | interact.js | hand-rolled |
| --- | --- | --- | --- |
| Move by title bar | `dragHandleClassName` | `allowFrom` | ~40 lines, same pattern as `use-row-drag.ts` |
| Resize edges + corners, min size | built in | built in | ~60 lines: 8 hit zones, `setPointerCapture`, clamp to min |
| Maximise / minimise | ours (state) | ours (state) | ours (state) |
| Snap to canvas edges | via `bounds` + our code | `restrict` + `snap` | pure function |
| Snap to other panels | ours, inside `onDrag` | function targets, edges ours | pure function |
| Clamp into view on window resize | ours | ours | pure function on a `resize` / `ResizeObserver` |
| Pointer events, no camera pan bleed | no (mouse/touch) | yes | yes, consistent with the rest |
| Touch | supported, but windowing is off on coarse pointers (#223) | same | not needed |
| Bundle | ~3 packages | ~29 KB | ~0 |
| Tests | DOM-bound | DOM-bound | geometry testable with `node --test` |

The parts a library does not cover (panel-to-panel snap, window-resize clamp, maximise, Reset panels, persistence per
browser) are the bulk of the logic, and they are pure geometry on rectangles. Writing them as pure functions makes them
testable in the repo's existing `node --test` setup; a library would put the gesture in code we cannot unit-test there.
Touch, the usual reason to buy, is moot: #223 turns windowing off on small and coarse-pointer screens.

## Risks of hand-rolling, and how to hold them

- **Text selection and iframes during drag:** set `user-select: none` on the body while dragging and use
  `setPointerCapture` on the title bar / handle so the pointer is not lost over the canvas.
- **Camera pan on press:** the panels sit over the canvas host; `stopPropagation` on the panel's `pointerdown` (as
  `use-box-select.ts` does in the capture phase) keeps OrbitControls out of it.
- **Keyboard and screen readers** (open item on #222): a library would not have solved this either; react-rnd and
  interact.js have no keyboard support for move/resize. `use-row-drag.ts` already shows the Alt+arrow pattern.

## Sources

- npm registry metadata: `https://registry.npmjs.org/{react-rnd,re-resizable,react-draggable,@dnd-kit/core,@dnd-kit/react,@dnd-kit/modifiers,react-grid-layout,react-moveable,interactjs}`
- Published tarballs read: `react-rnd-10.5.3.tgz` (`lib/index.js`), `react-draggable-4.7.2.tgz` (`build/cjs/Draggable.js`),
  `re-resizable-6.11.2.tgz` (`lib/index.js`, `lib/index.d.ts`), `interactjs-1.10.28.tgz` (`dist/interact.min.js`),
  `@interactjs/types-1.10.28.tgz` (`index.d.ts`), `react-grid-layout-2.3.0.tgz` (`README.md`), `@dnd-kit/react-0.5.0.tgz`,
  `react-moveable-0.56.0.tgz` (`dist/moveable.esm.js`)
- GitHub API repo metadata: bokuweb/react-rnd, bokuweb/re-resizable, react-grid-layout/react-draggable, clauderic/dnd-kit,
  react-grid-layout/react-grid-layout, taye/interact.js, daybrush/moveable
- bundlephobia: `@dnd-kit/core@6.3.1`, `@dnd-kit/react@0.5.0`, `react-grid-layout@2.3.0` (other packages did not return a result)
- Next.js 16 docs in `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
- This repo: `package.json`, `src/components/builder/use-row-drag.ts`, `use-box-select.ts`, `builder-hud.tsx`, `src/app/globals.css`
