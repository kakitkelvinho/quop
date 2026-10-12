---
target: builder frame UI
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/hok5/Documents/quop/src/components/builder/builder-scene.tsx"
target_fingerprint: "sha256:1b9a04d4088d0babc23573862882c7401b8da87b81638bc2773a4821f1972cd0"
target_path: /Users/hok5/Documents/quop/src/components/builder/builder-scene.tsx
timestamp: 2026-10-11T22-13-40Z
slug: src-components-builder-builder-scene-tsx
---
Method: dual-agent (A: design review · B: detector + browser)
Target: builder frame UI (draw mode, reshape handles, refusal, inspector, Frames box, guide copy)

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Live preview + badge good; no live size readout; refusal reason ~900px from cursor |
| 2 | Match System / Real World | 3 | mm + "Breadboard, enclosure…" placeholder; auto-name "Frame 225 × 225 mm" misleads for an L |
| 3 | User Control and Freedom | 3 | Esc, ⌫, one undo per frame, drag stops at valid |
| 4 | Consistency and Standards | 2 | Drag = rectangle before first corner, pan after; edge-press moves unselected, reshapes selected; badge omits Enter (beam badge shows it) |
| 5 | Error Prevention | 3 | Live refusal + clamped reshape |
| 6 | Recognition Rather Than Recall | 2 | Badge omits Enter/click-first-corner; Alt-drag only in inspector paragraph; cheat sheet line gives no finish gesture |
| 7 | Flexibility and Efficiency | 2 | No size presets, no keyboard drawing, label not focused after finish |
| 8 | Aesthetic and Minimalist Design | 3 | Quiet; handles read in both themes; inspector hint repeats toast |
| 9 | Error Recovery | 3 | Full-sentence reasons, but one catch-all and far from cursor |
| 10 | Help and Documentation | 3 | Coach mark, cheat sheet, hint present; finish gesture missing from cheat sheet |
| **Total** | | **27/40** | **Acceptable** |

## Priority Issues
- [P1] Mobile (390px): mode badge nowrap-clipped at both edges (mode name and "Click corner" invisible); inspector covers status line and beams box (detector: 64% occlusion of p.builderStatus).
- [P1] Refusal is colour-only (#dc2626 vs frame colour; orange #ea580c frame and red beam nearby), and the reason sits bottom-right far from the pointer.
- [P2] Drag/edge-press change meaning by state (rectangle vs pan; move vs reshape). Move-vs-reshape split was decided in #146.
- [P2] Weak finish moment: no live W × D readout while drawing/dragging, Label not focused, size-based name for shaped frames.
- [P2] Screen reader/keyboard: hover refusal reasons stream into the aria-live status line; swatches named by hex; swatches 21×21 (< 24 WCAG 2.5.8); drawing needs a pointer.

## Detector
CLI exit 0; 36 advisory design-system-color, all test fixtures/palette data (false positives). CSS: off-ramp font sizes 0.6–0.74rem and radii in builder section. Overlay: undersized label text (Label/Size 10.9px, Frames title 10.6px), inspector hint 11.5px, cramped status padding; mobile occlusion as above.

## Minor
Dragged-rectangle preview is fainter than the corner preview; inspector hint repeats the toast; "FRAMES" heading vs beams box without one; handles ~8-10px on screen in iso.

## Questions
Presets-first instead of freehand? Should crossing be flagged rather than refused? Graphite/chalk outlines instead of Tailwind hues?
