# Orbit, snap-back and a view cube on the builder's orthographic camera

Research for [#7](https://github.com/kakitkelvinho/quop/issues/7): which three.js / drei controls and helpers fit
orbiting an orthographic camera, animating back to preset poses, and a view cube, and how each fits the
Experiment Builder's own interaction model.

Date: 2026-09-24. No builder code was changed.

## Installed versions

All claims below were checked against the installed source in `node_modules`, not against docs for other versions.

| Package | Version | Where the relevant code lives |
| --- | --- | --- |
| `@react-three/drei` | 10.7.8 | `core/CameraControls.js`, `core/OrbitControls.js`, `core/MapControls.js`, `core/GizmoHelper.js`, `core/GizmoViewcube.js`, `core/Hud.js` |
| `camera-controls` | 3.1.2 | `dist/camera-controls.module.js`, `README.md` |
| `three-stdlib` | 2.36.1 | `controls/OrbitControls.js` (drei's `OrbitControls` and `MapControls` wrap this, not `three/examples/jsm`) |
| `three` | 0.186.0 | |
| `@react-three/fiber` | 9.7.0 | `dist/events-*.esm.js` (the frame loop) |
| `@react-three/postprocessing` | 3.1.2 | `dist/index.js` (`EffectComposer`) |

## What the builder does today

From `src/components/builder/builder-canvas.tsx` and `builder-scene.tsx`:

- `<Canvas orthographic frameloop="demand" camera={{ near: -4000, far: 8000, zoom: 1 }}>`.
- drei `<OrbitControls makeDefault enabled={!dragging} enableRotate={false} mouseButtons={{ LEFT: PAN, MIDDLE: DOLLY, RIGHT: PAN }} touches={{ ONE: PAN, TWO: DOLLY_PAN }} minZoom={0.2} maxZoom={14} />`.
- `CameraRig` teleports the camera to the iso pose `(1400, 1148, 1400)` or the top pose `(0, 1400, 0.001)`, projects the table's
  bounding box into camera space to solve for a fit zoom (leaving room for the HUD), writes `cam.zoom` directly, then calls
  `controls.target.set(0, 0, 0); controls.update()`.
- `TableSurface` treats a press that travelled more than `CLICK_SLOP_PX = 4` as a pan, not a click.
- Dragging a part sets `dragging`, which flips `enabled` on the controls mid-gesture; Shift during a part drag means fine grid snap.
- Post-processing: `<EffectComposer multisampling={4}>` with N8AO and Vignette; `gl.preserveDrawingBuffer: true` so the PNG export can read the canvas.
- `Backdrop` pins a gradient plane at `camera.far * 0.9` in front of the camera every frame, so it follows any camera orientation.

## Options

### A. drei `CameraControls` (wraps yomotsu `camera-controls` 3.1.2)

**Orbit on an orthographic camera: yes.** camera-controls detects the camera type. For an `OrthographicCamera` the default
wheel action is `ACTION.ZOOM` and the default two-finger touch is `TOUCH_ZOOM_TRUCK` (`camera-controls.module.js` ~L662-676);
the README says orthographic cameras take `ZOOM` and "can't set `DOLLY`" (`README.md` ~L230, L241). Azimuth is unbounded by default
(`minAzimuthAngle = -Infinity`, `maxAzimuthAngle = Infinity`, ~L381-393), so full 360° is the default. Limit the polar angle with
`maxPolarAngle` (e.g. just under `Math.PI / 2`) to keep the camera above the table.

**Snap back: first-class.** Every pose method takes `enableTransition` and returns a promise that resolves on `rest`:
`setLookAt(px, py, pz, tx, ty, tz, true)`, `rotateTo(azimuth, polar, true)`, `rotateAzimuthTo`, `rotatePolarTo`, `zoomTo(zoom, true)`,
`moveTo`, `reset(true)`, `saveState()` (~L1415, L1509, L1731, L2040, L2060). Transitions use critically damped `smoothDamp`
with `smoothTime = 0.25` s (`draggingSmoothTime = 0.125` s while dragging). `normalizeRotations()` (~L2019) wraps the azimuth into
(-180°, 180°] so a snap after several full turns doesn't unwind them.

**Pan that stays on the table plane.** `ACTION.TRUCK` moves the target in the camera's screen plane (it leaves `y = 0` in the iso
view). `ACTION.SCREEN_PAN` does a horizontal truck plus `forward()` along the ground (`_truckInternal` ~L2461, `forward` ~L1551),
so the target stays at `y = 0` and the orbit pivot stays on the table surface. The truck amount is computed from
`(right - left) / zoom`, so it tracks zoom correctly on an orthographic camera.

**Zoom to cursor on orthographic: supported.** `dollyToCursor = true` has a dedicated orthographic branch in `update()` (~L2200)
that moves the target toward the cursor while `camera.zoom` changes, then pulls it back along the view axis so the camera depth
doesn't drift. It unprojects at NDC depth `(near + far) / (near - far)`; with the builder's `near: -4000, far: 8000` that is a
valid depth (about -0.33), and the result is projected onto the view plane anyway, so the negative near is not a problem.
Worth a quick manual check anyway.

**Fits the demand frameloop.** drei calls `controls.update(delta)` in `useFrame(..., -1)` and calls `invalidate()` on
`controlstart`, `control`, `transitionstart`, `update` and `wake` (`drei/core/CameraControls.js`). A programmatic
`setLookAt(..., true)` dispatches `transitionstart` (`_createOnRestPromise` ~L2574), which starts frames, and each `update`
event requests the next one until the camera rests.

**`enabled={!dragging}` still works, and better.** The `enabled` setter calls `cancel()` when set to false, which ends any drag
the controls had started (~L1194-1208). drei passes `enabled` through as a primitive prop, so it hits the setter.

**Caveats (all from source):**

1. **The controls own `camera.zoom` and the camera pose.** `update()` writes `camera.zoom = this._zoom` whenever they differ
   (~L2229) and rewrites `camera.position` from its own spherical state followed by `camera.lookAt(target)` (~L2241). `CameraRig`'s
   `cam.position.set(...)` / `cam.zoom = ...` would be overwritten on the next frame. Drive it through the API instead:
   `setLookAt(...)` + `zoomTo(...)`. The object also has **no `target` property**, so `controls.target.set(0, 0, 0)` would
   throw; use `setTarget` / `setLookAt` / `getTarget(out)`.
2. **The fit must be computed for the destination pose.** `CameraRig` moves the camera first and then projects the table bounds.
   With a transition, compute the fit on a scratch matrix (build `Matrix4().lookAt(destPos, target, up)`, set its position, invert)
   and pass the resulting zoom to `zoomTo(z, true)` alongside `setLookAt(..., true)`. Don't use `fitToBox`: it rounds the
   azimuth and polar angles to the nearest 90° (`roundToStep(..., PI_HALF)`, ~L1628) and moves the target to the box centre,
   so it can't frame the iso view and lifts the pivot off `y = 0`. Its paddings are in world units, not HUD pixels.
3. **No modifier keys on drag.** camera-controls reads `event.ctrlKey` only for trackpad pinch on the wheel (~L826-830); pointer
   drags map buttons to actions via `mouseButtons` with no Shift/Alt handling. For "modifier + left-drag = orbit", swap
   `controls.mouseButtons.left` between `SCREEN_PAN` and `ROTATE` on `keydown`/`keyup` (it is read at drag start, ~L900-927).
   The right button is simpler: `mouseButtons.right = ROTATE`.
4. **Big first-frame delta after idle.** R3F computes `delta = state.clock.getDelta()` every frame (`fiber events-*.esm.js`
   ~L16154). In `frameloop="demand"`, the first frame after an idle period gets the whole idle time as `delta`, and `smoothDamp`
   with a large `deltaTime` lands almost on the end value, so a snap started after a pause may jump instead of animating.
   Mitigation to verify in a prototype: call `get().clock.getDelta()` (resets the clock) right before starting the transition.
5. **camera-controls v3 migration.** drei 10.5.0 moved to camera-controls v3 (noted on the drei docs page); older snippets
   online may use v2 names (`ACTION.OFFSET` semantics, `verticalDragToForward` became `SCREEN_PAN`, see ~L600-603).
6. Default mouse mapping is left = ROTATE, right = TRUCK; set it explicitly.

### B. drei `OrbitControls` (three-stdlib 2.36.1), what the builder uses now

**Orbit on an orthographic camera: yes.** Setting `enableRotate` and mapping a button to `MOUSE.ROTATE` is all it takes. Azimuth is
unbounded by default (`minAzimuthAngle = -Infinity`, `controls/OrbitControls.js` L36). Wheel zoom changes `camera.zoom` for
orthographic cameras, and `zoomToCursor` has an orthographic branch (L222-263).

**Modifier to orbit: built in.** When a button is mapped to `MOUSE.PAN`, Ctrl/Meta/Shift + drag rotates instead (L684-694), and the
reverse for `MOUSE.ROTATE`. So "left = pan, Shift/Ctrl/⌘ + left = orbit, right = orbit" is pure config. Shift is only used by the
builder while a part is dragged, when the controls are disabled, so there is no clash.

**Pan on the table plane.** `screenSpacePanning` defaults to `true` (L54, pans in the screen plane). drei's `MapControls` is
the same class with `screenSpacePanning = false`, `LEFT: PAN`, `RIGHT: ROTATE`, `touches.TWO: DOLLY_ROTATE` (L868-876), which is
nearly the requested mapping. `screenSpacePanning={false}` on `OrbitControls` gives the same pan.

**Snap back: not provided.** There is no transition API. You would write a `useFrame` tween: slerp the camera offset on the sphere
around `target` (shortest azimuth path), lerp `camera.zoom`, call `camera.updateProjectionMatrix()` and `controls.update()`,
and `invalidate()` each frame until done. You would also have to handle damping (drei turns `enableDamping` on by default; leftover
`sphericalDelta` can fight the tween) and cancel the tween if the user grabs the camera mid-way (`start` event).
`CameraRig` keeps working unchanged because this class does expose `target` and reads `camera.zoom` rather than owning it.

**Caveats:** the damping in three-stdlib is per update, not per second, so it doesn't have the idle-delta problem, but it
doesn't know about `delta` either. The `enabled` flag is checked in each pointer handler (L616, L630, L705...), which is what
the builder relies on today.

### C. `MapControls`

The same `OrbitControls` class with map defaults (see B). Fine as a starting config, same lack of transitions.

### D. `TrackballControls`, `ArcballControls`

Both rotate freely without a fixed up axis, so the table can roll or flip. That is wrong for a tabletop that should only spin
around the vertical axis and tilt between top and iso. Not recommended.

### E. View cube / gizmo: `GizmoHelper` + `GizmoViewcube` / `GizmoViewport`

How it renders (`drei/core/GizmoHelper.js`, `drei/core/Hud.js`):

- `GizmoHelper` wraps its children in `<Hud renderPriority>`: a portal into its own `Scene` with its own `OrthographicCamera`
  at `z = 200`, positioned in pixels by `alignment` and `margin`. Default `renderPriority = 1`.
- `Hud`'s `useFrame` at that priority: **if `renderPriority === 1` it first renders the default scene itself**
  (`gl.render(defaultScene, defaultCamera)` with `autoClear = true`), then `clearDepth()` and renders the HUD scene on top.
- `EffectComposer` also renders in `useFrame` with `renderPriority = 1` by default (`@react-three/postprocessing` `dist/index.js` L332, L392-406).
- So with both at 1, the scene is drawn twice and the order of the two subscribers decides whether you see the post-processed frame.
  **Use `<GizmoHelper renderPriority={2}>`** with the composer left at 1: the HUD then skips the default-scene render, clears depth
  and draws the cube over the composer's output. The drei docs page says the same in general terms ("use renderPriority to prevent
  the helper from disappearing if there is another useFrame(..., 1)", https://drei.docs.pmnd.rs/gizmos/gizmo-helper). The cube is
  then outside N8AO and Vignette, which is what you want.
- The portal's event layer gets `priority: renderPriority + 1`, so the cube is raycast before the main scene.

How the click animates the camera:

- The cube calls `tweenCamera(direction)`: it slerps `camera.quaternion` toward the face / edge / corner direction at
  `2π` rad/s (`turnRate`), writes `camera.position` and `camera.up` itself, and then calls `controls.setPosition(...)` (if the
  default controls are `CameraControls`, detected by `'getTarget' in controls`) or `controls.update(delta)` (for `OrbitControls`,
  detected by `'minPolarAngle' in controls`). For `OrbitControls` it restores `camera.up` at the end; **for `CameraControls` it
  does not**, and camera-controls' `update()` calls `camera.lookAt(target)` with whatever `camera.up` is, so the view can be left
  rolled after a cube click (from reading the code; confirm in a prototype).
- It doesn't touch `camera.zoom`, so it can't re-fit the table, and its radius is measured from a module-level origin vector
  rather than the actual target (`radius.current = mainCamera.position.distanceTo(target)`, where `target` is never assigned),
  which is only harmless while the target is the origin.
- Its step is `delta * turnRate`, so it has the same large-first-delta issue under `frameloop="demand"` as caveat A.4.

Taking over the click: `GizmoViewcube` accepts `onClick`, which **replaces** the built-in `tweenCamera` handler on the faces
(`props.onClick || handleClick`) and on every edge/corner (`onClick || handleClick`) (`drei/core/GizmoViewcube.js` L64-110). In
your own handler, `e.face.normal` gives the face direction and `e.object.position` the edge/corner direction; call
`e.stopPropagation()` yourself and drive the controls (`setLookAt(dir * r, target, true)` + fit `zoomTo`). `GizmoViewport`
accepts `onClick` the same way. `GizmoHelper` renders even with no controls; the gizmo's own orientation sync
(`gizmoRef.quaternion` from the inverse camera matrix) is independent of the tween.

Interaction caveats with the builder:

- The cube's meshes stop propagation only for `onClick` / pointer move / over / out, **not `onPointerDown` / `onPointerUp`**.
  `TableSurface` places parts on `onPointerUp`, so a click on the cube while it sits over the table could also count as a table click
  (drop an armed part or clear the selection). Wrap the gizmo children in a `<group onPointerDown={e => e.stopPropagation()}
  onPointerUp={e => e.stopPropagation()}>`, relying on R3F's rule that `stopPropagation` also blocks objects behind the hit.
- The controls listen on the DOM element, not through R3F, so a drag that starts on the cube still pans or orbits the camera.
  Usually harmless; if not, check `e.target` / the cube's screen rect in a capture-phase `pointerdown`.
- The PNG export reads the canvas (`preserveDrawingBuffer: true`), so the cube will appear in exports unless it is hidden for the
  export frame.

### F. A custom view cube in the HUD (DOM)

An HTML/CSS cube in the existing HUD (`builder-hud.tsx`), rotated from the camera's azimuth/polar each frame (or on the controls'
`update` event), avoids the render-priority and event-ordering issues entirely and matches the HUD's look. It costs more code
than E. The existing "Isometric / Top-down" buttons already cover the two snaps the user asked for; a cube only adds the other
faces and corners.

