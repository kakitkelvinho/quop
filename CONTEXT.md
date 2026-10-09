# QUOP

The lab's public site and tools. This glossary covers the Experiment Builder, a
notebook for sketching setups on an optical table (see `BUILDER.md`), and the
plotters.

## Experiment Builder

**Table**:
The working plane components stand on: the breadboard's surface, at height 0. It has no edges; a setup is as large as its components make it.
_Avoid_: board, bench, grid

**Setup**:
Everything placed on the table, its components and beams, as saved to or opened from a setup file. A setup file saved by any release from 1.0 on keeps opening, with nothing dropped, in every later release.
_Avoid_: layout, scene, project

**Component**:
One piece of bench hardware placed on the table: a laser, a mirror, a lens, a detector.
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

**Connection**:
A fibre (optical) or a cable (electrical, such as coax) from one component to another, drawn as a tube lying on the table. It is not a beam: it adds nothing to any path length, and no mirror or detector takes its angle from it. Its delay comes from the length the author types, never from the drawn route.
_Avoid_: link, wire, patch cord, fibre beam

**Beam cube**:
A cube that divides a beam in two, at the reflective plane across its diagonal. Polarizing and non-polarizing cubes look the same on a bench, so they are one kind of component; which one it is goes in its label.
_Avoid_: beam splitter, PBS, PBS cube, beamsplitter plate

**Mode**:
The light standing inside a cavity, drawn as a Gaussian envelope between its mirrors. Part of the cavity, not a beam: it is not drawn by the author and adds nothing to any path length.
_Avoid_: cavity beam

**Host**:
A trap or cavity that a particle has been placed in. A particle with a host sits at the host's centre and moves with it.
_Avoid_: parent, container

## Plotters

**Image view**:
A 2D frame drawn flat, each pixel's value shown as a colour from a colormap.
_Avoid_: heatmap, 2D view, colormap view

**Surface view**:
A 2D frame drawn as a landscape in 3D: pixel position across the ground, pixel value as elevation, coloured with the same colormap as the Image view.
_Avoid_: 3D view, height map, mesh plot

**Row 0**:
The first row stored in a FITS file. Both views draw it at the bottom, as DS9 and astropy's `origin='lower'` do, so a frame comes out the same way up as in those tools. The pointer readout, the Slice and the ticks use the file's numbers: the bottom row reads y = 0.
_Avoid_: top row, first line

**Slice**:
One row or one column of a frame, plotted as a 1D profile.
_Avoid_: cut, line-out, cross-section

**Slice plane**:
The thin upright rectangle in the Surface view that marks where the current slice cuts through the landscape.
_Avoid_: cutting plane, slice marker

**Pixel aspect**:
How tall one pixel is drawn relative to its width, shared by the Image view and the Surface view. 1 is true pixels; the frame's width ÷ height draws the whole frame as a square.
_Avoid_: aspect ratio (ambiguous: the frame's or the pixel's), footprint, stretch

**Full header**:
Every card of a FITS header, in file order, with its keyword, value and comment.
_Avoid_: metadata, raw header
