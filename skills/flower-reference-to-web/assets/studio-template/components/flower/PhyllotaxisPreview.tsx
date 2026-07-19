"use client";

import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { FlowerDesignState } from "./flowerScene";
import { startVisibilityGatedLoop } from "./visibilityLoop";

type LayoutState = FlowerDesignState["phyllotaxis"];
type PaletteStops = [number, number, number][];

const DEFAULT_CAMERA_POSITION = new THREE.Vector3(0.85, 1.25, 0.85);
const DEFAULT_CONTROLS_TARGET = new THREE.Vector3(0, 0.18, 0);
// Proxy petals are shorter than the real ones so the arrangement — not the
// petal shape — stays the focus of this demo.
const PETAL_LENGTH = 0.52;
const PETAL_WIDTH = 0.11;

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

function makePetalProxyGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(PETAL_WIDTH, PETAL_LENGTH * 0.42, 0, PETAL_LENGTH);
  shape.quadraticCurveTo(-PETAL_WIDTH, PETAL_LENGTH * 0.42, 0, 0);
  return new THREE.ShapeGeometry(shape, 12);
}

export default function PhyllotaxisPreview({
  layout,
  palette,
  resetViewKey,
}: {
  layout: LayoutState;
  palette: PaletteStops;
  resetViewKey?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const geometryRef = useRef<THREE.BufferGeometry | null>(null);
  const materialRef = useRef<THREE.Material | null>(null);
  const drawRef = useRef<(() => void) | null>(null);

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
    controls.minDistance = 0.7;
    controls.maxDistance = 3.6;
    controls.target.copy(DEFAULT_CONTROLS_TARGET);
    cameraRef.current = camera;
    controlsRef.current = controls;

    const ground = new THREE.PolarGridHelper(0.9, 8, 3, 48, 0x2a3ba8, 0x1d2a74);
    (ground.material as THREE.LineBasicMaterial).transparent = true;
    (ground.material as THREE.LineBasicMaterial).opacity = 0.4;
    ground.position.y = -0.02;
    scene.add(ground);

    scene.add(new THREE.HemisphereLight(0xffd6a8, 0x1b2554, 0.9));
    const key = new THREE.DirectionalLight(0xfff0d6, 2.6);
    key.position.set(-1.4, 2.2, 1.0);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x6fb7ff, 1.4);
    rim.position.set(1.4, 0.6, -1.4);
    scene.add(rim);

    const geometry = makePetalProxyGeometry();
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    sceneRef.current = scene;
    geometryRef.current = geometry;
    materialRef.current = material;

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

    drawRef.current = () => renderer.render(scene, camera);

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
      const mesh = meshRef.current;
      if (mesh) {
        scene.remove(mesh);
        mesh.dispose();
      }
      scene.remove(ground);
      ground.dispose();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      meshRef.current = null;
      geometryRef.current = null;
      materialRef.current = null;
      drawRef.current = null;
    };
  }, []);

  useEffect(() => {
    resetPreviewView();
  }, [resetPreviewView, resetViewKey]);

  // Same placement maths as flowerScene's buildFlower (spiral path, no
  // jitter): golden-angle spiral over a dome, inner petals smaller and more
  // upright, outer ones larger and leaning out.
  useEffect(() => {
    const scene = sceneRef.current;
    const geometry = geometryRef.current;
    const material = materialRef.current;
    if (!scene || !geometry || !material) return;

    const previous = meshRef.current;
    if (previous) {
      scene.remove(previous);
      previous.dispose();
    }

    const n = Math.max(1, Math.round(layout.numPetals));
    const mesh = new THREE.InstancedMesh(geometry, material, n);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const core = palette[2] ?? [0.9, 0.93, 1.0];
    const rimStop = palette[1] ?? palette[0] ?? [0.2, 0.45, 0.9];

    for (let i = 0; i < n; i++) {
      const u = n > 1 ? i / (n - 1) : 0;
      const a = (layout.goldenAngle * i * Math.PI) / 180;
      const r = layout.radius * Math.pow(u, layout.radiusBias);
      const y = layout.height * Math.pow(u, layout.heightBias);
      const tilt =
        layout.tiltInner +
        ((layout.outAngle * Math.PI) / 180) * Math.pow(u, layout.tiltBias);
      dummy.position.set(Math.sin(a) * r, layout.height - y, Math.cos(a) * r);
      dummy.rotation.set(-tilt, a + Math.PI, 0, "YXZ");
      dummy.scale.setScalar(layout.scaleInner + (1 - layout.scaleInner) * u);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      const stop = mixStop(core, rimStop, u);
      mesh.setColorAt(i, color.setRGB(stop[0], stop[1], stop[2]));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    scene.add(mesh);
    meshRef.current = mesh;
    // Draw immediately so the rebuild shows even between rAF frames.
    drawRef.current?.();
  }, [layout, palette]);

  return (
    <div
      className="studio-petal-preview studio-phyllotaxis-preview"
      aria-label="Petal arrangement preview"
    >
      <div ref={hostRef} className="studio-petal-preview-canvas" />
    </div>
  );
}
