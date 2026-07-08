"use client";

import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { startVisibilityGatedLoop } from "./visibilityLoop";
import type { PetalShapeState } from "./flowerScene";
import { petalWidthAt } from "./petalProfile";

const STEM_WIDTH = 0.03;
const STEM_END = 0.04;
const DEFAULT_CAMERA_POSITION = new THREE.Vector3(0.76, 0.55, 1.9);
const DEFAULT_CONTROLS_TARGET = new THREE.Vector3(0, 0, 0);
type PaletteStops = [number, number, number][];

function widthAt(shape: PetalShapeState, v: number) {
  return petalWidthAt(
    {
      stemWidth: STEM_WIDTH,
      stemEnd: STEM_END,
      points: [
        { v: shape.v0, width: shape.w0 },
        { v: shape.v1, width: shape.w1 },
        { v: shape.v2, width: shape.w2 },
        { v: shape.v3, width: shape.w3 },
        { v: shape.v4, width: shape.w4 },
      ],
    },
    v,
  );
}

function mixStop(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
) {
  const k = Math.min(Math.max(t, 0), 1);
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ] as [number, number, number];
}

function previewColorAt(palette: PaletteStops, v: number) {
  const cold = palette[1] ?? palette[0] ?? [0.2, 0.45, 0.9];
  const rim = palette[0] ?? cold;
  const base = palette[2] ?? cold;
  if (v < 0.22) return mixStop(base, cold, v / 0.22);
  return mixStop(cold, rim, (v - 0.22) / 0.78);
}

function petalPoint(
  shape: PetalShapeState,
  u01: number,
  v: number,
) {
  const u = u01 * 2 - 1;
  const steps = 32;
  const ds = v / steps;
  let ang = 0;
  const spine = new THREE.Vector2();

  for (let i = 0; i < steps; i++) {
    const s = (i + 0.5) * ds;
    const density =
      shape.curlBias * Math.pow(Math.max(s, 1e-4), shape.curlBias - 1);
    ang += shape.curlOpen * density * ds;
    spine.x += Math.cos(ang) * ds;
    spine.y += Math.sin(ang) * ds;
  }

  spine.multiplyScalar(shape.petalLen);

  const width = widthAt(shape, v) * (1 + shape.asym * u);
  const x = u * width;
  let zLocal = -shape.cup * (1 - u * u) * width;
  zLocal +=
    shape.waveAmp * u * u * Math.sin(v * 11 + u * 2.3);

  const sideAngle = shape.sideCurl * x;
  const cos = Math.cos(sideAngle);
  const sin = Math.sin(sideAngle);
  const rolledX = cos * x - sin * zLocal;
  const rolledZ = sin * x + cos * zLocal;
  const normalDir = new THREE.Vector3(0, -Math.sin(ang), Math.cos(ang));

  return new THREE.Vector3(
    rolledX,
    spine.x + normalDir.y * rolledZ,
    spine.y + normalDir.z * rolledZ,
  );
}

