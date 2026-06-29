import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

/**
 * Non-interactive "dreamy photography" demo of the phyllotaxis flower:
 * milky translucent petals, heavy bloom and a hazy gradient background.
 * Geometry + vertex deformation are reused from flowerScene.ts;
 * everything else (material, post-processing, animation) is demo-specific.
 */
export function createDreamyScene(container: HTMLElement) {
  const params = {
    numPetals: 36,
    goldenAngle: 137.5,
    radius: 0.14,
    radiusBias: 1.15,
    height: 0.13,
    heightBias: 1.2,
    scaleInner: 0.5,
    tiltInner: 0.08,
    outAngle: 68,
    tiltBias: 2.2,
    transition: 0.35,
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
    jitter: 0.04,
    noiseAmp: 0.045,
    noiseFreq: 5.0,
    windAmp: 0.07,
    windSpeed: 0.45,
    windHeading: 35,
    shellGap: 0.14,
  };

  // ===== ramp texture (R=width, G=curlDensity) — same bake as flowerScene =====
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
  {
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

  const uniforms = {
    uRamps: { value: rampTex },
    uBloom: { value: 0.68 },
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
  };

  // Vertex shader is identical to flowerScene.ts — same petal deformation.
  const vert = /* glsl */ `
attribute float aU;
attribute float aSeed;
attribute float aTilt;
uniform sampler2D uRamps;
uniform float uBloom, uTransition, uCurlClosed, uCurlOpen, uPropagation;
uniform float uLength, uCup, uSideCurl, uWaveAmp, uWaveFreq, uAsym;
uniform float uTime, uNoiseAmp, uNoiseFreq, uWindAmp, uWindSpeed, uWindHeading;
uniform float uShellGap;

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
    * (1.0 + 0.35 * wrap);
  float x = u * width;
  float zl = -uCup * (1.0 + 0.5 * wrap) * (1.0 - u * u) * width;
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

  // Milky translucent petals: warm glowing core, cool whitish rims,
  // soft edge fade so overlap reads as haze instead of hard silhouettes.
  const frag = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalW;
varying float vU;
void main() {
  float u = vUv.x * 2.0 - 1.0;
  float closeness = (1.0 - vUv.y) * 0.7 + (1.0 - vU) * 0.3;

  vec3 ice    = vec3(0.74, 0.86, 1.00);
  vec3 milk   = vec3(0.52, 0.72, 1.00);
  vec3 sky    = vec3(0.28, 0.52, 0.98);
  vec3 deep   = vec3(0.10, 0.26, 0.85);
  vec3 ember  = vec3(1.00, 0.62, 0.25);

  vec3 col = mix(ice, milk, smoothstep(0.0, 0.4, closeness));
  col = mix(col, sky, smoothstep(0.35, 0.62, closeness));
  col = mix(col, deep, smoothstep(0.55, 0.85, closeness));
  // hot golden core (like the original flower) pushes past the bloom threshold
  col = mix(col, ember, smoothstep(0.68, 0.9, closeness));
  col += ember * smoothstep(0.74, 1.0, closeness) * 1.2;

  vec3 n = normalize(vNormalW) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 ld = normalize(vec3(0.4, 0.85, 0.55));
  float lit = 0.7 + 0.3 * max(dot(n, ld), 0.0);
  float trans = max(dot(-n, ld), 0.0);
  vec3 transCol = mix(vec3(0.45, 0.7, 1.0), vec3(1.0, 0.62, 0.35), smoothstep(0.6, 1.0, closeness));
  col += transCol * trans * trans * 0.6;
  if (!gl_FrontFacing) lit *= 0.94;

  float edge = 1.0 - smoothstep(0.45, 1.0, abs(u));
  float tip = 1.0 - smoothstep(0.55, 1.0, vUv.y);
  float alpha = (0.38 + 0.5 * tip) * (0.35 + 0.65 * edge);

  gl_FragColor = vec4(col * lit * 0.82, alpha);
}`;

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
  });

  const width = container.clientWidth;
  const height = container.clientHeight;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, width / height, 0.01, 100);
  camera.position.set(0.8, 2.4, 2.4);
  camera.lookAt(0, 0.5, 0);

  // ===== soft blue backdrop (fullscreen quad behind everything) =====
  // A muted dusty/periwinkle blue with only a hint of vertical gradient and a
  // very faint central lift, so the milky flower reads against an even field.
  const bgMat = new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}`,
    fragmentShader: /* glsl */ `