## Recommendation

1. **Switch to drei `CameraControls`.** It is the only option with orthographic-aware pan, zoom and zoom-to-cursor *and*
   built-in, interruptible, promise-returning transitions (`setLookAt` / `rotateTo` / `zoomTo` with `true`), and it already plays
   well with `frameloop="demand"` and `enabled={!dragging}`. With `OrbitControls` the snap-back tween would be hand-written.
2. **Configure it as:** `mouseButtons={{ left: ACTION.SCREEN_PAN, middle: ACTION.ZOOM, right: ACTION.ROTATE, wheel: ACTION.ZOOM }}`,
   `touches={{ one: ACTION.TOUCH_SCREEN_PAN, two: ACTION.TOUCH_ZOOM_ROTATE, three: ACTION.TOUCH_ZOOM_TRUCK }}`,
   `minZoom={0.2} maxZoom={14}`, `minPolarAngle={0}` and `maxPolarAngle` just under `Math.PI / 2`, azimuth left unbounded for full 360°,
   `dollyToCursor` optional. For "modifier + left = orbit", swap `mouseButtons.left` to `ROTATE` while Alt (or Shift) is held.
   Import `ACTION` via `CameraControlsImpl.ACTION` from drei.
3. **Rewrite `CameraRig` as "snap to pose":** compute the destination pose (iso: current or fixed azimuth, polar ~60° from vertical, which is today's `(1400, 1148, 1400)`; top:
   polar 0 with the current or zero azimuth), solve the fit zoom against that destination's view matrix, then
   `controls.normalizeRotations(); controls.setLookAt(..., true); controls.zoomTo(fit, true)`. Keep the target at `(0, 0, 0)`.
   Reset the R3F clock (`get().clock.getDelta()`) before starting, so the first frame's delta doesn't swallow the animation.