function makePetalPreviewGeometry(shape: PetalShapeState, palette: PaletteStops) {
  const xSegments = 28;
  const ySegments = 72;
  const positions: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const guidePositions: number[] = [];
  const addGuide = (points: THREE.Vector3[]) => {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      guidePositions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  };

  for (let y = 0; y <= ySegments; y++) {
    const v = y / ySegments;
    for (let x = 0; x <= xSegments; x++) {
      const u = x / xSegments;
      const p = petalPoint(shape, u, v);
      const color = previewColorAt(palette, v);
      positions.push(p.x, p.y, p.z);
      uvs.push(u, v);
      colors.push(color[0], color[1], color[2]);
    }
  }

  const row = xSegments + 1;
  for (let y = 0; y < ySegments; y++) {
    for (let x = 0; x < xSegments; x++) {
      const a = y * row + x;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  addGuide(
    Array.from({ length: 38 }, (_, i) =>
      petalPoint(shape, 0.5, i / 37),
    ),
  );
  [0.18, 0.36, 0.54, 0.72, 0.9].forEach((v) => {
    addGuide(
      Array.from({ length: 25 }, (_, i) =>
        petalPoint(shape, i / 24, v),
      ),
    );
  });

  const surface = new THREE.BufferGeometry();
  surface.setIndex(indices);
  surface.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  surface.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  surface.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  surface.computeVertexNormals();

  const guides = new THREE.BufferGeometry();
  guides.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(guidePositions, 3),
  );

  surface.computeBoundingBox();
  const center =
    surface.boundingBox?.getCenter(new THREE.Vector3()) ?? new THREE.Vector3();
  surface.translate(-center.x, -center.y, -center.z);
  guides.translate(-center.x, -center.y, -center.z);
  return { surface, guides };
}

export default function PetalShapePreview({
  shape,
  palette,
  resetViewKey,
}: {
  shape: PetalShapeState;
  palette: PaletteStops;
  resetViewKey?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const openMeshRef = useRef<THREE.Mesh | null>(null);
  const openGuideRef = useRef<THREE.LineSegments | null>(null);

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
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
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
    controls.minDistance = 0.75;
    controls.maxDistance = 3.2;
    controls.target.copy(DEFAULT_CONTROLS_TARGET);
    cameraRef.current = camera;
    controlsRef.current = controls;

    scene.add(new THREE.HemisphereLight(0xffd6a8, 0x1b2554, 0.75));
    const key = new THREE.DirectionalLight(0xfff0d6, 3.7);
    key.position.set(-1.8, 2.0, 1.1);
    scene.add(key);
    const side = new THREE.DirectionalLight(0x6fb7ff, 1.35);
    side.position.set(1.8, 0.15, 0.9);
    scene.add(side);
    const rim = new THREE.DirectionalLight(0xffffff, 2.15);
    rim.position.set(0.2, 1.0, -2.0);
    scene.add(rim);

    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      emissive: 0x050714,
      emissiveIntensity: 0.02,
      roughness: 0.86,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    const guideMaterial = new THREE.LineBasicMaterial({
      color: 0x3b1e14,
      transparent: true,
      opacity: 0.44,
    });
    const openMesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    const openGuide = new THREE.LineSegments(new THREE.BufferGeometry(), guideMaterial);
    [openMesh, openGuide].forEach((object) => {
      object.rotation.x = -0.25;
      scene.add(object);
    });
    openMeshRef.current = openMesh;
    openGuideRef.current = openGuide;

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

    // Render only while the box is on screen — a collapsed folder must not
    // keep a WebGL context spinning at full frame rate.
    const stopLoop = startVisibilityGatedLoop(host, () => {
      controls.update();
      renderer.render(scene, camera);
    });

    return () => {
      stopLoop();
      ro.disconnect();
      controls.dispose();
      scene.remove(openMesh, openGuide);
      openMesh.geometry.dispose();
      openGuide.geometry.dispose();
      material.dispose();
      guideMaterial.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      cameraRef.current = null;
      controlsRef.current = null;
      openMeshRef.current = null;
      openGuideRef.current = null;
    };
  }, []);

  useEffect(() => {
    resetPreviewView();
  }, [resetPreviewView, resetViewKey]);

  useEffect(() => {
    const openMesh = openMeshRef.current;
    const openGuide = openGuideRef.current;
    if (!openMesh || !openGuide) return;

    const open = makePetalPreviewGeometry(shape, palette);
    const previous = [
      openMesh.geometry,
      openGuide.geometry,
    ];
    openMesh.geometry = open.surface;
    openGuide.geometry = open.guides;
    previous.forEach((geo) => geo.dispose());
  }, [shape, palette]);

  return (
    <div className="studio-petal-preview" aria-label="3D petal shape preview">
      <div ref={hostRef} className="studio-petal-preview-canvas" />
    </div>
  );
}
