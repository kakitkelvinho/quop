# Tabletop architecture: gap list (code at d21ed7f vs draft target)

The target is the four layers plus the Beams, Ports, Parts and Nesting sections, with beams clarified. Read-only: this file is the deliverable, and nothing in the repo is edited.

## Already matches
- Layers 1–2 import no React, three.js or R3F (`types.ts`, `groups.ts`, `group-edits.ts`, `scene-text.ts`, `share-link.ts`, `merge-setup.ts`, `frame-*.ts`, `connection-jacks.ts`).
- The format is versioned with migrations and per-version fixtures (`SCENE_VERSION` 14, `parseScene`, ADR 0001).
- Beams never branch. A splitter's outputs are already separate beams that share stops and may overlap, and one part can carry many beams.
- Beam length and time of flight are computed and never saved (`beamLengthMm`, `lengthToPicoseconds`).
- Beams are separate from parts.

## Settled by the user (2026-11-17): not gaps, target amended
- Gap 1: beam stops stay part ids.
- Gap 2: beams and fibres/cables stay separate types, because beams carry geometry (angles, distances) and cables carry none.
- Gap 4: built-in paths (a laser's built-in path, a delay line's travel) stay numbers added to the path length; the beam doesn't go inside the part.
- Gap 5: beam order sets a shared mirror's angle, by design.
- Each part keeps one beam meeting point; ports describe directions only. That resolves the splitter question.
- Gap 3: derived angles stay saved in `rotation`.
- Gap 10: parts stay saved by their port (v10 rule). No migration.
- Gap 16: colours, hide/fade flags, beam width and label size are settings and stay in the file. Only 3D-only choices (`sampleStage`, `sampleStageLeft`, maybe `stageColor`) count as presentation.

## Gaps that remain (after the answers)
- **Ports** (6–9): declare ports per kind (name, facing, beam/cable, in/out, fixed/movable) and the one beam meeting point. Make fibre/cable acceptance declarative, and save the movable port choice (time tagger input, photon counter side). Port numbers move out of `model-dimensions.ts` into the definitions, and the 3D models read them.
- **Parts** (11–15): per-kind `ports(settings)` and `settle()` instead of type switches. `settle()` covers mirrors, detectors and the delay line too. The periscope becomes one part (needs a migration). The definition is split from the 3D display fields.
- **Saved scene** (16–17): move the 3D-only stage-drawing fields out of the file or into an engine block, and move the settle invariant out of the React hook into the format layer.
- **Nesting** (18): replace the four ad-hoc forms with parent + relative transform, or decide per form to keep it as a setting.
- **Structure** (19–21): split `types.ts`, name the presentation layer, and design groups and frames.

## Gaps

### Beams
1. **Stops are component ids, not port refs** (`Beam.path: string[]`). The beam doesn't say which port it uses: a splitter's reflected vs transmitted side, or a part's in vs out.
2. **Beams and cables are two unrelated types** (`Beam` vs `Connection`). The target makes both connections between ports (beam kind vs cable kind).
3. **Angles are saved.** `settleAngles` writes each derived yaw into the part's stored `rotation`. The target says angles are never saved but orientation is. Decide whether a self-orienting part saves a rotation at all (question 1).
4. **Beams reach inside parts in two places**, beyond the port they attach to:
   - `beamDelayMm` adds a delay line's minimum path and twice its stage travel
   - `beamInternalPathMm` adds a laser's built-in path

   In the target, the delay line's ports move with its setting. The laser's built-in path has no home.
5. **Angles follow beam order**: "the first beam in the list sets a mirror's angle" (`CONTEXT.md`), so reordering beams changes a part. That's allowed through `settle()`, but the target doesn't say which beam wins.

### Ports
6. **No port concept.** Each kind has one implicit reference point, `referenceX` on local x. It has no name, facing, kind, in/out or fixed/movable.
7. **Fibre/cable attachment is an imperative `switch`** (`connectionJack`) plus `FIBER_STUBS` and `stubTakesCable`. Nothing declares that a kind accepts a fibre, a cable or nothing, and I found no check that refuses a connection to a part without a connector.
8. **Movable ports are picked at draw time and never stored:**
   - the time tagger's input comes from `towardZ`
   - the single-photon detector's SMA side comes from which side the other end is on