varying vec2 vUv;
uniform float uTime;
void main() {
  // Solid #2B60E2 blue (linear, since OutputPass converts linear->sRGB) with a
  // barely-there vertical gradient and a faint central halo behind the flower.
  vec3 base = vec3(0.0241, 0.1170, 0.7606);
  vec3 col = base * mix(0.9, 1.08, smoothstep(0.0, 1.0, vUv.y));
  float glow = exp(-dot(vUv - vec2(0.5, 0.52), vUv - vec2(0.5, 0.52)) * 5.0);
  glow *= 0.9 + 0.1 * sin(uTime * 0.35);
  col += base * glow * 0.18;
  gl_FragColor = vec4(col, 1.0);
}`,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
  bg.frustumCulled = false;
  bg.renderOrder = -1;
  scene.add(bg);

  const flowerGroup = new THREE.Group();
  flowerGroup.position.y = 0.45;
  flowerGroup.scale.setScalar(1.3);
  scene.add(flowerGroup);

  // ===== instanced petals — same layout as flowerScene.buildFlower =====
  const n = params.numPetals;
  const geo = new THREE.PlaneGeometry(1, 1, 24, 64);
  geo.deleteAttribute("normal");
  const aU = new Float32Array(n),
    aSeed = new Float32Array(n),
    aTilt = new Float32Array(n);
  const flower = new THREE.InstancedMesh(geo, mat, n);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) : 0;
    const a = (params.goldenAngle * i * Math.PI) / 180;
    const h1 = Math.sin(i * 127.1) * 0.5 + 0.5;
    const h2 = Math.sin(i * 311.7) * 0.5 + 0.5;
    const h3 = Math.sin(i * 74.3) * 0.5 + 0.5;
    const j = params.jitter * (0.3 + 0.7 * u);
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
    aSeed[i] = ((i * 0.618) % 1) * 20;
  }
  geo.setAttribute("aU", new THREE.InstancedBufferAttribute(aU, 1));
  geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(aSeed, 1));
  geo.setAttribute("aTilt", new THREE.InstancedBufferAttribute(aTilt, 1));
  flowerGroup.add(flower);

  // ===== post-processing: bloom -> grain/vignette -> output =====
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(width, height),
    0.45, // strength
    0.7, // radius
    0.78, // threshold — only the hottest petal highlights halo
  );
  composer.addPass(bloomPass);

  const gradePass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
    },
    vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  // gentle lift so blacks sit in a hazy blue-grey, like film
  c.rgb = c.rgb * 0.97 + vec3(0.012, 0.014, 0.02);
  float d = distance(vUv, vec2(0.5));
  c.rgb *= 1.0 - smoothstep(0.45, 0.95, d) * 0.35;
  gl_FragColor = c;
}`,
  });
  composer.addPass(gradePass);
  composer.addPass(new OutputPass());

  // ===== resize + render loop =====
  let pendingResize: { w: number; h: number } | null = null;
  const ro = new ResizeObserver(() => {
    const w = container.clientWidth,
      h = container.clientHeight;
    if (w && h) pendingResize = { w, h };
  });
  ro.observe(container);

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    if (pendingResize) {
      const { w, h } = pendingResize;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
      pendingResize = null;
    }
    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;
    bgMat.uniforms.uTime.value = t;
    // slow turntable + breathing bloom, no user interaction
    flowerGroup.rotation.y = t * 0.06;
    uniforms.uBloom.value = 0.62 + 0.1 * Math.sin(t * 0.22);
    composer.render();
  });

  return {
    dispose() {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      composer.dispose();
      bloomPass.dispose();
      geo.dispose();
      mat.dispose();
      bgMat.dispose();
      bg.geometry.dispose();
      rampTex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
