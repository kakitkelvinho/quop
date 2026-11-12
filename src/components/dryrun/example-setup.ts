// The Dry Run's built-in example: the lab's k-space (Fourier-plane)
// spectroscopy setup of arXiv:2601.15080 (Methods), as a Tabletop setup. The
// pulsed pump comes in at 45° onto the sample; a 50× objective (f = 4 mm)
// collects the leakage, and a 4f pair (f 100 mm, then f 400 mm) relays its
// back focal plane onto the spectrometer's slit, magnified 4×. The objective
// is drawn 110 mm off the sample so the sample shows beside it: the Dry Run
// takes the sample to sit at the objective's focus whatever the drawn gap. The slit then
// reads 4 mm × 4 = 16 mm per radian of emission angle, so the EMCCD's 400 rows
// span about ±11°. The EMCCD sits on the spectrometer's side exit port.

import { type BuilderSceneData, SCENE_VERSION, settleAngles } from "../builder/types.ts";

const H = 100;
/** the objective's back focal plane to L1 is L1's focal length; the drawn gap adds the objective's 4 mm */
const OBJECTIVE = 110;
const L1 = OBJECTIVE + 4 + 100;
const L2 = L1 + 100 + 400;
const SLIT = L2 + 400;

export const EXAMPLE_SETUP_NAME = "Example: k-space spectroscopy";

export const EXAMPLE_SETUP: BuilderSceneData = settleAngles({
  version: SCENE_VERSION,
  components: [
    // 45° onto the sample, from behind the objective's side
    { id: "pump", type: "laser-source", position: [260, H, -260], rotation: -135, label: "Pump 449 nm, 50 fs" },
    { id: "sample", type: "sample", position: [0, H, 0], rotation: 0, label: "Microcavity" },
    { id: "objective", type: "objective", position: [OBJECTIVE, H, 0], rotation: 180, label: "Objective 50×, NA 0.6" },
    { id: "lens-1", type: "lens", position: [L1, H, 0], rotation: 0, lensShape: "biconvex", focalLength: 100, label: "L1 f 100" },
    { id: "lens-2", type: "lens", position: [L2, H, 0], rotation: 0, lensShape: "biconvex", focalLength: 400, label: "L2 f 400" },
    { id: "spectrometer", type: "spectrometer", position: [SLIT, H, 0], rotation: 0, label: "Imaging spectrometer" },
    { id: "camera", type: "camera", position: [SLIT + 62, H, 41], rotation: -90, label: "EMCCD camera" },
  ],
  beams: [
    { id: "beam-pump", path: ["pump", "sample"], color: "#3c64ff", label: "Pump" },
    {
      id: "beam-leakage",
      path: ["sample", "objective", "lens-1", "lens-2", "spectrometer"],
      color: "#2cc7b5",
      label: "Leakage to spectrometer",
    },
  ],
  connections: [],
  frames: [],
  groups: [],
});