9. **Port positions come from 3D model measurements.** `types.ts` and `connection-jacks.ts` import `model-dimensions.ts`, which the models draw from. That is a layer-2-on-presentation dependency, and some `referenceX` values are literals kept in sync only by comments. Ports should own the numbers, and the models should read them.
10. **Positions are saved by port, not by body** (since v10, `referencePoint` = `position`, `bodyCentre` subtracts the offset). The target saves the part's position and derives ports from it, so v10's move would be undone. That needs a migration and a decision (question 2).

### Parts
11. **There's no per-kind interface.** Behaviour is spread across a large `ComponentSpec` table plus central functions that branch on `type`:
    - `componentReferenceX` special-cases the delay line
    - `connectionJack` switches on kind
    - `derivedYaw` reads `spec.angle`

    The target is `ports(settings)` and `settle()` on each part.
12. **`settle()` covers more than the periscope today.** Mirror-like parts, detectors and the delay line also turn from their beams (`angle: "mirror" | "periscope" | "detector"`).
13. **The periscope is two components** (`periscope` + `periscope-top`, linked by `periscope` and `partOf`). `settlePeriscopes` keeps them stacked, and `withPeriscopePartners` makes them select as one. The target is one ordinary part whose ports depend on its rise. Files store two components, so this needs a migration.
14. **The delay line's port doesn't move with its setting.** One port stays at the front, and travel is added as length (gap 4).
15. **`ComponentSpec` mixes definition with 3D presentation.**
    - Definition: `fields`, `created`, `minHeight`/`fixedHeight`, `host`, `staged`, `partOf`, `angle`.
    - Presentation or UI: `tag`, `top`, `radius` (selection ring), `lit`, `mounted`, `aliases`.

### Saved scene: "only position, orientation and settings"
16. **The file also stores:**
    - presentation: colours, `hidden`/`faded`, beam `width`/`opacity`/`arrows`, `lightColor`/`lightHidden`, `stageColor`, sample `opacity`, `labelScale`, frame `fill`/`fillOpacity`
    - 3D-engine choices: `sampleStage`, `sampleStageLeft`

    Whether author colour and visibility count as settings is question 3.
17. **The settled state is saved but enforced by the engine.** `use-builder-scene.ts` runs `settleAngles(settlePeriscopes(settleHosts(…)))` after every edit. That invariant belongs in the format/parts layer, so every engine gets it.

### Nesting ("parent + relative transform")
18. **Four ad-hoc forms exist, and none stores a relative transform:**
    - `particle.host`: snapped to the host's centre by `settleHosts`, and captured by distance (`HOST_CAPTURE_MM`)
    - `periscope-top.periscope`: an absolute height on a shared post
    - `sampleStage`: the stage is an attribute, not a part
    - the delay-line carriage: a setting

    Each needs a migration to `parent` + transform, or an explicit decision to stay a setting.

### Structure and layers
19. **One 2,368-line `types.ts` holds the format, migrations, catalog, port geometry, scene edits and AI-brief helpers**, under the engine's folder. Engine/UI constants live there too: `handleSweep`, `FINE_ROTATION_STEP_DEG`, `HOST_CAPTURE_MM`, `BEAM_WIDTH_MM`, `FRAME_FILL_OPACITY`, `LABEL_SCALE_RANGE`.
20. **Presentation isn't a named layer.** It's spread over the kind→model map in `component-models.tsx`, `builder-icons.tsx`, `scene-theme.ts` and `connection-path.tsx`. `connection-jacks.ts` imports the 3D stub curves.
21. **Groups and frames are shipped** (v12 and v5) with rules in `groups.ts`, `frame-reshape.ts` and `types.ts`, but have no definition layer. They are still undesigned in the target.

## Open questions
1. Does a part that orients itself save its rotation (today yes), or is it derived on load?
2. Is a part saved by its body centre (target) or by its port (today, since v10)?
3. Are author colours and hide flags settings (they stay) or presentation (they move out of the file)?
4. Where does a laser's built-in path live once beams can't reach into parts?
