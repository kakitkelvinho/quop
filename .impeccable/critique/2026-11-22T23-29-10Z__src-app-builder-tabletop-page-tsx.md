---
target: builder A vs C (2001 CRT)
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/hok5/Code/quop/src/app/builder/tabletop/page.tsx"
target_fingerprint: "sha256:0bc30e0f5a1bb73bd903269014c0422caf71f520b3b1ca1647831f1702f0cba8"
target_path: /Users/hok5/Code/quop/src/app/builder/tabletop/page.tsx
timestamp: 2026-11-22T23-29-10Z
slug: src-app-builder-tabletop-page-tsx
---
Method: dual-agent (A: design review · B: detector + browser)
Target: builder Tabletop HUD, variant A (current) vs C (2001 CRT panels).

| # | Heuristic | A | C | Key issue (C) |
|---|---|---|---|---|
| 1 | Visibility of status | 3 | 2 | nominal 50% power bar painted alarm red |
| 2 | Match real world | 3 | 2 | λ/2 → Λ/2 uppercasing (fixed after review) |
| 3 | User control | 3 | 3 | same |
| 4 | Consistency | 4 | 2 | drops Station Blue; inverts day theme |
| 5 | Error prevention | 3 | 3 | same |
| 6 | Recognition | 3 | 2 | 10.5px Michroma caps; muted on scanlines |
| 7 | Flexibility | 3 | 3 | same |
| 8 | Minimalist | 4 | 2 | bezel ring + hairline + vignette + glow on every island |
| 9 | Error recovery | 3 | 2 | warning colour spent on normal state |
| 10 | Help | 3 | 2 | What's New in condensed glowing type |
| | Total | 32/40 | 22/40 | |

Priority issues (C): P1 alarm colour on nominal state, colliding with red-orange beams; P1 banned depth (box-shadow bezel L116-119, inset vignette, glow L162, drop-shadow L166); P2 legibility (6 elements at 10.54px, text-shadow glow x10); P3 (A) jargon "unpinned · 2", tiny icon strip under dock.
Detector: CLI 12 advisories (off-palette colours, font sizes) in prototype files; browser A 2 tiny-text, C 19 (dark-glow x10, undersized-ui-text x6, tiny-text x2, radial-spotlight-glow, repeating-stripes). Contrast all pass AA (muted 5.6:1).
Verdict: keep A as default; C as a package breaks the Flat Sheet and Day/Night Ink rules. If 2001 ships, as an opt-in theme with: no bezel/vignette/glow, accent reserved for real faults, Source Sans body + tabular readouts.
