import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import GUI from "lil-gui";

const MAX_LAYOUT_PETALS = 150;

/**
 * Boots the phyllotaxis flower scene + lil-gui into the given containers.
 * Returns a cleanup function that tears down Three.js, the GUI and listeners.
 */
export function createFlowerScene(
  canvasContainer: HTMLElement,
  guiContainer: HTMLElement,
  tabsContainer?: HTMLElement | null,
) {
  const params = {
    // ===== Phyllotaxis =====
    numPetals: 36,
    goldenAngle: 137.5,
    // true only while the Golden Spiral demo is adding/removing seeds; default
    // flower layout keeps filling the current petal count.
    stableLayout: false,
    // false → lay petals in concentric rings (the "mechanical" wrong layout)
    outwardPush: true,
    radius: 0.14,
    radiusBias: 1.15,
    height: 0.13,
    heightBias: 1.2,
    scaleInner: 0.5,
    tiltInner: 0.08,
    outAngle: 68,
    tiltBias: 2.2,
    // ===== Growth wavefront =====
    bloom: 0.0,
    bloomMax: 0.78,
    transition: 0.35,
    // Scroll drives the bloom by default; the GUI checkbox re-enables the loop.
    animate: false,
    // ===== Single petal =====
    petalLen: 0.95,
    curlClosed: 1.7,
    curlOpen: -0.35,
    curlBias: 2.3,
    propagation: 1.2,
    stemWidth: 0.03,
    stemEnd: 0.04,
    w0: 0.16,
    w1: 0.28,
    w2: 0.3,
    w3: 0.2,
    cup: 0.4,
    sideCurl: 0.45,
    waveAmp: 0.035,
    waveFreq: 11,
    asym: 0.08,
    // ===== De-interleave / noise / wind =====
    jitter: 0.04,
    noiseAmp: 0.045,
    noiseFreq: 5.0,
    windAmp: 0.09,
    windSpeed: 1.0,
    windHeading: 35,
    shellGap: 0.14,
    // How much a furled petal inflates while closed (width / cup). Defaults
    // reproduce the original hard-coded values; the dahlia lowers them so its
    // broad cupped petals don't balloon into a smooth onion before opening.
    wrapWidth: 0.35,
    wrapCup: 0.5,
    // ===== Render style: flat per-petal gradient (no lighting) =====
    flat: true,
  };

  // ===== ramp texture (R=width, G=curlDensity) =====
  const RAMP_RES = 256;
  const rampData = new Float32Array(RAMP_RES * 4);
  const rampTex = new THREE.DataTexture(
    rampData,
    RAMP_RES,
    1,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  rampTex.minFilter = rampTex.magFilter = THREE.LinearFilter;

  function catmullRom(pts: number[], t: number) {
    const n = pts.length - 1;
    const f = Math.min(t * n, n - 1e-6);
    const i = Math.floor(f),
      s = f - i;
    const p0 = pts[Math.max(i - 1, 0)],
      p1 = pts[i],
      p2 = pts[i + 1],
      p3 = pts[Math.min(i + 2, n)];
    return (
      0.5 *
      (2 * p1 +
        (-p0 + p2) * s +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * s +
        (-p0 + 3 * p1 - 3 * p2 + p3) * s * s * s)
    );
  }
  function bakeRamps() {
    const { stemWidth, stemEnd, w0, w1, w2, w3, curlBias } = params;
    const widthPts = [stemWidth, w0, w1, w2, w3, 0.002];
    for (let i = 0; i < RAMP_RES; i++) {
      const v = i / (RAMP_RES - 1);
      rampData[i * 4] =
        v < stemEnd
          ? stemWidth
          : Math.max(catmullRom(widthPts, (v - stemEnd) / (1 - stemEnd)), 0.002);
      rampData[i * 4 + 1] = curlBias * Math.pow(Math.max(v, 1e-4), curlBias - 1);
    }
    rampTex.needsUpdate = true;
  }
  bakeRamps();

  const uniforms = {
    uRamps: { value: rampTex },
    uBloom: { value: 0 },
    uTransition: { value: params.transition },
    uCurlClosed: { value: params.curlClosed },
    uCurlOpen: { value: params.curlOpen },
    uPropagation: { value: params.propagation },
    uLength: { value: params.petalLen },
    uCup: { value: params.cup },
    uSideCurl: { value: params.sideCurl },
    uWaveAmp: { value: params.waveAmp },
    uWaveFreq: { value: params.waveFreq },
    uAsym: { value: params.asym },
    uTime: { value: 0 },
    uNoiseAmp: { value: params.noiseAmp },
    uNoiseFreq: { value: params.noiseFreq },
    uWindAmp: { value: params.windAmp },
    uWindSpeed: { value: params.windSpeed },
    uWindHeading: { value: (params.windHeading * Math.PI) / 180 },
    uShellGap: { value: params.shellGap },
    uWrapWidth: { value: params.wrapWidth },
    uWrapCup: { value: params.wrapCup },
    uFlat: { value: 1 },
    // Per-petal colour ramp (cold rim -> hot core). Defaults reproduce the
    // original hard-coded blue->orange gradient exactly, so existing pages are
    // untouched; the dahlia showcase swaps in a scarlet ramp via setPalette().
    uCol0: { value: new THREE.Vector3(0.05, 0.2, 0.65) },
    uCol1: { value: new THREE.Vector3(0.15, 0.55, 0.95) },
    uCol2: { value: new THREE.Vector3(0.85, 0.92, 1.0) },
    uCol3: { value: new THREE.Vector3(1.0, 0.72, 0.0) },
    uCol4: { value: new THREE.Vector3(1.0, 0.25, 0.0) },
  };

  // Push every shape/wind param into its matching uniform in one shot. Used by
  // applyPreset() so a page can hand over a whole look at once.
  function syncShapeUniforms() {
    uniforms.uTransition.value = params.transition;
    uniforms.uCurlClosed.value = params.curlClosed;
    uniforms.uCurlOpen.value = params.curlOpen;
    uniforms.uPropagation.value = params.propagation;
    uniforms.uLength.value = params.petalLen;
    uniforms.uCup.value = params.cup;
    uniforms.uSideCurl.value = params.sideCurl;
    uniforms.uWaveAmp.value = params.waveAmp;
    uniforms.uWaveFreq.value = params.waveFreq;
    uniforms.uAsym.value = params.asym;
    uniforms.uNoiseAmp.value = params.noiseAmp;
    uniforms.uNoiseFreq.value = params.noiseFreq;
    uniforms.uWindAmp.value = params.windAmp;
    uniforms.uWindSpeed.value = params.windSpeed;
    uniforms.uWindHeading.value = (params.windHeading * Math.PI) / 180;
    uniforms.uShellGap.value = params.shellGap;
    uniforms.uWrapWidth.value = params.wrapWidth;
    uniforms.uWrapCup.value = params.wrapCup;
    uniforms.uFlat.value = params.flat ? 1 : 0;
  }

  const vert = /* glsl */ `
attribute float aU;
attribute float aSeed;
attribute float aTilt;
uniform sampler2D uRamps;
uniform float uBloom, uTransition, uCurlClosed, uCurlOpen, uPropagation;
uniform float uLength, uCup, uSideCurl, uWaveAmp, uWaveFreq, uAsym;
uniform float uTime, uNoiseAmp, uNoiseFreq, uWindAmp, uWindSpeed, uWindHeading;
uniform float uShellGap, uWrapWidth, uWrapCup;

float hash3(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x),
        mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
        mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float turb(vec3 p) {
  return vnoise(p) * 0.65 + vnoise(p * 2.3) * 0.35;
}
varying vec2 vUv;
varying vec3 vNormalW;
varying float vU;

float openness(float s, float bloomLocal) {
  float p = clamp(bloomLocal * (1.0 + uPropagation) - s * uPropagation, 0.0, 1.0);
  return p * p * (3.0 - 2.0 * p);
}

vec3 petalPos(vec2 uvIn, float bloomLocal, float seed) {
  float u = uvIn.x * 2.0 - 1.0;
  float v = uvIn.y;
  const int N = 24;
  float ds = v / float(N);
  float ang = 0.0;
  vec2 sp = vec2(0.0);
  for (int i = 0; i < N; i++) {
    float s = (float(i) + 0.5) * ds;
    float density = texture2D(uRamps, vec2(s, 0.5)).g;
    float curl = mix(uCurlClosed, uCurlOpen, openness(s, bloomLocal));
    ang += curl * density * ds;
    sp += vec2(cos(ang), sin(ang)) * ds;
  }
  sp *= uLength;
  float relax = 0.15 + 0.85 * bloomLocal;
  float wrap = 1.0 - bloomLocal;
  float width = texture2D(uRamps, vec2(v, 0.5)).r * (1.0 + uAsym * u * relax)
    * (1.0 + uWrapWidth * wrap);
  float x = u * width;
  float zl = -uCup * (1.0 + uWrapCup * wrap) * (1.0 - u * u) * width;
  zl += uWaveAmp * relax * u * u * sin(v * uWaveFreq + seed * 17.0 + u * 2.3 + seed);
  zl += 0.01 * relax * sin(seed * 7.0 + v * 5.0) * v;
  zl += uNoiseAmp * v * bloomLocal
    * (turb(vec3(u * 2.0 + seed, v * uNoiseFreq, seed * 3.7 + uTime * uWindSpeed * 0.15)) - 0.5) * 2.0;
  float sa = uSideCurl * x * relax;
  vec2 xz = mat2(cos(sa), -sin(sa), sin(sa), cos(sa)) * vec2(x, zl);
  vec3 nd = vec3(0.0, -sin(ang), cos(ang));
  return vec3(xz.x, sp.x, sp.y) + nd * xz.y;
}

void main() {
  vUv = uv;
  vU = aU;
  float map = 1.0 - aU;
  float p = mix(-uTransition, 1.0, uBloom);
  float mask = clamp((map - p) / uTransition, 0.0, 1.0);
  float bloomLocal = 1.0 - mask;

  vec3 pos = petalPos(uv, bloomLocal, aSeed);
  vec3 pu = petalPos(uv + vec2(0.004, 0.0), bloomLocal, aSeed);
  vec3 pv = petalPos(uv + vec2(0.0, 0.004), bloomLocal, aSeed);
  vec3 nrm = normalize(cross(pu - pos, pv - pos));
  float shell = 1.0 + uShellGap * aU * (1.0 - bloomLocal);
  pos *= shell;
  float ta = -aTilt * bloomLocal;
  float ca = cos(ta), sa2 = sin(ta);
  mat3 rx = mat3(1.0, 0.0, 0.0,  0.0, ca, sa2,  0.0, -sa2, ca);
  pos = rx * pos;
  nrm = rx * nrm;
  vec4 wp = vec4(pos, 1.0);
#ifdef USE_INSTANCING
  wp = instanceMatrix * wp;
  nrm = normalize(mat3(instanceMatrix) * nrm);
#endif
  {
    vec3 wdir = vec3(cos(uWindHeading), 0.0, sin(uWindHeading));
    float phase = dot(wp.xyz, wdir) * 2.2 - uTime * uWindSpeed * 1.4;
    float gust = turb(vec3(uTime * uWindSpeed * 0.13, aSeed * 0.31, 0.0));
    float wave = (turb(vec3(phase * 0.55, wp.y * 1.3, aSeed * 0.7)) - 0.5) * 2.0;
    float amp = uWindAmp * bloomLocal * uv.y * uv.y * (0.35 + 0.65 * gust);
    wp.xyz += wdir * amp * wave;
    wp.y   += amp * 0.4 * (turb(vec3(phase * 0.4 + 7.0, aSeed, 1.0)) - 0.5);
  }
  vNormalW = nrm;
  gl_Position = projectionMatrix * modelViewMatrix * wp;
}`;

  const frag = /* glsl */ `
uniform float uFlat;
uniform vec3 uCol0, uCol1, uCol2, uCol3, uCol4;
varying vec2 vUv;
varying vec3 vNormalW;
varying float vU;

// Cold rim -> hot core ramp. Each petal is coloured by its own base->tip
// position, so flat mode is simply this gradient with the lighting removed.
// The five stops are uniforms (defaulting to blue->orange) so a page can
// recolour the whole flower without rebuilding anything.
vec3 rampColor(float t) {
  vec3 col0 = uCol0;
  vec3 col1 = uCol1;
  vec3 col2 = uCol2;
  vec3 col3 = uCol3;
  vec3 col4 = uCol4;
  if (t < 0.25)      return mix(col0, col1, smoothstep(0.0, 0.25, t));
  else if (t < 0.5)  return mix(col1, col2, smoothstep(0.25, 0.5, t));
  else if (t < 0.75) return mix(col2, col3, smoothstep(0.5, 0.75, t));
  else               return mix(col3, col4, smoothstep(0.75, 1.0, t));
}

void main() {
  // Per-petal gradient: warm (yellow) near the base/axis, cooling to white then
  // blue toward each petal's tip and outer edge. Flat mode keeps this exact
  // gradient and only drops the lighting below.
  float closeness = (1.0 - vUv.y) * 0.7 + (1.0 - vU) * 0.3;
  vec3 col = rampColor(closeness);

  // 3D lighting: smooth Lambert + subsurface translucency. Everything here
  // fades to nothing as uFlat -> 1, leaving pure flat ramp colour (no shadows).
  vec3 n = normalize(vNormalW) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 ld = normalize(vec3(0.5, 0.8, 0.6));
  float lit = mix(0.52 + 0.48 * max(dot(n, ld), 0.0), 1.0, uFlat);
  float trans = max(dot(-n, ld), 0.0);
  vec3 transCol = mix(uCol1, uCol4, closeness);
  col += transCol * trans * trans * 0.3 * (1.0 - uFlat);
  if (!gl_FrontFacing) lit *= mix(0.88, 1.0, uFlat);

  gl_FragColor = vec4(col * lit, 1.0);
}`;

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.DoubleSide,
  });

  const width = canvasContainer.clientWidth;
  const height = canvasContainer.clientHeight;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  canvasContainer.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.01, 100);
  camera.position.set(1, 3.5, 2.0);
  const controls = new OrbitControls(camera, renderer.domElement);
  const baseTargetY = 1.18;
  // 0 = camera target stays fixed while blooming, so the flower doesn't drift
  // up in frame as it opens.
  const bloomTargetCompensation = 0;
  const minZoomDistance = 1.25;
  const maxZoomDistance = 6.5;
  let bloomProgress = 0;
  const syncTarget = () => {
    controls.target.y = baseTargetY - bloomTargetCompensation * bloomProgress;
  };
  controls.target.set(0, baseTargetY, 0);
  // Wheel must keep scrolling the page story, so zoom stays off.
  controls.enableZoom = false;

  // Scroll-driven rotation lives on the group so OrbitControls (camera)
  // and ScrollTrigger (flower) never fight over the same transform.
  const flowerGroup = new THREE.Group();
  flowerGroup.position.y = 0.45;
  flowerGroup.scale.setScalar(1.3);
  scene.add(flowerGroup);

  let flower: THREE.InstancedMesh | null = null;
  const dummy = new THREE.Object3D();
  function concentricSpot(index: number, total: number) {
    let placed = 0;
    for (let ring = 0; placed < total; ring++) {
      const size = ring === 0 ? 1 : 6 * ring;
      if (index < placed + size) {
        const j = index - placed;
        const maxRing = Math.max(
          Math.ceil((Math.sqrt(12 * total - 3) - 3) / 6),
          1,
        );
        return {
          u: ring / maxRing,
          ang: ring * 0.55 + (j / size) * Math.PI * 2,
          jit: 0,
        };
      }
      placed += size;
    }
    return { u: 1, ang: 0, jit: 0 };
  }

  function buildFlower() {
    if (flower) {
      flowerGroup.remove(flower);
      flower.geometry.dispose();
    }
    const n = params.numPetals;
    const geo = new THREE.PlaneGeometry(1, 1, 24, 64);
    geo.deleteAttribute("normal");
    const aU = new Float32Array(n),
      aSeed = new Float32Array(n),
      aTilt = new Float32Array(n);
    flower = new THREE.InstancedMesh(geo, mat, n);
    const layoutMax = params.stableLayout ? MAX_LAYOUT_PETALS : n;

    // Per-petal layout. outward push ON → phyllotaxis spiral. OFF → concentric
    // rings (centre, then 6, 12, 18 … evenly spaced, no jitter): the deliberately
    // "too neat / mechanical" arrangement used to contrast the spiral.
    const spots: { u: number; ang: number; jit: number }[] = [];
    if (params.outwardPush) {
      for (let i = 0; i < n; i++) {
        spots.push({
          u: layoutMax > 1 ? i / (layoutMax - 1) : 0,
          ang: (params.goldenAngle * i * Math.PI) / 180,
          jit: 1,
        });
      }
    } else {
      for (let i = 0; i < n; i++) spots.push(concentricSpot(i, layoutMax));
    }

    for (let i = 0; i < n; i++) {
      const { u, ang: a, jit } = spots[i];
      const h1 = Math.sin(i * 127.1) * 0.5 + 0.5;
      const h2 = Math.sin(i * 311.7) * 0.5 + 0.5;
      const h3 = Math.sin(i * 74.3) * 0.5 + 0.5;
      const j = params.jitter * (0.3 + 0.7 * u) * jit;
      const r = params.radius * Math.pow(u, params.radiusBias) * (1 + (h1 - 0.5) * j);
      const y = params.height * Math.pow(u, params.heightBias) * (1 + (h2 - 0.5) * j);
      dummy.position.set(Math.sin(a) * r, params.height - y, Math.cos(a) * r);
      dummy.rotation.set(-params.tiltInner, a + Math.PI, (h3 - 0.5) * j * 1.5, "YXZ");
      aTilt[i] = ((params.outAngle * Math.PI) / 180) * Math.pow(u, params.tiltBias);
      const s = params.scaleInner + (1 - params.scaleInner) * u;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      flower.setMatrixAt(i, dummy.matrix);
      aU[i] = u;
      aSeed[i] = (((i * 0.618) % 1) * 20);
    }
    geo.setAttribute("aU", new THREE.InstancedBufferAttribute(aU, 1));
    geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(aSeed, 1));
    geo.setAttribute("aTilt", new THREE.InstancedBufferAttribute(aTilt, 1));
    flower.instanceMatrix.needsUpdate = true;
    flowerGroup.add(flower);
  }
  buildFlower();

  // ===== Stem & leaves =====
  // Flat-green stem + leaves, tuned for the flat tone-shading look. Parented to
  // flowerGroup so the whole plant turns together with the scroll rotation.
  const stemParams = { show: true, length: 1.8, leaves: true };
  const stemMat = new THREE.MeshBasicMaterial({
    color: 0x2f7d34,
    side: THREE.DoubleSide,
  });
  const leafMat = new THREE.MeshBasicMaterial({
    color: 0x46a049,
    side: THREE.DoubleSide,
  });
  let stemGroup: THREE.Group | null = null;

  function makeLeafGeometry() {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.bezierCurveTo(0.14, 0.18, 0.17, 0.55, 0, 0.85);
    s.bezierCurveTo(-0.17, 0.55, -0.14, 0.18, 0, 0);
    return new THREE.ShapeGeometry(s, 18);
  }

  function buildStem() {
    if (stemGroup) {
      flowerGroup.remove(stemGroup);
      stemGroup.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      stemGroup = null;
    }
    if (!stemParams.show) return;

    stemGroup = new THREE.Group();
    const L = stemParams.length;
    // Stem meets the flower at the bottom of the receptacle (y~0), not up in the
    // throat. Slightly meandering so it doesn't read as a stiff rod.
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.02, 0),
      new THREE.Vector3(0.06, -L * 0.35, 0.05),
      new THREE.Vector3(-0.05, -L * 0.7, -0.04),
      new THREE.Vector3(0.02, -L, 0),
    ]);
    const stem = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 48, 0.03, 10, false),
      stemMat,
    );
    stemGroup.add(stem);

    if (stemParams.leaves) {
      const leafGeo = makeLeafGeometry();
      // (t along stem, which side, size) — large leaves low on the stem so
      // they splay out past the bloom's silhouette and stay visible.
      const placements = [
        { t: 0.55, side: -1, scale: 1.35 },
        { t: 0.72, side: 1, scale: 1.5 },
        { t: 0.88, side: -1, scale: 1.0 },
      ];
      for (const p of placements) {
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.copy(curve.getPointAt(p.t));
        leaf.rotation.y = p.side > 0 ? 0.7 : -0.7;
        leaf.rotation.z = p.side * -0.7;
        leaf.scale.setScalar(p.scale);
        stemGroup.add(leaf);
      }
    }
    flowerGroup.add(stemGroup);
  }
  buildStem();

  // ===== GUI =====
  // Fewest petals the layout allows — the Petal tab's reset drops to this so a
  // single petal is easy to study.
  const PETAL_MIN = 5;
  const gui = new GUI({ container: guiContainer });
  const U = (name: keyof typeof uniforms) => (v: number) => {
    uniforms[name].value = v;
  };
  const applyBloom = (v: number) => {
    uniforms.uBloom.value = v;
    const range = Math.max(params.bloomMax - 0.04, 0.001);
    bloomProgress = THREE.MathUtils.clamp((v - 0.04) / range, 0, 1);
    syncTarget();
  };

  // Resets every controller (recursively) back to its initial default value;
  // each onChange re-applies uniforms / rebuilds the flower as needed.
  const resetCtrl = gui
    .add({ reset: () => gui.reset() }, "reset")
    .name("↺ Reset All");

  const fPetal = gui.addFolder("Petal Geometry");

  // Petal Shape: the flat outline + size of a single petal.
  const fShape = fPetal.addFolder("Petal Shape");
  fShape.add(params, "petalLen", 0.3, 1.5).name("Petal Length").onChange(U("uLength"));
  fShape.add(params, "w0", 0, 0.6).name("Base Width").onChange(bakeRamps);
  fShape.add(params, "w1", 0, 0.6).name("Lower Width").onChange(bakeRamps);
  fShape.add(params, "w2", 0, 0.6).name("Upper Width").onChange(bakeRamps);
  fShape.add(params, "w3", 0, 0.6).name("Tip Width").onChange(bakeRamps);

  // Transform: how that flat petal curls and bends in 3D.
  const fTransform = fPetal.addFolder("Transform");
  fTransform.add(params, "curlClosed", 0, 4).name("Curl (Closed)").onChange(U("uCurlClosed"));
  fTransform.add(params, "curlOpen", -1.5, 1).name("Curl (Open)").onChange(U("uCurlOpen"));
  fTransform.add(params, "curlBias", 0.3, 4).name("Curl Concentration").onChange(bakeRamps);
  fTransform.add(params, "cup", 0, 1.5).name("Cup Arch").onChange(U("uCup"));
  fTransform.add(params, "sideCurl", -3, 3).name("Transverse Curl").onChange(U("uSideCurl"));
  fTransform.add(params, "waveAmp", 0, 0.08).name("Edge Wave Amp").onChange(U("uWaveAmp"));
  fTransform.add(params, "asym", -0.4, 0.4).name("Asymmetry").onChange(U("uAsym"));

  const fPhy = gui.addFolder("Phyllotaxis Layout");
  const numPetalsCtrl = fPhy
    .add(params, "numPetals", PETAL_MIN, 150, 1)
    .name("Petals Count")
    .onChange(buildFlower);
  fPhy.add(params, "goldenAngle", 90, 180, 0.1).name("Golden Angle").onChange(buildFlower);
  fPhy.add(params, "radius", 0.1, 1.5).name("Base Radius").onChange(buildFlower);
  fPhy.add(params, "radiusBias", 0.3, 3).name("Radius Distribution").onChange(buildFlower);
  fPhy.add(params, "height", 0, 1).name("Receptacle Height").onChange(buildFlower);
  fPhy.add(params, "heightBias", 0.3, 3).name("Height Distribution").onChange(buildFlower);
  fPhy.add(params, "scaleInner", 0.1, 1).name("Inner Scale").onChange(buildFlower);
  fPhy.add(params, "tiltInner", -0.5, 1.5).name("Inner Tilt").onChange(buildFlower);
  fPhy.add(params, "outAngle", 0, 120).name("Outer Angle (Max)").onChange(buildFlower);
  fPhy.add(params, "tiltBias", 0.5, 6).name("Tilt Distribution").onChange(buildFlower);
  fPhy.close();

  const fDetail = gui.addFolder("Wind & Jitter");
  fDetail.add(params, "jitter", 0, 0.4).name("Petal Jitter").onChange(buildFlower);
  fDetail.add(params, "shellGap", 0, 0.5).name("Shell Gap (Closed)").onChange(U("uShellGap"));
  fDetail.add(params, "noiseAmp", 0, 0.12).name("Surface Noise Amp").onChange(U("uNoiseAmp"));
  fDetail.add(params, "noiseFreq", 1, 15).name("Surface Noise Freq").onChange(U("uNoiseFreq"));
  fDetail.add(params, "windAmp", 0, 0.5).name("Wind Amplitude").onChange(U("uWindAmp"));
  fDetail.add(params, "windSpeed", 0, 4).name("Wind Speed").onChange(U("uWindSpeed"));
  fDetail
    .add(params, "windHeading", 0, 360)
    .name("Wind Direction")
    .onChange((v: number) => (uniforms.uWindHeading.value = (v * Math.PI) / 180));
  fDetail.close();

  const fAnim = gui.addFolder("Animation");
  fAnim.add(params, "bloom", 0, 1).name("Bloom Progress").onChange(applyBloom).listen();
  fAnim.add(params, "bloomMax", 0.5, 1).name("Bloom Limit");
  fAnim.add(params, "transition", 0.05, 1).name("Propagation Width").onChange(U("uTransition"));
  fAnim.add(params, "animate").name("Auto-Animate");
  // One-shot bloom playback, independent of the Auto-Animate loop.
  let playStart: number | null = null;
  fAnim
    .add({ play: () => (playStart = clock.getElapsedTime()) }, "play")
    .name("▶ Play");

  const fStyle = gui.addFolder("Render Style");
  fStyle
    .add(params, "flat")
    .name("Flat / Tone Shading")
    .onChange((v: boolean) => (uniforms.uFlat.value = v ? 1 : 0));
  fStyle.close();

  const fStem = gui.addFolder("Stem & Leaves");
  fStem.add(stemParams, "show").name("Show Stem").onChange(buildStem);
  fStem.add(stemParams, "length", 0.8, 3).name("Stem Length").onChange(buildStem);
  fStem.add(stemParams, "leaves").name("Show Leaves").onChange(buildStem);
  fStem.close();

  // ===== Tabbed panel =====
  // The left "Option Tab" rail drives which folder's controls the right
  // "Control Bar" shows; only the active folder is mounted at a time.
  let tabsCleanup: (() => void) | null = null;
  if (tabsContainer) {
    const tabFolders = gui.folders; // top-level folders, in creation order
    resetCtrl.domElement.style.display = "none"; // reset moves into the rail
    const tabButtons: HTMLButtonElement[] = [];
    const selectTab = (active: number) => {
      tabFolders.forEach((folder, i) => {
        folder.domElement.style.display = i === active ? "" : "none";
        if (i === active) folder.open();
      });
      tabButtons.forEach((btn, i) =>
        btn.classList.toggle("active", i === active),
      );
    };
    tabFolders.forEach((folder, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gui-tab";
      btn.textContent = folder.$title.textContent ?? "";
      btn.addEventListener("click", () => selectTab(i));
      tabsContainer.appendChild(btn);
      tabButtons.push(btn);
    });
    // Reset every control to its default, then leave the flower fully bloomed
    // (its final state) rather than closed back to the bud.
    const resetAll = () => {
      gui.reset();
      params.bloom = params.bloomMax;
      applyBloom(params.bloom);
    };
    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "demo-chip demo-chip--reset gui-reset";
    resetBtn.textContent = "↺ Reset";
    resetBtn.addEventListener("click", resetAll);
    tabsContainer.appendChild(resetBtn);

    // Same as Reset All, but also drops the flower to the minimum petal count
    // so a single petal is easy to study.
    const petalReset = document.createElement("button");
    petalReset.type = "button";
    petalReset.className = "demo-chip demo-chip--reset gui-section-reset";
    petalReset.textContent = "↺ Reset Petal";
    petalReset.addEventListener("click", () => {
      resetAll();
      numPetalsCtrl.setValue(PETAL_MIN); // rebuilds via onChange + syncs display
    });
    tabsContainer.appendChild(petalReset);

    // These two are presenter-only: keep them hidden and reveal the pair only
    // while Option/Alt is held, so end users never see them.
    const revealTools = (e: KeyboardEvent) =>
      tabsContainer.classList.toggle("reveal-tools", e.altKey);
    const hideTools = () => tabsContainer.classList.remove("reveal-tools");
    window.addEventListener("keydown", revealTools);
    window.addEventListener("keyup", revealTools);
    window.addEventListener("blur", hideTools);
    tabsCleanup = () => {
      window.removeEventListener("keydown", revealTools);
      window.removeEventListener("keyup", revealTools);
      window.removeEventListener("blur", hideTools);
    };

    selectTab(0);
  }

  // ===== resize + render loop =====
  let pendingResize: { w: number; h: number } | null = null;
  const ro = new ResizeObserver(() => {
    const w = canvasContainer.clientWidth,
      h = canvasContainer.clientHeight;
    if (!w || !h) return;
    pendingResize = { w, h };
  });
  ro.observe(canvasContainer);

  const onResize = () => {
    const w = canvasContainer.clientWidth,
      h = canvasContainer.clientHeight;
    if (w && h) pendingResize = { w, h };
  };
  window.addEventListener("resize", onResize);

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    if (pendingResize) {
      const { w, h } = pendingResize;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      pendingResize = null;
    }
    uniforms.uTime.value = clock.getElapsedTime();
    if (params.animate) {
      const t = clock.getElapsedTime() % 11;
      let x = Math.min(Math.max(t / 5, 0), 1);
      x = 1 - Math.pow(1 - x, 3.2);
      params.bloom = 0.04 + (params.bloomMax - 0.04) * x;
      applyBloom(params.bloom);
    } else if (playStart !== null) {
      const t = clock.getElapsedTime() - playStart;
      let x = Math.min(Math.max(t / 5, 0), 1);
      x = 1 - Math.pow(1 - x, 3.2);
      params.bloom = 0.04 + (params.bloomMax - 0.04) * x;
      applyBloom(params.bloom);
      if (t >= 5) playStart = null;
    }
    controls.update();
    renderer.render(scene, camera);
  });

  return {
    /** Scroll-driven bloom; ignored while the GUI's Auto-Animate loop owns it. */
    setBloom(v: number) {
      if (params.animate) return;
      params.bloom = v;
      applyBloom(v);
    },
    /** Scroll-driven turntable rotation of the whole flower. */
    setRotation(y: number) {
      flowerGroup.rotation.y = y;
    },
    /** One-shot replay of the bud -> full bloom; drives the finale Bloom button. */
    playBloom() {
      if (params.animate) return;
      playStart = clock.getElapsedTime();
    },
    /**
     * Set the initial camera position (the orbit target stays on the flower
     * head). Used by the dahlia showcase to frame the bloom side-on, the way
     * the reference photo is shot, so the recurving outer petals read clearly.
     */
    setCameraView(pos: [number, number, number]) {
      camera.position.set(pos[0], pos[1], pos[2]);
      controls.update();
    },
    /** Modifier-wheel zoom; ordinary wheel is reserved for story scrolling. */
    zoomBy(deltaY: number) {
      const offset = camera.position.clone().sub(controls.target);
      const nextDistance = THREE.MathUtils.clamp(
        offset.length() * Math.exp(deltaY * 0.001),
        minZoomDistance,
        maxZoomDistance,
      );
      camera.position.copy(
        controls.target.clone().add(offset.setLength(nextDistance)),
      );
      controls.update();
    },
    /** Rebuilds the layout — used by the /mockup showcase sliders. */
    setGoldenAngle(deg: number) {
      params.goldenAngle = deg;
      buildFlower();
    },
    setStableLayout(on: boolean) {
      if (params.stableLayout === on) return;
      params.stableLayout = on;
      buildFlower();
    },
    /** false → concentric-ring ("mechanical") layout instead of the spiral. */
    setOutwardPush(on: boolean) {
      params.outwardPush = on;
      buildFlower();
    },
    setNumPetals(n: number) {
      params.numPetals = THREE.MathUtils.clamp(
        Math.round(n),
        1,
        MAX_LAYOUT_PETALS,
      );
      buildFlower();
    },
    /** Petal curl-when-closed. */
    setCurl(v: number) {
      params.curlClosed = v;
      uniforms.uCurlClosed.value = v;
    },
    /** Open-petal curl — what's visible on a bloomed flower (/demo card 01). */
    setCurlOpen(v: number) {
      const c = THREE.MathUtils.clamp(v, -1.5, 1.2);
      params.curlOpen = c;
      uniforms.uCurlOpen.value = c;
    },
    /** Petal width ramp [w0..w3] — driven by the /demo "Folded petal" card. */
    setPetalWidths([w0, w1, w2, w3]: number[]) {
      params.w0 = w0;
      params.w1 = w1;
      params.w2 = w2;
      params.w3 = w3;
      bakeRamps();
    },
    /** Bloom wavefront width — driven by the /demo "Bloom dial" card. */
    setTransition(v: number) {
      params.transition = v;
      uniforms.uTransition.value = v;
    },
    setWindAmp(v: number) {
      params.windAmp = v;
      uniforms.uWindAmp.value = v;
    },
    setWindSpeed(v: number) {
      params.windSpeed = v;
      uniforms.uWindSpeed.value = v;
    },
    /** Petal cup arch (transverse spoon). Uniform-only — safe to drag live. */
    setCup(v: number) {
      params.cup = v;
      uniforms.uCup.value = v;
    },
    /** Edge roll (involute "quilled" look of a ball dahlia). Uniform-only. */
    setSideCurl(v: number) {
      params.sideCurl = v;
      uniforms.uSideCurl.value = v;
    },
    /** Flat tone-shading vs. soft Lambert + subsurface lighting. */
    setFlat(on: boolean) {
      params.flat = on;
      uniforms.uFlat.value = on ? 1 : 0;
    },
    /** Recolour the five-stop petal ramp (cold rim -> hot core), each [r,g,b]. */
    setPalette(stops: [number, number, number][]) {
      const us = [
        uniforms.uCol0,
        uniforms.uCol1,
        uniforms.uCol2,
        uniforms.uCol3,
        uniforms.uCol4,
      ];
      stops.slice(0, 5).forEach((c, i) => us[i].value.set(c[0], c[1], c[2]));
    },
    /**
     * Apply a whole look at once: merge a partial param patch, re-bake the
     * width/curl ramps, push shape uniforms and rebuild the layout. Heavy
     * (rebuilds the mesh) — call it for presets, not for per-frame slider drags.
     */
    applyPreset(patch: Partial<typeof params>) {
      Object.assign(params, patch);
      bakeRamps();
      syncShapeUniforms();
      buildFlower();
    },
    /** Show/hide the stem + leaves (/demo hides it on the single-petal card). */
    setStemVisible(show: boolean) {
      if (stemParams.show === show) return;
      stemParams.show = show;
      buildStem();
    },
    bloomMax: params.bloomMax,
    dispose() {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      gui.destroy();
      tabsCleanup?.();
      if (tabsContainer) tabsContainer.replaceChildren();
      controls.dispose();
      flower?.geometry.dispose();
      stemGroup?.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      stemMat.dispose();
      leafMat.dispose();
      mat.dispose();
      rampTex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

export type FlowerSceneApi = ReturnType<typeof createFlowerScene>;
