"use client";

import FlowerDeck from "./FlowerDeck";
import type { FlowerSceneApi } from "./flowerScene";

// ============================================================================
// Scarlet ball-dahlia showcase.
//
// Same deck, same UI as /demo — only the flower differs. We reuse the generic
// phyllotaxis engine (FlowerDeck) and just swap in a dahlia preset, a scarlet
// palette, and a near-side-on camera. The deck's 2D demos are retinted red via
// the "dahlia" variant (see dahlia.css); everything else is identical to /demo.
//
// Read off the photo (a red decorative / ball dahlia):
//   • Petals are broad & ovate — narrow base, widest mid-length, rounded tip.
//   • Each petal is cupped along its midrib and its edges roll inward.
//   • Dozens of petals stack on a domed receptacle into a near-spherical head.
//   • Colour is monochromatic scarlet: coral tips → crimson/maroon throat.
// ============================================================================

// Base width control points [base, lower, upper, tip] — broad ovate profile.
const DAHLIA_WIDTHS = [0.16, 0.31, 0.35, 0.26] as const;

// One-shot reshape of the generic flower into the ball dahlia.
const DAHLIA_PRESET = {
  numPetals: 140,
  goldenAngle: 137.5,
  outwardPush: true,
  radius: 0.16,
  radiusBias: 1.1,
  height: 0.26, // domed receptacle; outer petals then drape down the sides
  heightBias: 1.0,
  scaleInner: 0.42,
  tiltInner: 0.06,
  // The outer ring opens PAST horizontal so the lowest petals recurve and hang
  // down (a decorative dahlia, not a tight ball). The high tiltBias keeps the
  // centre furled and the dome upright, so only the outermost rings drop.
  outAngle: 112,
  tiltBias: 2.9,
  petalLen: 0.82, // long enough to overlap like shingles and drape at the rim
  curlClosed: 1.85, // furl into a small bud without spiking the tips
  curlOpen: 0.18, // open nearly flat with only a slight forward cup
  curlBias: 2.3,
  propagation: 1.2,
  w0: DAHLIA_WIDTHS[0],
  w1: DAHLIA_WIDTHS[1],
  w2: DAHLIA_WIDTHS[2],
  w3: DAHLIA_WIDTHS[3],
  cup: 0.5, // shallow concave scale, not a deep cone
  sideCurl: 0.45, // gentle edge roll -> rounded scale, not a quill point
  wrapWidth: 0.1,
  wrapCup: 0.18,
  waveAmp: 0.025,
  asym: 0.08,
  jitter: 0.05,
  shellGap: 0.05,
  windAmp: 0.12,
  windSpeed: 1.0,
  flat: false, // soft Lambert + subsurface so the dense ball reads in 3D
};

// Five-stop ramp, cold rim (tip / outer ring) -> hot core (base / centre).
const DAHLIA_PALETTE: [number, number, number][] = [
  [1.0, 0.46, 0.34], // bright coral highlight on the tips
  [0.97, 0.22, 0.18], // scarlet
  [0.85, 0.1, 0.13], // pure red petal face
  [0.55, 0.04, 0.1], // crimson shadow
  [0.3, 0.02, 0.07], // deep maroon furled throat
];

export default function DahliaCanvas() {
  return (
    <FlowerDeck
      variant="dahlia"
      initialInstances={DAHLIA_PRESET.numPetals}
      customizeScene={(scene: FlowerSceneApi) => {
        scene.applyPreset(DAHLIA_PRESET);
        scene.setPalette(DAHLIA_PALETTE);
        // Frame the bloom nearly side-on (slightly above), like the photo, so
        // the recurving outer petals that droop down the sides stay visible.
        scene.setCameraView([0.3, 2.5, 3.95]);
      }}
    />
  );
}
