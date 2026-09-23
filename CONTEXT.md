# QUOP

The lab's public site and tools. This glossary covers the Experiment Builder, a
layout notebook for an optical table (see `BUILDER.md`).

## Experiment Builder

**Component**:
One piece of bench hardware placed on the table: a laser, a mirror mount, a lens, a detector.
_Avoid_: part, element, object

**Height**:
How far a component's optical centre sits above the breadboard, in mm. Each component has its own, set by the length of its post; the default is the standard beam height.
_Avoid_: z, elevation, lift, stretch

**Beam height**:
The default height, 75 mm, that a component gets when first placed. A convention for straight beams, not a constraint.
_Avoid_: optical axis

**Beam**:
An author-drawn, ordered path through components, recording where the light is meant to go. It is not a ray trace; a beam between two components at different heights slopes.
_Avoid_: ray, trace

**Path length**:
The 3D length of a beam through its components' optical centres, in mm; the basis of its time of flight.

**Beam line**:
The set of mounts serving one beam, marked by tinting those mounts the beam's colour.
