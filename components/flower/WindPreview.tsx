"use client";

import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { FlowerDesignState } from "./flowerScene";

// Only the parameters the demo visualises — a narrow prop keeps the parent's
// memoisation simple (unrelated wind params don't re-render this).
type WindState = Pick<
  FlowerDesignState["wind"],
  "windAmp" | "windSpeed" | "windHeading"
>;

const DEFAULT_CAMERA_POSITION = new THREE.Vector3(1.35, 1.05, 1.35);
const DEFAULT_CONTROLS_TARGET = new THREE.Vector3(0, 0.3, 0);
const STALK_HEIGHT = 0.62;
const STALK_POINTS = 8;
// Matches the flower shader's wind block scale so the demo sways like the
// petals do at the same settings, just on grass-like stalks.
const SWAY_SCALE = 1.35;
const STREAK_COUNT = 26;
const STREAK_RANGE = 1.3;

// JS port of the vertex shader's hash3/vnoise/turb so the demo's gusts and
// waves move exactly like the flower's petals.
function hash3(x: number, y: number, z: number) {
  let px = (x * 0.3183099 + 0.1) % 1;
  let py = (y * 0.3183099 + 0.2) % 1;
  let pz = (z * 0.3183099 + 0.3) % 1;
  if (px < 0) px += 1;
  if (py < 0) py += 1;
  if (pz < 0) pz += 1;
  px *= 17;
  py *= 17;
  pz *= 17;
  const v = px * py * pz * (px + py + pz);
  return v - Math.floor(v);
}

function vnoise(x: number, y: number, z: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  let fx = x - ix;
  let fy = y - iy;
  let fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  return mix(
    mix(
      mix(hash3(ix, iy, iz), hash3(ix + 1, iy, iz), fx),
      mix(hash3(ix, iy + 1, iz), hash3(ix + 1, iy + 1, iz), fx),
      fy,
    ),
    mix(
      mix(hash3(ix, iy, iz + 1), hash3(ix + 1, iy, iz + 1), fx),
      mix(hash3(ix, iy + 1, iz + 1), hash3(ix + 1, iy + 1, iz + 1), fx),
      fy,
    ),
    fz,
  );
}

function turb(x: number, y: number, z: number) {
  return vnoise(x, y, z) * 0.65 + vnoise(x * 2.3, y * 2.3, z * 2.3) * 0.35;
}

type Streak = {
  along: number;
  side: number;
  y: number;
};

// Fixed stalk bases: one centre stalk plus two rings inside the ground disc.
function stalkBases() {
  const bases: { x: number; z: number; seed: number }[] = [
    { x: 0, z: 0, seed: 0.37 },
  ];
  [
    { radius: 0.34, count: 6 },
    { radius: 0.66, count: 11 },
  ].forEach(({ radius, count }, ring) => {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + ring * 0.45;
      bases.push({
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        seed: ring * 3.1 + i * 0.73 + 0.11,
      });
    }
  });
  return bases;
}

