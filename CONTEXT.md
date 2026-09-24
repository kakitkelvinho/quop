# QUOP

The lab's public site and tools. This glossary covers the Experiment Builder, a
layout notebook for an optical table (see `BUILDER.md`).

## Experiment Builder

**Table**:
The working plane components stand on: the breadboard's surface, at height 0. It has no edges; a layout is as large as its components make it.
_Avoid_: board, bench, grid

**Component**:
One piece of bench hardware placed on the table: a laser, a mirror mount, a lens, a detector.
_Avoid_: part, element, object

**Height**:
How far a component's optical centre sits above the breadboard, in mm. Each component has its own; for a component on a post, the post's length sets it, and a floating component simply sits there. The default is the standard beam height.
_Avoid_: z, elevation, lift, stretch

**Beam height**:
The default height, 100 mm, that a component gets when first placed: the height the lab's posts are cut for. A convention for straight beams, not a constraint.
_Avoid_: optical axis

**Beam**:
An author-drawn, ordered path through components, recording where the light is meant to go. It is not a ray trace; a beam between two components at different heights slopes.
_Avoid_: ray, trace

**Path length**:
The 3D length of a beam through its components' optical centres, in mm; the basis of its time of flight.

**Beam line**:
The set of mounts serving one beam, marked by tinting those mounts the beam's colour.

**Beam splitter**:
A cube that divides a beam in two. Polarizing and non-polarizing cubes look the same on a bench, so they are one kind of component; which one it is goes in its label.
_Avoid_: PBS, PBS cube, beamsplitter plate

**Mode**:
The light standing inside a cavity, drawn as a Gaussian envelope between its mirrors. Part of the cavity, not a beam: it is not drawn by the author and adds nothing to any path length.
_Avoid_: cavity beam

**Host**:
A trap or cavity that a particle has been placed in. A particle with a host sits at the host's centre and moves with it.
_Avoid_: parent, container
