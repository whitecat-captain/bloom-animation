"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { PetalShapeState } from "./flowerScene";

const STEM_WIDTH = 0.03;
const STEM_END = 0.04;

function catmullRom(pts: number[], t: number) {
  const n = pts.length - 1;
  const f = Math.min(t * n, n - 1e-6);
  const i = Math.floor(f);
  const s = f - i;
  const p0 = pts[Math.max(i - 1, 0)];
  const p1 = pts[i];
  const p2 = pts[i + 1];
  const p3 = pts[Math.min(i + 2, n)];
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * s +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * s * s +
      (-p0 + 3 * p1 - 3 * p2 + p3) * s * s * s)
  );
}

function widthAt(shape: PetalShapeState, v: number) {
  const widthPts = [STEM_WIDTH, shape.w0, shape.w1, shape.w2, shape.w3, 0.002];
  if (v < STEM_END) return STEM_WIDTH;
  return Math.max(catmullRom(widthPts, (v - STEM_END) / (1 - STEM_END)), 0.002);
}

function petalPoint(shape: PetalShapeState, u01: number, v: number) {
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

function makePetalGeometry(shape: PetalShapeState) {
  const xSegments = 28;
  const ySegments = 72;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let y = 0; y <= ySegments; y++) {
    const v = y / ySegments;
    for (let x = 0; x <= xSegments; x++) {
      const u = x / xSegments;
      const p = petalPoint(shape, u, v);
      positions.push(p.x, p.y, p.z);
      uvs.push(u, v);
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

  const geo = new THREE.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  geo.center();
  return geo;
}

export default function PetalShapePreview({
  shape,
}: {
  shape: PetalShapeState;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);

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
    camera.position.set(0.7, 0.5, 1.65);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 0.75;
    controls.maxDistance = 3.2;
    controls.target.set(0, 0, 0);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x5c4b8a, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 2.8);
    key.position.set(1.5, 2.2, 1.4);
    scene.add(key);

    const material = new THREE.MeshStandardMaterial({
      color: 0xf2a55f,
      emissive: 0x281006,
      emissiveIntensity: 0.08,
      roughness: 0.54,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    mesh.rotation.x = -0.25;
    meshRef.current = mesh;
    scene.add(mesh);

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

    let raf = 0;
    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };
    render();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      controls.dispose();
      scene.remove(mesh);
      mesh.geometry.dispose();
      material.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      meshRef.current = null;
    };
  }, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const previous = mesh.geometry;
    mesh.geometry = makePetalGeometry(shape);
    previous.dispose();
  }, [shape]);

  return (
    <div className="studio-petal-preview" aria-label="3D petal shape preview">
      <div ref={hostRef} className="studio-petal-preview-canvas" />
    </div>
  );
}
