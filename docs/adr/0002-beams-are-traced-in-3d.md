# Beams are traced from component surfaces in 3D

_Status: accepted._

Beams are traced in 3D from Component surfaces rather than drawn only from ordered Component lists. The author says where a Mirror sends the light; the Tabletop works out its orientation and follows the light. Tracing catches a Beam that misses a Mirror or arrives at the wrong height and gives every Component kind one shared description of what it does to light. Saved Beam paths remain to record intent and style branches; paths that disagree with the trace stay visible for editing.

## What a component is

- A body, plus a list of **surfaces**. Each surface has a position and normal on the component, an aperture (circular or rectangular), and a rule that turns one incoming beam into zero, one or two outgoing beams: zero is blocked, one passes or reflects, two splits.
- The rule is a pure function: its result depends only on the incoming beam and the surface's own settings, and it changes nothing else. This is what lets the whole trace be rerun on every frame of a drag, cached, and moved off the main thread.

## What a beam is

- Tracing starts at each laser source and follows the light surface by surface. The result is a **beam tree**: the laser's output is the trunk, and each beam cube adds a branch.
- Colour, label and hidden belong to a branch and pass down to everything after it, until a later branch sets its own.
- Path length is measured along the traced tree, plus a laser's built-in path and a delay line's delay as now.

## Orientation is a quaternion

- A component's orientation becomes a unit quaternion $q$, replacing the single yaw angle. A direction $v$ on the component turns to $v' = q\,v\,q^{*}$.
- Yaw and pitch angles were the alternative, but they lose a degree of freedom when a part points straight up or down (gimbal lock), and a beam sent vertically into an objective is an ordinary setup. Three.js already holds every object's rotation as a quaternion.
- Files store it as `[x, y, z, w]` with $w \ge 0$. $q$ and $-q$ are the same rotation; picking one keeps a file saved twice byte-identical.
- The inspector shows and edits yaw, pitch and roll. People never type quaternions.

## Mirrors aim at components

- A mirror stores the component it sends light to. Its normal follows from where its neighbours are, $\hat n \propto \hat d_\text{out} - \hat d_\text{in}$, with $\hat d_\text{in}$ pointing from the component before it and $\hat d_\text{out}$ toward the one it aims at, so both its yaw and its pitch come out of the aim. The trace only checks the result.
- Every component still saves its orientation. An aim updates it whenever both neighbours are known; otherwise it keeps its last value, so a half-laid-out setup behaves as before (see #369).
- A **periscope** becomes two ordinary mirrors, each tilted by its aim; the `periscope` and `periscope-top` kinds and their shared-post link go. The **delay line** stays one component with a pass-through surface (see #360).

## The surfaces obey the laws of optics

Each kind's rule is checked by throwing many random beams at it and asserting the law it must obey (property-based tests):

- reflection: $\hat d' = \hat d - 2(\hat d \cdot \hat n)\,\hat n$
- ray matrices: $AD - BC = n_1 / n_2$, which is $1$ in air
- splitting: $R + T = 1$ when lossless
- lossless polarisation optics: $J^\dagger J = I$
- every rule is the same run backwards, except the Faraday isolator's
- every stored quaternion has $|q| = 1$

## Consequences

- ADR 0001 holds: this is a schema version bump with a migration, and old files are never rejected. The migration turns a yaw into a quaternion about the vertical, turns each drawn beam's stops into mirror aims, merges drawn beams that share a start into one tree with branches (each keeping its colour), and turns periscope pairs into two aimed mirrors.
- Where the trace and a drawn beam disagree, the drawn beam is kept as a hand-drawn beam and the builder says the file was upgraded. Nothing is dropped. A fixture from schema 16 must open with every component and beam intact, as now.
- The setup brief describes aims rather than angles, and accepts a plain `yaw` in degrees in place of a quaternion, since an assistant writing quaternions by hand will get them wrong.
- `host` and `periscope` were already one relationship ("this component rides on that one"); with the periscope kinds gone, `host` is the only one left.
