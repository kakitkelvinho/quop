---
target: Tabletop builder
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/hok5/Documents/quop/src/app/builder/tabletop/page.tsx"
target_fingerprint: "sha256:8c1a4e3e2ca6221454ef567da4038516559b5920c5b9ff257c620ba9c49e8137"
target_path: /Users/hok5/Documents/quop/src/app/builder/tabletop/page.tsx
timestamp: 2026-10-12T15-37-57Z
slug: src-app-builder-tabletop-page-tsx
---
Method: dual-agent (A: design review · B: detector + browser)
Target: Tabletop builder (/builder/tabletop/, src/components/builder/), after JSON panel, frame opacity, ports

## Design Health Score
| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Mode badges excellent; placing a part, Clear table, autosave say nothing |
| 2 | Match System / Real World | 3 | Real mm/ports/posts; "+x axis", "Yaw", "NA" leak to outsiders; ToF "1918.0 ps" |
| 3 | User Control and Freedom | 2 | Clear table / Load example instant, unannounced, overwrite the one autosave; undo lost on reload |
| 4 | Consistency and Standards | 2 | "Fiber collimator" vs fibre; amber coach marks in day theme; ps-only beam ToF vs ps/ns connections |
| 5 | Error Prevention | 2 | Destructive items one row from Export; Load example clobbers autosave |
| 6 | Recognition Rather Than Recall | 2 | All tools unlabelled 32px icons; shortcuts in hover titles and a 9.9px CHEAT SHEET tab |
| 7 | Flexibility and Efficiency | 3 | R/D/arrows, box select, JSON, AI brief; placing parts and beam stops pointer-only |
| 8 | Aesthetic and Minimalist Design | 3 | Scene leads; ~21 controls at rest; Guide pill outranks every tool |
| 9 | Error Recovery | 3 | JSON panel: line/column, Revert, "⌘Z undoes it" — model behaviour |
| 10 | Help and Documentation | 3 | Guide, cheat sheet, About limits strong; mobile teaches hover/⌘/⇧ |
| **Total** | | **26/40** | **Acceptable** |

## Design Specificity Verdict
Authored in the content, generic in the chrome. Bench models, mm semantics, ports and the honest About copy are QUOP's own; the HUD is the stock floating-island canvas editor. Table is a beige void with grid off by default, so it doesn't read as a breadboard.
Detector: CLI src/app/builder 0 findings; src/components/builder 38 design-system-color, all false positives (31 in test fixtures, 7 scene-data/connection-kind colours). globals.css builder section (2219-3917): 81 advisories — 35 off-ramp font sizes (0.62-0.74rem), 27 off-scale radii (0.55rem x13), 19 off-palette colours (#ffd99d x7...). Real drift: the builder runs its own compact scale DESIGN.md never records. Browser: 13 anti-patterns on every view (14 with JSON panel): undersized-ui-text on 9 part labels (10.56px, .builderLabel), CHEAT SHEET tab (9.92px, .builderSheetTab), controls hint (10.88px, .builderControlsHint); JSON textarea 11.84px borderline. Headless run — no user-visible overlay.

## Priority Issues
1. [P1] Clear table and Load example are unguarded, silent, and overwrite the only autosave (builder-scene.tsx:1292-1308; onClear has no announce). Fix: announce "Cleared the table. ⌘Z undoes it"; confirm when table non-empty or keep a previous-autosave slot; "Saved in this browser" note in file menu. → harden
2. [P1] The payoff is buried: Path length/ToF at field size mid-inspector, ToF always toFixed(1) ps (builder-inspector.tsx:749-754) while formatDelay (:824) exists. Fix: readout to top of beam inspector at Result scale, reuse formatDelay, ToF in beams box rows. → layout
3. [P1] Building is pointer-only: canvas has no tabindex/name; placement only on table click; stops only by clicking parts. Fix: Enter on tray item places at view centre and selects; focusable parts list; "Add stop" select in beam inspector. → harden/audit
4. [P2] HUD hierarchy inverted and text undersized: solid oxblood Guide pill loudest; centre cluster mixes 8 controls of 4 kinds; labels/hints/tab 9.9-10.9px, hint ~3.5:1. Fix: demote Guide after first use, move Undo/Redo, 12px floor, record builder compact scale in DESIGN.md, grid on by default. → typeset/layout
5. [P2] Mobile is shrunk desktop: overlapping labels at 390px, inspector sheet covers beams box, guide/hints teach hover/⌘/⇧. Fix: touch copy, collapse beams box with inspector open, declutter labels. → adapt

## Persona Red Flags
Power user: no key to place/add stop/open tray; undo lost on reload; one autosave slot.
First-timer: jargon in part hints; lens hint says "below" in the tray (types.ts:247); empty table after Clear has no next step; ".md" cryptic.
Keyboard/screen reader: scene invisible and unreachable; ~10px low-contrast hints; 32px targets. (status role, JSON panel, focus rings good.)
Labmate mid-experiment: length in beams box good; ToF needs click + scan, reads 1918.0 ps; no part-to-part distance; shared PC Load example wipes the table.

## Minor Observations
Fill opacity shows 4% for 3.5%; frame tool looks active after drawing; toast crowds view island; beam/frame palettes differ in order; hot pink in beam/frame palettes collides with dormant Builder coral; JSON one value per line is long.

## Questions to Consider
- If path length is the payoff, why isn't it on the table — leg lengths on canvas, running total at the beam's end?
- Should "describe the setup → JSON" be a first-class keyboard way to build rather than an escape hatch?
- Would a visible breadboard (M6 holes, scale bar) do more for both audiences than any copy?
