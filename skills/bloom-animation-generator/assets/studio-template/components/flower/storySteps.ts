import type { ComponentType } from "react";
import {
  type DemoSyncProps,
  InstancingDemo,
  PetalCurlDemo,
  PhyllotaxisDemo,
  WavefrontDemo,
  WindDemo,
} from "./StepDemos";

export type FlowerStep = {
  no: string;
  title: string;
  /** Condensed title for tight layouts (e.g. the /demo card stack). */
  short: string;
  body: string;
  Demo: ComponentType<DemoSyncProps>;
  code: string;
};

export const FLOWER_STEPS: FlowerStep[] = [
  {
    no: "01",
    title: "One petal, folded by a shader",
    short: "Folded Petal",
    body: "There is no petal model — just a flat grid the vertex shader reshapes every frame. First a Catmull-Rom ramp sets the petal's width along its length; then curvature is integrated down the spine to curl it. Shape and curl, both pure math.",
    Demo: PetalCurlDemo,
    code: `// vertex shader — integrate curvature along the spine
for (int i = 0; i < N; i++) {
  float density = texture2D(uRamps, vec2(s, .5)).g;
  float curl = mix(uCurlClosed, uCurlOpen, openness(s));
  ang += curl * density * ds;
  sp  += vec2(cos(ang), sin(ang)) * ds;
}`,
  },
  {
    no: "02",
    title: "The golden spiral",
    short: "Golden Spiral",
    body: "Each petal is placed one golden angle — 137.5° — from the one before it. Because that angle is irrational, petals never line up into spokes, so they pack tightly with no wasted gaps. Radius and height rise along power curves, winding all thirty-six into a domed spiral.",
    Demo: PhyllotaxisDemo,
    code: `// flowerScene.ts — placing petal i
const a = i * goldenAngle * Math.PI / 180;  // 137.5°
const r = radius * Math.pow(u, radiusBias); // power-law radius
const y = height * Math.pow(u, heightBias); // receptacle dome
dummy.position.set(Math.sin(a) * r, H - y, Math.cos(a) * r);`,
  },
  {
    no: "03",
    title: "One dial opens every petal",
    short: "Bloom Dial",
    body: "Blooming is one number running 0 → 1 — not thirty-six animations. Each petal offsets it by its position, so the rim opens first and the core last: one dial becomes a wave that sweeps inward. The front's width sets how many petals move at once — and scrolling this page turns the dial.",
    Demo: WavefrontDemo,
    code: `// vertex shader (renamed for clarity) — one dial in, a delayed copy out
float order = 1.0 - aU;             // 0 = rim, opens first · 1 = core, last
float front = mix(-w, 1.0, uBloom); // front sweeps across the order axis
float local = 1.0 - clamp((order - front) / w, 0.0, 1.0);
// local: 0 = still a bud · 1 = fully open — this is what step 01 curls by`,
  },
  {
    no: "04",
    title: "Thirty-six petals, one draw call",
    short: "One Draw Call",
    body: "The whole flower is one InstancedMesh — a single geometry and material reused for every petal. Three per-instance attributes — aU, aSeed, aTilt — tell each copy where it sits, how old it is, and how far to lean. The GPU stamps all thirty-six in a single draw call.",
    Demo: InstancingDemo,
    code: `// flowerScene.ts — the entire flower
flower = new THREE.InstancedMesh(geo, mat, numPetals);
geo.setAttribute("aU",    new InstancedBufferAttribute(aU, 1));
geo.setAttribute("aSeed", new InstancedBufferAttribute(aSeed, 1));
geo.setAttribute("aTilt", new InstancedBufferAttribute(aTilt, 1));`,
  },
  {
    no: "05",
    title: "Wind & imperfection",
    short: "Wind & Noise",
    body: "A mathematically perfect flower looks fake. Layered value-noise breaks the symmetry: gusts ride a drifting noise field while per-petal jitter, edge waves, and a little asymmetry give each petal its own tremble — seeded so no two ever move alike.",
    Demo: WindDemo,
    code: `// vertex shader — gusts ride a moving noise field
float gust = turb(vec3(uTime * .13, aSeed * .31, 0.));
float wave = turb(vec3(phase * .55, wp.y * 1.3, aSeed * .7)) - .5;
wp.xyz += wdir * uWindAmp * bloomLocal * uv.y * uv.y
        * (0.35 + 0.65 * gust) * wave * 2.0;`,
  },
];
