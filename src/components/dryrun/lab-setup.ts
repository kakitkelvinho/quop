// The lab's own bench, the default setup of the Dry Run: the Master Setup
// group of the owner's Tabletop share link, with only the OPA pump beam kept
// (the Astrella probe beams and the Reflection/Transmission group removed).
// One change from the Tabletop file: the collection beam "4f" starts at the
// sample rather than the objective, so the Dry Run can follow the leakage
// from the sample, through the objective and the f 300 → f 150 relay, to the
// spectrometer's slit (a Fourier plane, about 0.7 mm off).

import { type BuilderSceneData, parseScene } from "../builder/types.ts";

export const LAB_SETUP_NAME = "Lab: Master Setup";
/** The collection beam, sample to spectrometer. */
export const LAB_BEAM = "beam-vge22l";

const RAW = {
  "version": 13,
  "components": [
    {
      "id": "spectrometer-asnnrt",
      "type": "spectrometer",
      "position": [
        0,
        150,
        0
      ],
      "rotation": 90
    },
    {
      "id": "lens-96e5rg",
      "type": "lens",
      "position": [
        -200,
        150,
        400
      ],
      "rotation": 180,
      "lensShape": "plano-convex",
      "focalLength": 300
    },
    {
      "id": "objective-2m7cxa",
      "type": "objective",
      "position": [
        -375,
        150,
        420
      ],
      "rotation": 135
    },
    {
      "id": "mirror-mount-fvvyd0",
      "type": "mirror-mount",
      "position": [
        0,
        150,
        400
      ],
      "rotation": 135,
      "color": "#1e8a39",
      "label": "M3"
    },
    {
      "id": "lens-dopaoy",
      "type": "lens",
      "position": [
        0,
        150,
        150
      ],
      "rotation": 90,
      "lensShape": "plano-convex",
      "focalLength": 150
    },
    {
      "id": "mirror-mount-8dozf9",
      "type": "mirror-mount",
      "position": [
        -300,
        150,
        495
      ],
      "rotation": 112.5,
      "color": "#1e8a39",
      "label": "M1"
    },
    {
      "id": "mirror-mount-yezxos",
      "type": "mirror-mount",
      "position": [
        -300,
        150,
        400
      ],
      "rotation": 315,
      "color": "#1e8a39",
      "label": "M2"
    },
    {
      "id": "laser-source-eip37t",
      "type": "laser-source",
      "position": [
        -575,
        150,
        25
      ],
      "rotation": 270,
      "label": "OPA",
      "internalPathMm": 3000
    },
    {
      "id": "mirror-mount-9educx",
      "type": "mirror-mount",
      "position": [
        -750,
        150,
        425
      ],
      "rotation": 45,
      "color": "#8b1e3f"
    },
    {
      "id": "mirror-mount-s1n7nl",
      "type": "mirror-mount",
      "position": [
        -575,
        150,
        350
      ],
      "rotation": 40.27,
      "color": "#781e8a"
    },
    {
      "id": "beam-splitter-i2w5av",
      "type": "beam-splitter",
      "position": [
        -575,
        150,
        175
      ],
      "rotation": 0
    },
    {
      "id": "sample-tvsr93",
      "type": "sample",
      "position": [
        -425,
        150,
        375
      ],
      "rotation": 315,
      "sampleStage": "side",
      "sampleStageLeft": true
    },
    {
      "id": "mirror-mount-uib9qz",
      "type": "mirror-mount",
      "position": [
        -650,
        150,
        425
      ],
      "rotation": 135,
      "color": "#8b1e3f"
    },
    {
      "id": "waveplate-garsyq",
      "type": "waveplate",
      "position": [
        -575,
        150,
        100
      ],
      "rotation": 90
    },
    {
      "id": "mirror-mount-q8acy6",
      "type": "mirror-mount",
      "position": [
        -650,
        150,
        250
      ],
      "rotation": 315,
      "color": "#8b1e3f"
    },
    {
      "id": "mirror-mount-cdvbvm",
      "type": "mirror-mount",
      "position": [
        -425,
        150,
        250
      ],
      "rotation": 225,
      "color": "#8b1e3f"
    },
    {
      "id": "laser-source-x5gt7h",
      "type": "laser-source",
      "position": [
        -750,
        150,
        25
      ],
      "rotation": 270,
      "label": "Astrella",
      "internalPathMm": 2515
    },
    {
      "id": "lens-24yqto",
      "type": "lens",
      "position": [
        -425,
        150,
        300
      ],
      "rotation": 90,
      "lensShape": "plano-convex",
      "focalLength": 100
    }
  ],
  "beams": [
    {
      "id": "beam-vge22l",
      "path": [
        "sample-tvsr93",
        "objective-2m7cxa",
        "mirror-mount-8dozf9",
        "mirror-mount-yezxos",
        "lens-96e5rg",
        "mirror-mount-fvvyd0",
        "lens-dopaoy",
        "spectrometer-asnnrt"
      ],
      "color": "#7c3aed",
      "label": "4f"
    },
    {
      "id": "beam-0bobiw",
      "path": [
        "objective-2m7cxa",
        "mirror-mount-8dozf9",
        "mirror-mount-yezxos",
        "lens-96e5rg"
      ],
      "color": "#ea580c",
      "label": "f1"
    },
    {
      "id": "beam-9tm51n",
      "path": [
        "lens-96e5rg",
        "mirror-mount-fvvyd0",
        "lens-dopaoy"
      ],
      "color": "#16a34a",
      "label": "f1+f2"
    },
    {
      "id": "beam-gzgtu9",
      "path": [
        "laser-source-eip37t",
        "waveplate-garsyq",
        "beam-splitter-i2w5av",
        "mirror-mount-s1n7nl",
        "sample-tvsr93"
      ],
      "color": "#0891b2",
      "label": "Pump"
    },
    {
      "id": "beam-e4wu8v",
      "path": [
        "lens-dopaoy",
        "spectrometer-asnnrt"
      ],
      "color": "#f5f5f5",
      "label": "f2"
    }
  ],
  "connections": [],
  "frames": [],
  "groups": [
    {
      "id": "group-0a3jht",
      "name": "Master Setup",
      "color": "#3ab2ee",
      "members": [
        "lens-96e5rg",
        "objective-2m7cxa",
        "mirror-mount-8dozf9",
        "mirror-mount-yezxos",
        "mirror-mount-9educx",
        "mirror-mount-s1n7nl",
        "beam-splitter-i2w5av",
        "sample-tvsr93",
        "mirror-mount-uib9qz",
        "waveplate-garsyq",
        "mirror-mount-q8acy6",
        "mirror-mount-cdvbvm",
        "lens-24yqto",
        "mirror-mount-fvvyd0",
        "laser-source-x5gt7h",
        "laser-source-eip37t"
      ]
    }
  ],
  "labelScale": 0.75
} as const;

export const LAB_SETUP: BuilderSceneData = parseScene(RAW)!;
