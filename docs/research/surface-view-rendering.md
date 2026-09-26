# Surface view: rendering and exporting large frames

Research for #51 (parent map #50). Vocabulary follows CONTEXT.md → Plotters: **Image view**, **Surface view**, **Slice**, **Slice plane**.

Versions checked: `three` 0.186.0, `@react-three/fiber` 9.7.0, `@react-three/drei` 10.7.8 (read from `node_modules`, which is the code that actually ships).

## Frame sizes in play

| Frame | Vertices (1 per pixel) | Triangles `2(w-1)(h-1)` | Position + normal (Float32) | Index (Uint32) |
|---|---|---|---|---|
| 51×51 ROI | 2,601 | 5,000 | 62 KB | 60 KB |
| 1600×200 dispersion | 320,000 | 634,002 | 7.7 MB | 7.6 MB |
| 1024×1024 | 1,048,576 | 2,093,058 | 25 MB | 25 MB |

(Arithmetic, not a source.) Every frame over 65,535 vertices needs a 32-bit index: three.js picks `Uint32BufferAttribute` automatically when any index is ≥ 65535 (`three/src/utils.js` `arrayNeedsUint32`, used by `BufferGeometry.setIndex`, `three/src/core/BufferGeometry.js:234`). WebGL 2 supports 32-bit indices natively, and three.js has required WebGL 2 since r163 (`three/src/renderers/WebGLRenderer.js:61,102`).

## 1. Geometry approach and colouring

### Options

**Displaced `PlaneGeometry`.** `PlaneGeometry(w, h, w-1, h-1)` builds an indexed grid with two triangles per cell (`three/src/geometries/PlaneGeometry.js:50-101`). You then write the pixel values into the z of its `position` attribute and call `computeVertexNormals()`. It works, but its vertex order (row 0 at +y, top first) and its extra `uv`/`normal` arrays are fixed by the class. You end up rewriting most of its data anyway.

**Custom indexed `BufferGeometry`.** You build the same grid yourself: `position` (x, y, value), an index, then `computeVertexNormals()`. You choose the row order to match the FITS/Image-view convention and can skip attributes you don't need. It's a pure function from `(Float32Array, width, height, step)` to arrays, so it can be unit-tested without WebGL. This matches how the Builder already builds geometry imperatively (`src/components/builder/builder-canvas.tsx`).

