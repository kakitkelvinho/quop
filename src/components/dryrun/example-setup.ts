// The Dry Run's built-in example: a k-space (Fourier-plane) spectroscopy
// setup, as a Tabletop setup. A pulsed pump comes in from the side through a
// beam cube and the objective onto the sample; the leakage goes back through
// the objective and the cube, and two 200 mm lenses relay the objective's back
// focal plane onto the spectrometer's slit (4f). With a 20 mm objective the
// slit then reads 20 mm per radian of emission angle.

import { type BuilderSceneData, SCENE_VERSION, settleAngles } from "../builder/types.ts";

const H = 100;

export const EXAMPLE_SETUP_NAME = "Example: k-space spectroscopy";

export const EXAMPLE_SETUP: BuilderSceneData = settleAngles({
  version: SCENE_VERSION,
  components: [
    { id: "pump", type: "laser-source", position: [140, H, -250], rotation: -90, label: "Pulsed pump" },
    { id: "cube", type: "beam-splitter", position: [140, H, 0], rotation: 0, label: "Beam cube" },
    { id: "objective", type: "objective", position: [30, H, 0], rotation: 180, label: "Objective 10×" },
    { id: "sample", type: "sample", position: [0, H, 0], rotation: 0, label: "Microcavity" },
    { id: "lens-1", type: "lens", position: [250, H, 0], rotation: 0, lensShape: "biconvex", focalLength: 200, label: "L1 f 200" },
    { id: "lens-2", type: "lens", position: [650, H, 0], rotation: 0, lensShape: "biconvex", focalLength: 200, label: "L2 f 200" },
    { id: "spectrometer", type: "spectrometer", position: [850, H, 0], rotation: 0, label: "Spectrometer" },
  ],
  beams: [
    { id: "beam-pump", path: ["pump", "cube", "objective", "sample"], color: "#7c3aed", label: "Pump" },
    {
      id: "beam-leakage",
      path: ["sample", "objective", "cube", "lens-1", "lens-2", "spectrometer"],
      color: "#16a34a",
      label: "Leakage to spectrometer",
    },
  ],
  connections: [],
  frames: [],
  groups: [],
});