4. **Keep the existing Iso / Top buttons as the snap-back UI**, and treat the view cube as optional polish. If added, use
   `GizmoHelper renderPriority={2}` with `GizmoViewcube onClick={...}` routed to the same snap function (not drei's
   `tweenCamera`), plus a pointer-down/up `stopPropagation` wrapper, and hide it for PNG export.
5. **Prototype before committing** to confirm: the idle-delta jump (A.4), zoom-to-cursor with `near: -4000`, and that the Backdrop
   plane and N8AO look right at arbitrary azimuths.

If the team would rather not swap the controls, the minimal path is `OrbitControls` with `enableRotate`,
`screenSpacePanning={false}`, `RIGHT: MOUSE.ROTATE` (Ctrl/⌘/Shift + left orbits for free), and a hand-written `useFrame` tween in
`CameraRig`. It works, but you own the tween, damping interplay and interruption logic.

## Sources

- `node_modules/camera-controls/dist/camera-controls.module.js` and `node_modules/camera-controls/README.md` (v3.1.2); upstream https://github.com/yomotsu/camera-controls, orthographic example https://yomotsu.github.io/camera-controls/examples/orthographic.html
- `node_modules/@react-three/drei/core/{CameraControls,OrbitControls,MapControls,GizmoHelper,GizmoViewcube,GizmoViewport,Hud}.js` (v10.7.8)
- drei docs: https://drei.docs.pmnd.rs/controls/camera-controls, https://drei.docs.pmnd.rs/gizmos/gizmo-helper
- `node_modules/three-stdlib/controls/OrbitControls.js` (v2.36.1)
- `node_modules/@react-three/postprocessing/dist/index.js` (v3.1.2), `EffectComposer` `renderPriority`
- `node_modules/@react-three/fiber/dist/events-156d8d12.esm.js` (v9.7.0), frame-loop `update()`
- `src/components/builder/builder-canvas.tsx`, `src/components/builder/builder-scene.tsx`