**Vertex-shader displacement from a data texture.** You draw a flat grid and sample the frame (an `R32F` `DataTexture`) in the vertex shader. WebGL 2 devices all expose vertex texture units: web3dsurvey reports ≥16 on effectively every device, with 8 as the lowest outlier on Firefox ([web3dsurvey MAX_VERTEX_TEXTURE_IMAGE_UNITS](https://web3dsurvey.com/webgl2/parameters/MAX_VERTEX_TEXTURE_IMAGE_UNITS)). MDN lists 4 as the floor all systems meet ([MDN WebGL best practices, "Understand system limits"](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)). Float textures can only be filtered linearly with `OES_texture_float_linear` ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/OES_texture_float_linear)), so the texture would use `NearestFilter`. That's what you want for pixel data anyway. The downsides:
- **Raycasting breaks.** `Mesh.raycast` tests the CPU-side `position` attribute (`three/src/objects/Mesh.js:238-410`), so it can't see heights added on the GPU. Hover would need its own heightfield ray-march.
- **Normals move to the shader.** Lighting needs finite-difference normals written in the shader.
- **Shader work.** You have to patch a built-in material (`onBeforeCompile`) or write a custom `ShaderMaterial`.

The usual reason to pick this option is changing heights without re-uploading data. We don't need that here: elevation is linear in value (map #50). So the **exaggeration slider can be `mesh.scale.z`**. three.js lights non-uniformly scaled meshes correctly through the normal matrix, which means no geometry rebuild and no shader.

### Colour: per-vertex RGB vs a 1D colormap texture

**Per-vertex colours** (`color` attribute, `vertexColors: true`) interpolate *RGB* across each triangle. With a multi-hue colormap (viridis, jet), the blend between two vertices isn't a colour on the map. That shows up as muddy bands on coarse (downsampled) meshes. Changing colormap or colour limits also means rewriting the whole attribute.

**A 1D colormap texture looked up by the scalar** interpolates the *value* and then looks it up, so every fragment lands on the map. No custom shader is needed:
- Give each vertex `uv = (normalisedValue, 0.5)`.
- Set the material's `map` to a 256×1 `DataTexture` of the colormap (`LinearFilter`, `ClampToEdgeWrapping`, `SRGBColorSpace`).
- Changing colormap swaps a texture. Changing colour limits rewrites only the 2-float `uv` attribute.

To keep colormap colours exact:
- Turn tone mapping off. r3f defaults to `ACESFilmicToneMapping` unless the Canvas is `flat` (`@react-three/fiber/dist/events-*.esm.js`, `gl.toneMapping = flat ? NoToneMapping : ACESFilmicToneMapping`). The Builder uses `NeutralToneMapping` (`builder-canvas.tsx:849`).
- Use an unlit material (`MeshBasicMaterial`), or a lit one at low light contrast, if shading is wanted to read the landscape's shape.

**Recommendation:**
- Build a **custom indexed `BufferGeometry`** in a pure, tested module: position (x, y, value), `computeVertexNormals`, uv.x = normalised value, 32-bit index.
- Colour it with a **1D colormap texture via `map`**.
- Use a `flat` Canvas (no tone mapping).
- Drive exaggeration through `mesh.scale.z`.
- Skip vertex-shader displacement. It costs raycasting and needs custom shaders, for a benefit this view doesn't use.

## 2. Vertex/triangle budget on a laptop integrated GPU

No primary source (three.js, r3f, Khronos, MDN) gives a triangle budget. The only first-party number is about **draw calls**: r3f says "Each mesh is a draw call … no more than 1000 as the very maximum, and optimally a few hundred or less" ([r3f Scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)). The Surface view is one mesh plus a few (slice plane, axes, text), so draw calls aren't a concern. The cost is vertex throughput, memory and CPU work per interaction.

What the sources do settle:
- **Render on demand.** With `frameloop="demand"`, r3f renders only when props change or `invalidate()` is called ([r3f Scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)). The Builder already does this (`builder-canvas.tsx:842`). A still landscape then costs nothing, and the budget only matters while orbiting.
- **r3f can lower quality while moving.** `performance.regress()` drops the pixel ratio (`dpr={[1, 2]}` as in the Builder) during interaction.
- **Memory is small** at 1600×200 (about 15 MB of buffers, table above). At 1024×1024 it's about 50 MB of GPU buffers, plus `computeVertexNormals` and geometry build on the main thread, which is a noticeable one-off stall.

Engineering judgement (to be confirmed by the prototype, #52/#53): a few hundred thousand triangles in one static, unlit or simply lit mesh is routine on current integrated GPUs. Two million is where laptops start dropping frames during orbit, and where main-thread build time (normals, index) passes 100 ms.

**Recommendation:**
- Target **≤ ~512×512 vertices (≈ 260k vertices / 520k triangles)** for the orbit mesh.
- Draw 51×51 and 1600×200 frames at **full resolution**. 1600×200 is 320k vertices, just over the target; measure it in the prototype and fall back to step 2 along x if orbit stutters.
- **Downsample 1024×1024 by 2** (512×512).
- Build the geometry off the React render path (in a `useMemo` over the frame, or a worker if the prototype shows a stall). Keep `frameloop="demand"` and `dpr={[1, 2]}`.

## 3. Downsampling methods and narrow peaks

For a block of k×k pixels reduced to one vertex (standard reasoning about the operators, no library-specific facts):

| Method | Narrow single-pixel peak | Noise floor | Cost |
|---|---|---|---|
| **Stride** (keep every k-th pixel) | Dropped completely unless it falls on the sampled grid. Aliases. | Unchanged | Cheapest |
| **Block mean** | Height cut by up to k² (a 1-pixel spike in a 2×2 block shows at ¼ height) | Smoothed, lowered | Cheap |
| **Block max** | Height kept, width grows to one block | Biased *upward* (max of noise) | Cheap |
| **Min/max-preserving** (per block, keep whichever of min/max is further from the block mean) | Peaks *and* dips kept at true height | Stays about right | Cheap (one pass) |

For this lab's data (narrow BEC peaks, spectral lines on a flat background), stride and mean both misrepresent exactly the features people look at. Block max keeps peaks but lifts the background. **Min/max-preserving** is the 2D equivalent of the M4/min-max decimation used for 1D line charts, and is the honest default.

**Full resolution for the top-down preset: yes, cheaply.** The Image view already renders the whole frame into an offscreen source canvas with the colormap applied (`sourceCanvasRef` in `src/components/plotters/fits-image-viewer.tsx:552`). The Surface view can reuse that canvas as a `CanvasTexture` with `NearestFilter` on the landscape. Colour then comes from the full-resolution image while elevation comes from the (maybe downsampled) mesh. Seen from above, the landscape looks exactly like the Image view whatever the mesh resolution. This replaces the uv-lookup colouring from section 1 when the mesh is downsampled. Use one or the other per mesh, not both.

**Recommendation:**
- Make the downsampler a pure function with **min/max-preserving block reduction**. Apply it only when a side exceeds the budget.
- Colour the mesh from the **full-resolution colormapped image texture** whenever it's downsampled, so the top-down preset shows every pixel.
- Say so in the UI ("mesh shown at 1/2 resolution").

## 4. Hover readout on a large mesh

**What raycasting costs.** r3f raycasts on each `pointermove` against every object that has pointer handlers, and uses `raycaster.intersectObject(obj, true)`, which collects and sorts *all* hits rather than the first (`@react-three/fiber/dist/events-*.esm.js:586-641, 16281`). `Mesh.raycast` does a bounding-sphere and bounding-box early-out, then **tests every triangle** in a loop (`three/src/objects/Mesh.js:238-410`). That's O(triangles) per mouse move: 634k tests at 1600×200 and 2.1M at 1024². This is the one place a large mesh hurts even with render-on-demand. Tip: the Builder already opts decorative meshes out with `raycast={() => {}}` / `NO_RAYCAST` (`builder-canvas.tsx:562`, `component-models.tsx:855`).

**Options, cheapest first:**
1. **Accelerated raycast.** drei's `<Bvh>` wraps `three-mesh-bvh` (already installed as a drei dependency, `drei/package.json`). It builds a bounds tree once and swaps in `acceleratedRaycast`, with a `firstHitOnly` option (`drei/core/Bvh.js`). Hit cost becomes about O(log n) after a one-off build on the main thread. The tree has to be rebuilt when the geometry changes (new frame or downsample step), but not for `scale.z` exaggeration, because the ray is transformed into local space.
2. **Analytic grid lookup from the hit point.** Whatever finds the hit, turn it into a pixel without searching: in local space, `col = round(point.x / dx)` and `row = round(point.y / dy)` (scaled by the downsample step), then read `frame[row*width + col]`. The readout then shows the **true full-resolution value** under the cursor even on a downsampled mesh. `faceIndex >> 1` gives the cell directly too.
3. **Heightfield ray-march (DDA over the grid).** Walk the ray across grid cells and stop where it crosses the surface. That's O(w + h) per move with no build step and no dependence on the mesh. It's more code to own, and only worth it if BVH build time turns out to be a problem.

**Recommendation:**
- Put `onPointerMove` only on the landscape mesh, wrapped in drei **`<Bvh firstHitOnly>`**.
- Map the hit point to a pixel **analytically** and read the value from the original `Float32Array`, not from the mesh.
- Mark every other mesh (slice plane, axes, text) `raycast={() => {}}`.

## 5. PNG export from an r3f canvas, composed with the HTML title and colorbar

**Facts:**
- With the default `preserveDrawingBuffer: false`, the drawing buffer is cleared after compositing. Reading it after the render call has returned (`toDataURL`, `readPixels`, `drawImage`) is undefined ([Khronos WebGL spec §2.2 "The Drawing Buffer"](https://registry.khronos.org/webgl/specs/latest/1.0/#2.2)).
- The spec warns that `preserveDrawingBuffer: true` "can cause significant performance loss on some platforms" and recommends reading synchronously instead ([same section](https://registry.khronos.org/webgl/specs/latest/1.0/#2.2); attribute described on [MDN getContext](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext)).
- The Builder currently sets `preserveDrawingBuffer: true` and calls `canvas.toDataURL` from a button (`builder-canvas.tsx:848`, `builder-scene.tsx:333-345`).
- r3f's `invalidate()` only *requests* a frame; it doesn't render immediately ([r3f Scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)). So "invalidate then read" is racy under `frameloop="demand"`.
- drei `<Html>` renders real DOM nodes over the canvas (`drei/web/Html.js`), so **nothing drawn with `Html` shows up in a WebGL snapshot**.
- The Image view already exports by compositing onto a 2D canvas at `scaleFactor = max(3, ceil(devicePixelRatio))`, drawing the image plus title, axis labels and colorbar from their DOM rects (`fits-image-viewer.tsx:717-800+`, `handleSave`).

**Approach:**
1. Get `gl`, `scene` and `camera` from `useThree`, and expose a `snapshot()` through a handle, like `CanvasHandle` in the Builder.
2. In `snapshot()`:
   1. Optionally `gl.setPixelRatio(scaleFactor)` and `gl.setSize(...)` to match the Image view's ≥3× export.
   2. Call `gl.render(scene, camera)`.
   3. **In the same task**, `drawImage(gl.domElement, …)` into the export canvas.
   4. Restore the pixel ratio and size, then `invalidate()`.

   This is the "synchronous access" the spec recommends, and it works without `preserveDrawingBuffer`. The alternative is rendering into a `WebGLRenderTarget` and calling `gl.readRenderTargetPixels` (`three/src/renderers/WebGLRenderer.js:3132`), which needs a y-flip. The direct-render route is simpler.
3. Reuse the Image view's composition code for the title, axis labels and colorbar. The Surface view only swaps what goes into the plot rectangle. That argues for pulling the composition out of `handleSave` into a function that takes "draw the plot area" as a parameter (a seam for the "Seam in the shared viewer" fog item).

**Recommendation:**
- Keep `preserveDrawingBuffer` **false**.
- Export by rendering once synchronously inside the click handler (at the export pixel ratio) and `drawImage` the WebGL canvas into the existing 2D composition used by the Image view's `handleSave`.
- Keep the title and colorbar as HTML/2D-canvas chrome, never `Html`-in-scene.

## 6. 3D axis ticks and labels: drei `Text`, `Html`, `Billboard`

**drei `<Text>`** is troika-three-text: SDF glyphs rendered *in the WebGL scene* (`drei/core/Text.js` imports `troika-three-text`).
- **It shows up in the PNG export.** It depth-tests against the landscape and stays crisp at any zoom.
- Layout and SDF generation run in a **web worker, asynchronously**, so text isn't visible on the first frame and you "have to listen for completion" (`onSync`) ([troika-three-text README](https://github.com/protectwise/troika/tree/main/packages/troika-three-text), local copy in `node_modules/troika-three-text/README.md`).
- **Fonts:** it takes `.ttf/.otf/.woff`, and **`.woff2` is not supported** (same README). The plotter's local font is `src/components/plotters/fonts/cmu-serif-500-roman.woff2`, so a `.woff` or `.ttf` copy would be needed.
- **Default font fetches from a CDN.** With no `font` prop, troika falls back to fonts resolved from `cdn.jsdelivr.net` at runtime (`troika-three-text.esm.js`, `unicode-font-resolver` default data URL). So always pass a local font URL.
- **Cost:** each `Text` is a mesh and a draw call, so ~30 tick labels means ~30 draw calls, well within r3f's "few hundred" guidance. Glyph atlases are shared per font.

**drei `<Html>`** renders DOM elements positioned over the canvas.
- Crisp CSS text in the page font with no font conversion, but **not in the WebGL export** (see section 5).
- Each instance has its own `useFrame` that projects its position and writes styles.
- `occlude` hides labels behind the mesh, but it raycasts against the occluder, which is the expensive large-mesh raycast from section 4 (`drei/web/Html.js:25-31`).
- The Builder's comments record two pitfalls: `distanceFactor` inflates under an orthographic camera, and the wrapper swallows pointer events unless styled (`component-models.tsx:1110-1123`).

**drei `<Billboard>`** is a group that turns its children to face the camera every frame. It's useful around `Text` so tick labels stay readable while orbiting, at the cost of one quaternion copy per label per frame (only when rendering).

**Recommendation:**
- Draw **ticks as `lineSegments`** (one geometry for all ticks, one draw call) and **tick labels as drei `Text` inside `Billboard`**, using a local `.woff`/`.ttf` font. They then appear in the PNG export and depth-sort correctly.
- Put **axis titles** (x/y/value) in 3D `Text` as well.
- Keep the chart **title and colorbar as the existing HTML chrome** composed by the export code.
- Before calling `snapshot()`, wait for every `Text` to report `onSync` (or render twice), so labels aren't missing from the PNG.
- Avoid `Html` with `occlude` on the landscape.

## Summary of recommendations

1. **Geometry:** a custom indexed `BufferGeometry` from a pure, tested builder. Elevation is value, exaggeration is `mesh.scale.z`, and there's no vertex-shader displacement. Colour with a 1D colormap texture looked up by value (uv.x) on a `flat` (no tone mapping) Canvas.
2. **Budget:** about 260k vertices / 520k triangles for the orbit mesh. 51×51 and 1600×200 at full resolution (measure 1600×200 in the prototype), 1024² downsampled by 2. `frameloop="demand"`, `dpr={[1,2]}`.
3. **Downsampling:** min/max-preserving block reduction, only above budget. When downsampled, colour from the full-resolution colormapped image texture, so the top-down preset shows every pixel.
4. **Hover:** drei `<Bvh firstHitOnly>` on the landscape only, then map the hit point analytically to a pixel and read the original data. `raycast={() => {}}` on everything else.
5. **PNG export:** `preserveDrawingBuffer: false`; render synchronously at export pixel ratio, then `drawImage` into the Image view's existing 2D composition, pulled out of `handleSave` into a shared function.
6. **Axes:** `lineSegments` ticks plus drei `Text` in `Billboard` with a local `.woff`/`.ttf` font (no woff2, no CDN default). Title and colorbar stay HTML. Wait for `onSync` before exporting.

## Sources

- three.js 0.186.0 source in `node_modules/three/src`: `geometries/PlaneGeometry.js`, `core/BufferGeometry.js`, `utils.js`, `objects/Mesh.js`, `renderers/WebGLRenderer.js`, `renderers/webgl/WebGLCapabilities.js`
- @react-three/fiber 9.7.0 `dist/events-*.esm.js` (event raycasting, tone-mapping default); [r3f docs: Scaling performance](https://r3f.docs.pmnd.rs/advanced/scaling-performance)
- @react-three/drei 10.7.8: `core/Text.js`, `core/Bvh.js`, `core/Billboard.js`, `web/Html.js`, `package.json`; troika-three-text README and dist
- [Khronos WebGL 1.0 spec §2.2 The Drawing Buffer](https://registry.khronos.org/webgl/specs/latest/1.0/#2.2)
- [MDN: WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices), [MDN: getContext](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/getContext), [MDN: OES_texture_float_linear](https://developer.mozilla.org/en-US/docs/Web/API/OES_texture_float_linear)
- [web3dsurvey: MAX_VERTEX_TEXTURE_IMAGE_UNITS](https://web3dsurvey.com/webgl2/parameters/MAX_VERTEX_TEXTURE_IMAGE_UNITS) (device survey data, not a spec)
- Local code: `src/components/builder/builder-canvas.tsx`, `builder-scene.tsx`, `component-models.tsx`; `src/components/plotters/fits-image-viewer.tsx`
