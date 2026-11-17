# Prototype: one type per kind of component

Tried on a copy; the repo is untouched. `component-union-prototype.patch` beside this file applies cleanly (`git apply --check`).

## What changed

- `BuilderComponent` becomes one shape per kind (a discriminated union on `type`). A lens has `focalLength`; a mirror does not.
- Which fields each kind owns is read off `COMPONENT_SPECS[kind].fields`, so that list stays the one source.
- The old flat shape stays as `AnyComponentFields`, for the code that reads raw files field by field.
- `COMPONENT_MODELS` hands each kind's model its own narrowed component.

## What the compiler then flags

198 errors at first. 135 after the mechanical fixes above. Of those, 80 are in tests, which read fields straight off `scene.components[0]`. The 55 in app code:

| Count | What it is |
|---|---|
| 33 | `host` (particle → trap) and `periscope` (top mirror → lower mirror) read by group, merge and drag code that walks every component. `groups.ts` already reads them as one thing: `component.host ?? component.periscope`. |
| ~12 | Sub-panels and models typed `component: BuilderComponent` that only ever render for one or two kinds (light toggle, sample stage, block symbol). Narrow the prop type. |
| ~10 | The file reader and field table in `types.ts`, where `type` is not known yet. Expected at a parse boundary. |

## Findings

1. `host` and `periscope` are one relationship under two names: this component rides on that one. Make it one shared field (e.g. `mountedOn`) and the 33 go away.
2. No bug turned up: every per-kind read was already guarded at runtime by a flag or a type check. The union moves those guards into the compiler.
3. Adding a kind still needs edits in several files; the union does not fix that on its own.
