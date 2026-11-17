# Tabletop architecture: gap list (code at d21ed7f vs draft target)

The original comparison refers to a four-layer draft that is not in the repository. Treat the numbered list below as an inventory of the earlier proposal, not as an approved target. The decisions and edit-mode plan above it supersede answered gaps.

## Current and proposed map

| Module | Today | Proposed next change |
|---|---|---|
| `builder-scene.tsx` | Separate tool flags and drafts; owns clicks, keys and file actions. | One active edit mode and its draft; keep clicks, keys and file actions here. |
| `use-builder-scene.ts` | Setup edits, history and autosave. | Keep its current role. |
| `types.ts` and focused plain modules | Saved Setup, catalog, Beam and Group rules. | Keep their current roles for this change. |
| `builder-hud.tsx` and `builder-canvas.tsx` | Controls and 3D drawing, using flags passed by `builder-scene.tsx`. | Initially receive flags derived from the active mode. |

`builder-scene.tsx` calls the edit hook and renders the HUD and canvas; all of them read the plain Setup rules. The proposed change stays at the controller's editing-mode seam.

The immediate change is to transient editing state. It does not require a new layer, a new saved field, or a rewrite of the Setup model.

## Edit-mode plan (agreed direction, not implemented)

**Problem.** `builder-scene.tsx` stores Place, Beam, Connection, Frame, Add stops and Group picking in separate booleans or nullable drafts. Starting a tool clears several others by hand (`startFrame`, `startConnect`, `startBeam`, `startGroupMode`); Escape and pointer handlers check them in an order that must stay consistent. This is more substantial friction than the duplicated three-call settling sequence.

**One active tool.** Start with a tagged state in `builder-scene.tsx`; keep each tool's draft beside its tag. The shape below is illustrative, not a fixed TypeScript interface:

```text
idle
place        Component kind + optional block symbol
beam         stop IDs + chosen colour
connection   fibre/cable kind + optional first Component ID
frame        corners, pointer preview and rectangle draft
add-stops    selected Beam ID
group-pick   uses the separate current selection
```

Only one of these can exist at a time. A new tool replaces the previous tool and discards its unfinished draft. Keep selected Components/Beam/Frame/Connection, the Parts panel, panel arrangement, camera, view toggles and in-progress pointer drags outside this state. They are different concerns: for example, the Parts panel stays open after placing one Component, and Group picking uses the ordinary selection. Edit modes are transient browser state and never enter a saved Setup.

**Transitions.** Give tool entry and exit one place in the controller, then let the existing handlers perform their tool-specific work. The final two rows deliberately tighten current behavior and should be treated as behavior decisions during implementation:

| Event | Required result |
|---|---|
| Start Beam, Frame or Connection | Replace any active tool, clear incompatible selection, close the Parts panel, initialise that tool's draft. |
| Pick a Component kind in Parts | Enter Place; keep the Parts panel open so another kind can be picked after placing. |
| Place one Component | Commit it, select it, return to idle; keep the Parts panel open. |
| Start Group picking | Replace the active tool, close Parts, keep the current Component selection so it can become the group. |
| Start Add stops | Enter the mode for the selected Beam. Proposed change: selecting a different Beam or losing that Beam exits it; today reselecting the original Beam can revive the old mode. |
| Finish Beam/Frame/Connection/Group | Commit through existing setup-edit functions, then return to idle. Preserve each operation's current undo step. |
| Escape | Cancel Place before closing the Parts panel; otherwise close the panel or cancel the active tool, then clear selection only when neither applies. |
| Replace or clear Setup | Proposed change: return to idle and clear selection together, including Place, Add stops and Group picking. The current handlers do not clear every one of these flags. |

**Implementation order.** (1) Put the tagged state and entry/exit rules in `builder-scene.tsx`; derive the existing HUD/canvas flags from its tag so their interfaces need not change immediately. (2) Move Beam, Connection and Frame drafts into their matching cases. (3) Route pointer and keyboard branches by the tag. (4) Extract a separate pure edit-mode module only if the transition rules have enough behavior to make its interface smaller than the code it hides. Do not add an adapter just for a single React caller.

**Verification.** Test observable transitions that can regress: switching from a half-drawn Beam to Frame discards the Beam draft; Escape while placing with Parts open cancels placement first and closes Parts second; completing a Connection returns to idle. If the two proposed behavior changes are accepted during implementation, also test that Add stops ends when another Beam is selected and opening or clearing a Setup leaves no active tool. Existing Setup fixtures and snapshots must remain unchanged. No test should need to inspect an internal mode representation.

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
- Gap 7: connections stay flexible. Any two different components can be joined by a fibre or cable; a known jack gives the drawn route a physical starting point, and otherwise the route leaves the component's side. Do not add connector-based rejection.
- Gap 17: both `parseScene` and the edit hook already run `settleHosts` → `settlePeriscopes` → `settleAngles`. Only the sequence of calls is duplicated. Sharing it is a small cleanup, not a missing format invariant.
- Gap 13: keep the Periscope's two saved Components. Its lower and upper mirrors are distinct Beam stops at different heights; one saved Component with one Beam meeting point cannot preserve both while stops remain Component IDs.

## Areas still under consideration
- **Geometry and ports** (6, 8–9): keep the one beam meeting point separate from fibre/cable jacks. `model-dimensions.ts` is already a plain shared measurements module, not a presentation dependency; move the remaining literal reference offsets there. Whether the time tagger input or photon counter side should be saved is a separate decision. Do not require declared connector acceptance.
- **Component rules** (11–12, 14–15): some kind-specific behavior sits in central switches, but a `ports(settings)` and `settle()` interface for every kind may add complexity without useful behavior. Consider each case separately. A one-Component Periscope would also require changing the agreed Beam stop and meeting-point rules, so it is outside this plan.
- **Saved scene** (16): decide whether 3D-only stage-drawing fields belong in the file. The settle invariant already runs on both load and edit; its duplicated call sequence can be shared without changing the file format.
- **Nesting** (18): the existing relationships have different behavior. Check whether at least two need the same parent-and-relative-transform rule before adding a shared model.
- **Structure** (19–21): split `types.ts` by cohesive rules only where the resulting interfaces simplify its callers; groups and frames need separate design decisions.

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
7. **Resolved: connections stay flexible.** `connectionJack`, `FIBER_STUBS` and `stubTakesCable` locate known physical connectors for drawing. When none applies, `connection-path.tsx` draws a generic route from the component's side. The editor intentionally allows a connection between any two different components.
8. **Movable ports are picked at draw time and never stored:**
   - the time tagger's input comes from `towardZ`
   - the single-photon detector's SMA side comes from which side the other end is on
9. **Some reference offsets remain literal.** `model-dimensions.ts` has no runtime imports and already shares measurements between `types.ts`, `connection-jacks.ts` and the 3D models. The remaining `referenceX` literals in `types.ts` are kept in sync with models only by comments; move those measurements into the shared module.
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
17. **The settling call sequence is duplicated.** `parseScene` already runs `settleHosts` → `settlePeriscopes` → `settleAngles` when a setup opens, and `use-builder-scene.ts` runs the same sequence after edits. A shared operation would keep their order together; the underlying rules are already shared.

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

## Decisions still needed
- Should the time tagger input or single-photon detector side be saved, rather than picked from the other endpoint while drawing?
- Should 3D-only stage-drawing choices remain in the setup file?
- Do the existing nesting forms share enough behavior to justify a parent-and-relative-transform model?