export default function WindPreview({
  wind,
  resetViewKey,
}: {
  wind: WindState;
  resetViewKey?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const windRef = useRef<WindState>(wind);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);

  useEffect(() => {
    windRef.current = wind;
  }, [wind]);

  const resetPreviewView = useCallback(() => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    camera.position.copy(DEFAULT_CAMERA_POSITION);
    controls.target.copy(DEFAULT_CONTROLS_TARGET);
    controls.update();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    host.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 20);
    camera.position.copy(DEFAULT_CAMERA_POSITION);
    const controls = new OrbitControls(camera, renderer.domElement);
    // Damping lags the drag and coasts on release; zoom hijacks page scroll
    // when the pointer passes over the box — both unwanted for a tiny preview.
    controls.enableDamping = false;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minDistance = 0.9;
    controls.maxDistance = 3.6;
    controls.target.copy(DEFAULT_CONTROLS_TARGET);
    cameraRef.current = camera;
    controlsRef.current = controls;

    const ground = new THREE.PolarGridHelper(0.92, 8, 3, 48, 0x2a3ba8, 0x1d2a74);
    (ground.material as THREE.LineBasicMaterial).transparent = true;
    (ground.material as THREE.LineBasicMaterial).opacity = 0.5;
    scene.add(ground);

    // Direction arrow lies on the ground plane, matching the shader's
    // wdir = (cos(heading), 0, sin(heading)).
    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0.015, 0),
      0.55,
      0xffb347,
      0.16,
      0.095,
    );
    scene.add(arrow);

    const bases = stalkBases();
    const segmentsPerStalk = STALK_POINTS - 1;
    const stalkVertexCount = bases.length * segmentsPerStalk * 2;
    const stalkPositions = new Float32Array(stalkVertexCount * 3);
    const stalkColors = new Float32Array(stalkVertexCount * 3);
    {
      // Cold base -> pale tip, echoing the flower's rim palette.
      const base = new THREE.Color(0.3, 0.42, 0.86);
      const tip = new THREE.Color(0.9, 0.95, 1.0);
      const mixed = new THREE.Color();
      let c = 0;
      for (let i = 0; i < bases.length; i++) {
        for (let j = 0; j < segmentsPerStalk; j++) {
          for (const frac of [j / segmentsPerStalk, (j + 1) / segmentsPerStalk]) {
            mixed.copy(base).lerp(tip, frac);
            stalkColors[c++] = mixed.r;
            stalkColors[c++] = mixed.g;
            stalkColors[c++] = mixed.b;
          }
        }
      }
    }
    const stalkGeometry = new THREE.BufferGeometry();
    stalkGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(stalkPositions, 3),
    );
    stalkGeometry.setAttribute(
      "color",
      new THREE.BufferAttribute(stalkColors, 3),
    );
    const stalkMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
    });
    const stalks = new THREE.LineSegments(stalkGeometry, stalkMaterial);
    scene.add(stalks);

    // Airflow streaks: short dashes drifting along the wind direction. Their
    // pace follows Wind Speed and their visibility follows Wind Strength.
    const streaks: Streak[] = Array.from({ length: STREAK_COUNT }, () => ({
      along: (Math.random() * 2 - 1) * STREAK_RANGE,
      side: (Math.random() * 2 - 1) * 0.85,
      y: 0.12 + Math.random() * 0.66,
    }));
    const streakPositions = new Float32Array(STREAK_COUNT * 2 * 3);
    const streakGeometry = new THREE.BufferGeometry();
    streakGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(streakPositions, 3),
    );
    const streakMaterial = new THREE.LineBasicMaterial({
      color: 0x9fc2ff,
      transparent: true,
      opacity: 0.55,
    });
    const streakLines = new THREE.LineSegments(streakGeometry, streakMaterial);
    scene.add(streakLines);

    const resize = () => {
      const rect = host.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const startTime = performance.now();
    const windDir = new THREE.Vector3();
    const windPerp = new THREE.Vector3();
    let raf = 0;
    let lastTime = 0;

    const render = () => {
      const { windAmp, windSpeed, windHeading } = windRef.current;
      const t = (performance.now() - startTime) / 1000;
      const dt = Math.min(t - lastTime, 0.1);
      lastTime = t;

      const heading = (windHeading * Math.PI) / 180;
      windDir.set(Math.cos(heading), 0, Math.sin(heading));
      windPerp.set(-Math.sin(heading), 0, Math.cos(heading));
      arrow.setDirection(windDir);

      // Same maths as the shader wind block: a travelling wave along the wind
      // direction, amplitude gated by a slow per-stalk gust.
      let p = 0;
      for (const stalkBase of bases) {
        const seed = stalkBase.seed;
        const gust = turb(t * windSpeed * 0.13, seed * 0.31, 0);
        let prevX = 0;
        let prevY = 0;
        let prevZ = 0;
        for (let j = 0; j < STALK_POINTS; j++) {
          const frac = j / segmentsPerStalk;
          const y = frac * STALK_HEIGHT;
          const phase =
            (stalkBase.x * windDir.x + y * windDir.y + stalkBase.z * windDir.z) *
              2.2 -
            t * windSpeed * 1.4;
          const wave = (turb(phase * 0.55, y * 1.3, seed * 0.7) - 0.5) * 2;
          const amp =
            windAmp * SWAY_SCALE * frac * frac * (0.35 + 0.65 * gust);
          const x = stalkBase.x + windDir.x * amp * wave;
          const z = stalkBase.z + windDir.z * amp * wave;
          const yOut =
            y + amp * 0.4 * (turb(phase * 0.4 + 7, seed, 1) - 0.5);
          if (j > 0) {
            stalkPositions[p++] = prevX;
            stalkPositions[p++] = prevY;
            stalkPositions[p++] = prevZ;
            stalkPositions[p++] = x;
            stalkPositions[p++] = yOut;
            stalkPositions[p++] = z;
          }
          prevX = x;
          prevY = yOut;
          prevZ = z;
        }
      }
      stalkGeometry.attributes.position.needsUpdate = true;

      const streakLen = 0.05 + 0.06 * windSpeed;
      let s = 0;
      for (const streak of streaks) {
        streak.along += dt * windSpeed * 0.55;
        if (streak.along > STREAK_RANGE) {
          streak.along = -STREAK_RANGE;
          streak.side = (Math.random() * 2 - 1) * 0.85;
          streak.y = 0.12 + Math.random() * 0.66;
        }
        const hx = windDir.x * streak.along + windPerp.x * streak.side;
        const hz = windDir.z * streak.along + windPerp.z * streak.side;
        streakPositions[s++] = hx - windDir.x * streakLen;
        streakPositions[s++] = streak.y;
        streakPositions[s++] = hz - windDir.z * streakLen;
        streakPositions[s++] = hx;
        streakPositions[s++] = streak.y;
        streakPositions[s++] = hz;
      }
      streakGeometry.attributes.position.needsUpdate = true;
      streakMaterial.opacity = Math.min(0.14 + windAmp * 1.5, 0.85);

      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.remove(ground, arrow, stalks, streakLines);
      ground.dispose();
      arrow.dispose();
      stalkGeometry.dispose();
      stalkMaterial.dispose();
      streakGeometry.dispose();
      streakMaterial.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, []);

  useEffect(() => {
    resetPreviewView();
  }, [resetPreviewView, resetViewKey]);

  return (
    <div
      className="studio-petal-preview studio-wind-preview"
      aria-label="Wind motion preview"
    >
      <div ref={hostRef} className="studio-petal-preview-canvas" />
    </div>
  );
}
