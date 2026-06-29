"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/**
 * Optional linkage to the live 3D flower (the /social showcase). A demo fires
 * `onSync` with the flower params it controls while it is the `active` card, so
 * its on-screen controls drive the real bloom. Omitted on the landing page,
 * where the demos are purely illustrative.
 */
export type FlowerSync = Partial<{
  goldenAngle: number;
  numPetals: number;
  stableLayout: boolean;
  outwardPush: boolean; // false → concentric-ring layout on the live flower
  curl: number;
  widths: number[];
  bloom: number; // 0..1 dial; the scene scales it to its bloom limit
  transition: number;
  windAmp: number;
  windSpeed: number;
}>;
export type DemoSyncProps = {
  active?: boolean;
  onSync?: (s: FlowerSync) => void;
  /** WavefrontDemo only: start paused & fully open instead of auto-playing. */
  autoPlay?: boolean;
  /** InstancingDemo only: externally controlled instance count (+ setter), so
   *  an off-frame control bar and the in-card slider share one value. */
  count?: number;
  onCount?: (n: number) => void;
};

/* ===== palette — mirrors the fragment shader's 5-stop ramp ===== */
const RAMP = [
  [13, 51, 166], // outer, cold
  [38, 140, 242],
  [217, 235, 255],
  [255, 184, 0],
  [255, 64, 0], // core, hot
];
/** t = 0 (outer, cold) → 1 (core, hot) */
function rampRGB(t: number) {
  const x = Math.min(Math.max(t, 0), 1) * (RAMP.length - 1);
  const i = Math.min(Math.floor(x), RAMP.length - 2);
  const f = x - i;
  return RAMP[i].map((v, k) => Math.round(v + (RAMP[i + 1][k] - v) * f));
}
function ramp(t: number, alpha = 1) {
  const c = rampRGB(t);
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}
/** lerp two rgb triples → rgba string */
function mix3(a: number[], b: number[], t: number, alpha = 1) {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

const GOLDEN = 137.5;

/** shared petal silhouette (figs. 3 & 4), drawn from base at origin, tip at -L */
function tracePetal(ctx: CanvasRenderingContext2D, L: number) {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(L * 0.32, -L * 0.25, L * 0.34, -L * 0.62, 0, -L);
  ctx.bezierCurveTo(-L * 0.34, -L * 0.62, -L * 0.32, -L * 0.25, 0, 0);
}

/* ===== math ported from flowerScene.ts so demos stay faithful ===== */
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

/** openness(s) from the vertex shader: base opens first, tip follows */
function openness(s: number, bloomLocal: number, prop = 1.2) {
  const p = Math.min(Math.max(bloomLocal * (1 + prop) - s * prop, 0), 1);
  return p * p * (3 - 2 * p);
}

/* 1D two-octave value noise ≈ turb() in the shader */
function hash1(n: number) {
  const s = Math.sin(n) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise1(x: number) {
  const i = Math.floor(x),
    f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash1(i) + (hash1(i + 1) - hash1(i)) * u;
}
function turb1(x: number) {
  return vnoise1(x) * 0.65 + vnoise1(x * 2.3) * 0.35;
}

/* ===== canvas plumbing ===== */
type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

function useCanvas(draw: Draw, deps: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const render = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = cv.clientWidth,
        h = cv.clientHeight;
      if (!w || !h) return;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      const ctx = cv.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawRef.current(ctx, w, h);
    };
    render();
    const ro = new ResizeObserver(render);
    ro.observe(cv);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="demo-slider">
      <span className="demo-slider-name">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="demo-slider-val">
        {format ? format(value) : value.toFixed(2)}
      </span>
    </label>
  );
}

/** Restores a demo's controls to their defaults. */
function ResetChip({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="demo-chip demo-chip--reset"
      onClick={onClick}
      title="Reset to defaults"
    >
      ↺ Reset
    </button>
  );
}

/* =====================================================================
   The golden spiral — Vogel layout / divergence angle
===================================================================== */
const N_MAX = 220;
function concentricSpot(index: number, total: number) {
  let placed = 0;
  for (let ring = 0; placed < total; ring++) {
    const size = ring === 0 ? 1 : 6 * ring;
    if (index < placed + size) {
      const j = index - placed;
      const maxRing = Math.max(Math.ceil((Math.sqrt(12 * total - 3) - 3) / 6), 1);
      const u = ring / maxRing;
      return {
        u,
        ang: ring * 0.55 + (j / size) * Math.PI * 2,
      };
    }
    placed += size;
  }
  return { u: 1, ang: 0 };
}

export function PhyllotaxisDemo({ active, onSync }: DemoSyncProps = {}) {
  const [angle, setAngle] = useState(GOLDEN);
  const [count, setCount] = useState(N_MAX);
  // two behaviors, split apart: rotation always runs; the outward push is opt-in
  const [spread, setSpread] = useState(true);
  // guide line replaces the dots with the threading path — reads as a clean
  // circle / spiral. Off by default so the demo opens on the seed dots.
  const [guide, setGuide] = useState(false);
  // intro grow runs once on mount, then the slider drives the count directly
  const [intro, setIntro] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const raf = requestAnimationFrame(() => setIntro(1));
      return () => cancelAnimationFrame(raf);
    }
    let raf = 0;
    const t0 = performance.now();
    const loop = (t: number) => {
      const p = Math.min((t - t0) / 1800, 1);
      setIntro(1 - Math.pow(1 - p, 3));
      if (p < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  // drive the live flower: divergence angle + petal count + arrangement
  useEffect(() => {
    if (active)
      onSync?.({
        goldenAngle: angle,
        numPetals: count,
        stableLayout: true,
        outwardPush: spread,
      });
  }, [active, onSync, angle, count, spread]);

  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2,
        cy = h / 2;
      const maxR = Math.min(w, h) / 2 - 12;
      // seed i always lands in the same spot; raising the count just reveals
      // more of the spiral, growing outward from the center.
      const n = Math.max(Math.floor(count * intro), 1);

      // OFF → concentric rings (centre, then 6, 12, 18 …), mirroring the live
      // flower's deliberately "mechanical" layout — even and ring-by-ring.
      if (!spread) {
        for (let i = 0; i < n; i++) {
          const { u, ang } = concentricSpot(i, N_MAX);
          const r = maxR * u;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r, 1.8 + 3.4 * u, 0, Math.PI * 2);
          ctx.fillStyle = ramp(1 - u, 0.92);
          ctx.fill();
        }
        return;
      }

      // ON → phyllotaxis spiral: r ∝ √t pushes each seed outward.
      const radiusAt = (t: number) => maxR * Math.sqrt(t / (N_MAX - 1));

      // guide line ON → show ONLY the threading path (dots hidden) so the
      // spiral reads cleanly; OFF → show the seed dots instead.
      if (guide && n > 1) {
        ctx.beginPath();
        const steps = (n - 1) * 12;
        for (let s = 0; s <= steps; s++) {
          const t = (s / steps) * (n - 1);
          const a = (t * angle * Math.PI) / 180;
          const r = radiusAt(t);
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        for (let i = 0; i < n; i++) {
          const f = i / (N_MAX - 1); // fixed scale so points hold their place
          const a = (i * angle * Math.PI) / 180;
          const r = radiusAt(i);
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.8 + 3.4 * f, 0, Math.PI * 2);
          ctx.fillStyle = ramp(1 - f, 0.92);
          ctx.fill();
        }
      }
    },
    [angle, count, spread, guide, intro],
  );

  const isGolden = Math.abs(angle - GOLDEN) < 0.05;
  return (
    <div className="demo">
      <canvas ref={ref} className="demo-canvas" />
      <div className="demo-controls">
        <Slider
          label="seeds"
          min={1}
          max={N_MAX}
          step={1}
          value={count}
          onChange={setCount}
          format={(v) => `${Math.round(v)}`}
        />
        <div className="demo-chips">
          <button
            type="button"
            className={`demo-chip${spread ? " active" : ""}`}
            onClick={() => setSpread((s) => !s)}
            aria-pressed={spread}
          >
            outward push: {spread ? "on" : "off"}
          </button>
          <button
            type="button"
            className={`demo-chip${guide ? " active" : ""}`}
            onClick={() => setGuide((g) => !g)}
            aria-pressed={guide}
          >
            guide line: {guide ? "on" : "off"}
          </button>
          {[90, 120, 137.5, 144, 160].map((v) => (
            <button
              key={v}
              type="button"
              className={`demo-chip${angle === v ? " active" : ""}`}
              onClick={() => setAngle(v)}
            >
              {v === GOLDEN ? "137.5° ★" : `${v}°`}
            </button>
          ))}
          <ResetChip
            onClick={() => {
              setAngle(GOLDEN);
              setCount(N_MAX);
              setSpread(true);
              setGuide(false);
            }}
          />
        </div>
        <p className="demo-note">
          {!spread
            ? "Rotation only — without the outward push every seed lands on the same circle. No spiral, just a ring."
            : isGolden
              ? "Two steps per seed: rotate one golden angle, then push outward. Together they wind the spiral from the center out."
              : "Rational angles collapse into spokes and waste space. Try 137.5°."}
        </p>
      </div>
    </div>
  );
}

/* =====================================================================
   Building one petal:
     ① shape — a Catmull-Rom width ramp swept along the length (drag dots)
     ② curl  — the same outline rolled up as curvature integrates the spine
===================================================================== */
const PETAL_BIAS = 2.3; // curvature concentrates toward the tip
const PETAL_STEM_END = 0.04;
const PETAL_STEM_W = 0.03;
const PETAL_TIP_W = 0.002;
const W_MIN = 0.02;
const W_MAX = 0.42;
const DEF_WIDTHS = [0.16, 0.28, 0.3, 0.2];
// Keep the curl in the "gently cupped petal" range — past ~2 the tip rolls
// over into a comma/hook and stops reading as a petal.
const DEF_CURL = 1.1;
const CURL_MAX = 2;

type PetalHandle = { x: number; y: number; k: number };
type PetalLayout = { leftCx: number; wscale: number };
type Pt = [number, number];

/** half-width of the silhouette at length v∈[0,1] from the 4 control widths */
function petalHalfWidth(v: number, widths: number[]) {
  if (v < PETAL_STEM_END) return PETAL_STEM_W;
  const pts = [PETAL_STEM_W, ...widths, PETAL_TIP_W];
  return Math.max(
    catmullRom(pts, (v - PETAL_STEM_END) / (1 - PETAL_STEM_END)),
    0.002,
  );
}

/** integrate a unit-length spine (y-up) and its two edges for the given curl */
function buildPetalGeometry(widths: number[], curl: number, N = 64) {
  let ang = Math.PI / 2; // base points up (+y)
  let x = 0,
    y = 0;
  const ds = 1 / N;
  const spine: Pt[] = [[x, y]];
  const samples: { p: Pt; a: number; v: number }[] = [{ p: [0, 0], a: ang, v: 0 }];
  for (let i = 0; i < N; i++) {
    const s = (i + 0.5) / N;
    // density = d/ds of s^bias — curvature piles up near the tip
    const density = PETAL_BIAS * Math.pow(Math.max(s, 1e-4), PETAL_BIAS - 1);
    ang += curl * density * ds; // integrate curvature → heading
    x += Math.cos(ang) * ds;
    y += Math.sin(ang) * ds;
    spine.push([x, y]);
    samples.push({ p: [x, y], a: ang, v: (i + 1) / N });
  }
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (const { p, a, v } of samples) {
    const hw = petalHalfWidth(v, widths);
    const nx = -Math.sin(a),
      ny = Math.cos(a); // unit normal to the spine
    right.push([p[0] + nx * hw, p[1] + ny * hw]);
    left.push([p[0] - nx * hw, p[1] - ny * hw]);
  }
  return { spine, left, right };
}

/** fit a y-up point cloud into a screen rect (y-down), preserving aspect */
function fitToRect(pts: Pt[], rect: { x: number; y: number; w: number; h: number }, padPx: number) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const [px, py] of pts) {
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  const bw = Math.max(maxX - minX, 1e-3),
    bh = Math.max(maxY - minY, 1e-3);
  const s = Math.min((rect.w - 2 * padPx) / bw, (rect.h - 2 * padPx) / bh);
  const cxw = (minX + maxX) / 2,
    cyw = (minY + maxY) / 2;
  const cxs = rect.x + rect.w / 2,
    cys = rect.y + rect.h / 2;
  return ([px, py]: Pt): Pt => [cxs + (px - cxw) * s, cys - (py - cyw) * s];
}

function drawPetalLab(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  widths: number[],
  curl: number,
  handlesRef: { current: PetalHandle[] },
  layoutRef: { current: PetalLayout },
  dragIdx: number,
) {
  ctx.clearRect(0, 0, w, h);
  const pad = 12,
    colGap = 16;
  const colW = (w - pad * 2 - colGap) / 2;
  const top = 22,
    bottom = h - 18;
  const Lpx = bottom - top;
  ctx.font = "10px Outfit, sans-serif";

  // ---------- ① flat shape ----------
  const leftCx = pad + colW * 0.5;
  const wscale = Math.min(Lpx * 0.9, (colW * 0.5 - 12) / W_MAX);
  layoutRef.current = { leftCx, wscale };

  const NS = 80;
  const rE: Pt[] = [],
    lE: Pt[] = [];
  for (let i = 0; i <= NS; i++) {
    const v = i / NS;
    const hw = petalHalfWidth(v, widths) * wscale;
    const yy = bottom - v * Lpx;
    rE.push([leftCx + hw, yy]);
    lE.push([leftCx - hw, yy]);
  }
  const g1 = ctx.createLinearGradient(0, bottom, 0, top);
  g1.addColorStop(0, "rgba(255,150,30,0.38)");
  g1.addColorStop(0.5, "rgba(120,190,255,0.32)");
  g1.addColorStop(1, "rgba(13,51,166,0.44)");
  ctx.beginPath();
  rE.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  for (let i = lE.length - 1; i >= 0; i--) ctx.lineTo(lE[i][0], lE[i][1]);
  ctx.closePath();
  ctx.fillStyle = g1;
  ctx.fill();
  ctx.strokeStyle = "rgba(143,211,255,0.45)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // straight midline (spine at curl 0) + base node
  ctx.beginPath();
  ctx.moveTo(leftCx, bottom);
  ctx.lineTo(leftCx, top);
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(leftCx, bottom, 3, 0, Math.PI * 2);
  ctx.fillStyle = "#ffb16e";
  ctx.fill();

  // draggable width control points (w0..w3)
  const handles: PetalHandle[] = [];
  for (let k = 0; k < widths.length; k++) {
    const v = PETAL_STEM_END + ((k + 1) / 5) * (1 - PETAL_STEM_END);
    const hx = leftCx + widths[k] * wscale,
      hy = bottom - v * Lpx;
    handles.push({ x: hx, y: hy, k });
    ctx.beginPath();
    ctx.moveTo(leftCx, hy);
    ctx.lineTo(hx, hy);
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.lineWidth = 1;
    ctx.stroke();
    const on = dragIdx === k;
    ctx.beginPath();
    ctx.arc(hx, hy, on ? 6 : 4.5, 0, Math.PI * 2);
    ctx.fillStyle = on ? "#fff" : "rgba(143,211,255,0.95)";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(0,9,27,0.55)";
    ctx.stroke();
  }
  handlesRef.current = handles;

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("① shape · drag dots", pad, 13);

  // ---------- ② curl ----------
  const rect = { x: pad + colW + colGap, y: top - 4, w: colW, h: Lpx + 8 };
  const geo = buildPetalGeometry(widths, curl);
  const map = fitToRect([...geo.left, ...geo.right], rect, 16);
  const r2 = geo.right.map(map),
    l2 = geo.left.map(map),
    sp = geo.spine.map(map);
  ctx.beginPath();
  r2.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  for (let i = l2.length - 1; i >= 0; i--) ctx.lineTo(l2[i][0], l2[i][1]);
  ctx.closePath();
  const g2 = ctx.createLinearGradient(sp[0][0], sp[0][1], sp[sp.length - 1][0], sp[sp.length - 1][1]);
  g2.addColorStop(0, "rgba(255,150,30,0.42)");
  g2.addColorStop(0.5, "rgba(120,190,255,0.36)");
  g2.addColorStop(1, "rgba(13,51,166,0.5)");
  ctx.fillStyle = g2;
  ctx.fill();
  ctx.strokeStyle = "rgba(143,211,255,0.55)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  sp.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.setLineDash([3, 4]);
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.arc(sp[0][0], sp[0][1], 3, 0, Math.PI * 2);
  ctx.fillStyle = "#ffb16e";
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText(`② curl · ${curl.toFixed(1)}`, rect.x, 13);
}

export function PetalCurlDemo({ active, onSync }: DemoSyncProps = {}) {
  const [widths, setWidths] = useState<number[]>([...DEF_WIDTHS]);
  const [curl, setCurl] = useState(DEF_CURL);

  // drive the live flower: petal curl + width ramp
  useEffect(() => {
    if (active) onSync?.({ curl, widths });
  }, [active, onSync, curl, widths]);
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ widths, curl });
  const handlesRef = useRef<PetalHandle[]>([]);
  const layoutRef = useRef<PetalLayout>({ leftCx: 0, wscale: 1 });
  const dragRef = useRef(-1);

  useEffect(() => {
    live.current = { widths, curl };
  }, [widths, curl]);

  const draw = () => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = cv.clientWidth,
      h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawPetalLab(
      ctx,
      w,
      h,
      live.current.widths,
      live.current.curl,
      handlesRef,
      layoutRef,
      dragRef.current,
    );
  };

  useEffect(() => {
    draw();
    const cv = ref.current;
    if (!cv) return;
    const ro = new ResizeObserver(draw);
    ro.observe(cv);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // redraw whenever the shape or curl changes
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widths, curl]);

  const onDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const cv = ref.current;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const px = e.clientX - r.left,
      py = e.clientY - r.top;
    let best = -1,
      bd = 16;
    for (const hh of handlesRef.current) {
      const d = Math.hypot(hh.x - px, hh.y - py);
      if (d < bd) {
        bd = d;
        best = hh.k;
      }
    }
    if (best >= 0) {
      dragRef.current = best;
      try {
        cv.setPointerCapture(e.pointerId);
      } catch {}
      draw();
    }
  };
  const onMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const k = dragRef.current;
    if (k < 0) return;
    const cv = ref.current;
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    const { leftCx, wscale } = layoutRef.current;
    const v = Math.max(W_MIN, Math.min(W_MAX, (e.clientX - r.left - leftCx) / wscale));
    setWidths((prev) => prev.map((p, i) => (i === k ? v : p)));
  };
  const onUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current >= 0) {
      dragRef.current = -1;
      try {
        ref.current?.releasePointerCapture(e.pointerId);
      } catch {}
      draw();
    }
  };

  return (
    <div className="demo">
      <canvas
        ref={ref}
        className="demo-canvas"
        style={{ touchAction: "none", cursor: "grab" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />
      <div className="demo-controls">
        <Slider label="curl" min={0} max={CURL_MAX} step={0.05} value={curl} onChange={setCurl} />
        <div className="demo-chips">
          <ResetChip
            onClick={() => {
              setWidths([...DEF_WIDTHS]);
              setCurl(DEF_CURL);
            }}
          />
        </div>
        <p className="demo-note">
          <strong>① shape</strong> — drag the dots to bend the width ramp.{" "}
          <strong>② curl</strong> — integrate curvature along the spine to roll the same outline up.
        </p>
      </div>
    </div>
  );
}

/* =====================================================================
   One master dial, a delayed copy per petal
   Left: top-view flower, each petal at its own local openness.
   Right: the delay curve linking the dial to every petal.
===================================================================== */
function drawWavefront(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bloom: number,
  width: number,
) {
  ctx.clearRect(0, 0, w, h);
  const n = 36;
  const p = -width + (1 + width) * bloom; // front position on the order axis
  const local = (order: number) =>
    1 - Math.min(Math.max((order - p) / width, 0), 1);
  const CLOSED = [52, 66, 96]; // desaturated slate = still a bud

  // ---- left: top-view flower ----
  const fs = Math.min(h, w * 0.45);
  const cx = fs / 2 + 6,
    cy = h / 2;
  const maxR = fs / 2 - 6;
  const L = maxR * 0.46;
  for (let i = n - 1; i >= 0; i--) {
    const u = n > 1 ? i / (n - 1) : 0;
    const order = 1 - u; // rim = 0, opens first
    const bl = local(order);
    const a = (i * GOLDEN * Math.PI) / 180;
    const r = Math.pow(u, 1.15) * (maxR - L);
    const s = (0.4 + 0.6 * bl) * (0.45 + 0.55 * u);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.translate(0, -r);
    ctx.scale(s, s);
    tracePetal(ctx, L);
    ctx.fillStyle = mix3(CLOSED, rampRGB(1 - u), bl, 0.35 + 0.45 * bl);
    ctx.fill();
    if (bl > 0.02 && bl < 0.98) {
      // mid-opening — the front is passing through this petal right now
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1.6 / s;
    } else {
      ctx.strokeStyle = mix3(CLOSED, rampRGB(1 - u), bl, 0.8);
      ctx.lineWidth = 1 / s;
    }
    ctx.stroke();
    ctx.restore();
  }

  // ---- right: delay curve (opening order → local openness) ----
  const gx0 = fs + 26,
    gx1 = w - 12;
  const gy0 = 20,
    gy1 = h - 26;
  const X = (q: number) => gx0 + q * (gx1 - gx0);
  const Y = (v: number) => gy1 - v * (gy1 - gy0);

  // the moving front, as a bright band
  const b0 = Math.max(p, 0),
    b1 = Math.min(p + width, 1);
  if (b1 > b0) {
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(X(b0), gy0, X(b1) - X(b0), gy1 - gy0);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = "10px Outfit, sans-serif";
    const lx = Math.min(Math.max((X(b0) + X(b1)) / 2 - 16, gx0), gx1 - 40);
    ctx.fillText("front →", lx, gy0 - 7);
  }

  // axes
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(gx0, gy0 - 4);
  ctx.lineTo(gx0, gy1);
  ctx.lineTo(gx1, gy1);
  ctx.stroke();

  // openness curve + soft fill underneath
  ctx.beginPath();
  ctx.moveTo(X(0), Y(local(0)));
  for (let k = 1; k <= 60; k++) {
    const q = k / 60;
    ctx.lineTo(X(q), Y(local(q)));
  }
  ctx.strokeStyle = "#8fd3ff";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.lineTo(X(1), gy1);
  ctx.lineTo(X(0), gy1);
  ctx.closePath();
  ctx.fillStyle = "rgba(143,211,255,0.08)";
  ctx.fill();

  // one dot per petal riding the curve, colored like its petal on the left
  for (let i = 0; i < n; i++) {
    const u = n > 1 ? i / (n - 1) : 0;
    const order = 1 - u;
    const bl = local(order);
    ctx.beginPath();
    ctx.arc(X(order), Y(bl), 2.2, 0, Math.PI * 2);
    ctx.fillStyle =
      bl > 0.02 && bl < 0.98 ? "rgba(255,255,255,0.95)" : ramp(1 - u, 0.9);
    ctx.fill();
  }

  // labels
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.font = "10px Outfit, sans-serif";
  ctx.fillText("rim · opens first", gx0, h - 8);
  const tail = "core · opens last";
  ctx.fillText(tail, gx1 - ctx.measureText(tail).width, h - 8);
  ctx.fillText("open", gx0 + 6, gy0 + 6);
  ctx.fillText("closed", gx0 + 6, gy1 - 6);
}

export function WavefrontDemo({
  active,
  onSync,
  autoPlay = true,
}: DemoSyncProps = {}) {
  const [bloom, setBloom] = useState(autoPlay ? 0 : 1);
  const [trans, setTrans] = useState(0.35);
  const [playing, setPlaying] = useState(autoPlay);

  // drive the live flower: the master dial blooms it, front width sets the sweep
  useEffect(() => {
    if (active) onSync?.({ bloom, transition: trans });
  }, [active, onSync, bloom, trans]);
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ bloom: 0, trans: 0.35, playing: true });
  const phase = useRef(0);

  useEffect(() => {
    live.current = { bloom, trans, playing };
  }, [bloom, trans, playing]);

  useEffect(() => {
    let reducedMotionFrame = 0;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      phase.current = 0.55;
      reducedMotionFrame = requestAnimationFrame(() => {
        setBloom(0.55);
        setPlaying(false);
      });
    }
    const cv = ref.current;
    if (!cv) return;
    const c2d = cv.getContext("2d");
    if (!c2d) return;
    let raf = 0;
    let last = performance.now();
    const render = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = cv.clientWidth,
        h = cv.clientHeight;
      if (!w || !h) return;
      if (
        cv.width !== Math.round(w * dpr) ||
        cv.height !== Math.round(h * dpr)
      ) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }
      c2d.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawWavefront(c2d, w, h, live.current.bloom, live.current.trans);
    };
    const loop = (t: number) => {
      const dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      if (live.current.playing) {
        // sweep the dial 0→1 in ~4s, hold a beat at full bloom, loop
        phase.current = (phase.current + dt / 4.2) % 1.16;
        setBloom(Math.min(phase.current, 1));
      }
      render();
      raf = requestAnimationFrame(loop);
    };
    render(); // first frame synchronously — rAF may be paused in hidden tabs
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(reducedMotionFrame);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div className="demo">
      <canvas ref={ref} className="demo-canvas" />
      <div className="demo-controls">
        <div className="demo-chips">
          <button
            type="button"
            className={`demo-chip demo-chip--play${playing ? " active" : ""}`}
            onClick={() => setPlaying((v) => !v)}
          >
            {playing ? "❚❚ pause" : "▶ play"}
          </button>
          <ResetChip
            onClick={() => {
              phase.current = 0;
              setTrans(0.35);
              setBloom(0);
              setPlaying(true);
            }}
          />
        </div>
        <Slider
          label="master dial"
          min={0}
          max={1}
          step={0.01}
          value={bloom}
          onChange={(v) => {
            setPlaying(false);
            phase.current = v;
            setBloom(v);
          }}
        />
        <Slider
          label="front width"
          min={0.05}
          max={1}
          step={0.01}
          value={trans}
          onChange={setTrans}
        />
        <p className="demo-note">
          One dial in — every petal computes its own delayed copy.
          White ring = the front is passing through that petal right now.
        </p>
      </div>
    </div>
  );
}

/* =====================================================================
   Instancing — one silhouette stamped n times
===================================================================== */
export function InstancingDemo({
  active,
  onSync,
  count,
  onCount,
}: DemoSyncProps = {}) {
  // controlled when count/onCount are supplied (so an off-frame bar and the
  // in-card slider share one value); otherwise self-contained (landing page).
  const [internalN, setInternalN] = useState(36);
  const n = count ?? internalN;
  const setN = (v: number) => (onCount ? onCount(v) : setInternalN(v));

  // drive the live flower: instance count = petal count
  useEffect(() => {
    if (active) onSync?.({ numPetals: n });
  }, [active, onSync, n]);

  const ref = useCanvas(
    (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2,
        cy = h / 2;
      const maxR = Math.min(w, h) / 2 - 6;
      const L = maxR * 0.46;
      for (let i = n - 1; i >= 0; i--) {
        const u = n > 1 ? i / (n - 1) : 0;
        const a = (i * GOLDEN * Math.PI) / 180;
        const r = Math.pow(u, 1.15) * (maxR - L);
        const s = 0.45 + 0.55 * u;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(a);
        ctx.translate(0, -r);
        ctx.scale(s, s);
        tracePetal(ctx, L);
        ctx.fillStyle = ramp(1 - u, 0.5);
        ctx.fill();
        ctx.strokeStyle = ramp(1 - u, 0.9);
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
    },
    [n],
  );

  return (
    <div className="demo">
      <canvas ref={ref} className="demo-canvas" />
      <div className="demo-controls">
        <Slider
          label="instances"
          min={1}
          max={150}
          step={1}
          value={n}
          onChange={setN}
          format={(v) => `${v}`}
        />
        <div className="demo-chips">
          <ResetChip onClick={() => setN(36)} />
        </div>
        <p className="demo-note">
          1 geometry · {n} instances · <strong>1 draw call</strong>
        </p>
      </div>
    </div>
  );
}

/* =====================================================================
   Wind & imperfection — value-noise wind field
===================================================================== */
export function WindDemo({ active, onSync }: DemoSyncProps = {}) {
  const [amp, setAmp] = useState(0.5);
  const [speed, setSpeed] = useState(1);
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ amp, speed });

  // drive the live flower: wind amplitude (scaled to the scene range) + speed
  useEffect(() => {
    if (active) onSync?.({ windAmp: amp * 0.5, windSpeed: speed });
  }, [active, onSync, amp, speed]);

  useEffect(() => {
    live.current = { amp, speed };
  }, [amp, speed]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let raf = 0;
    const draw = (tms: number) => {
      const t = tms / 1000;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = cv.clientWidth,
        h = cv.clientHeight;
      if (w && h) {
        if (cv.width !== Math.round(w * dpr)) {
          cv.width = Math.round(w * dpr);
          cv.height = Math.round(h * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);
        const { amp, speed } = live.current;
        const n = 28,
          margin = 24,
          base = h - 18,
          len = h * 0.66;
        for (let k = 0; k < n; k++) {
          const u = k / (n - 1);
          const x0 = margin + u * (w - margin * 2);
          const phase = x0 * 0.04 - t * speed * 1.4;
          const gust = turb1(t * speed * 0.13 + k * 0.31);
          const wave = (turb1(phase * 0.55 + k * 0.7) - 0.5) * 2;
          const off = amp * 40 * (0.35 + 0.65 * gust) * wave;
          ctx.beginPath();
          const segs = 12;
          for (let i = 0; i <= segs; i++) {
            const s = i / segs;
            const px = x0 + off * s * s; // uv.y² weighting, like the shader
            const py = base - len * s;
            if (i) ctx.lineTo(px, py);
            else ctx.moveTo(px, py);
          }
          ctx.lineWidth = 2;
          ctx.lineCap = "round";
          ctx.strokeStyle = ramp(1 - u, 0.8);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x0 + off, base - len, 2.4, 0, Math.PI * 2);
          ctx.fillStyle = ramp(1 - u, 1);
          ctx.fill();
        }
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="demo">
      <canvas ref={ref} className="demo-canvas" />
      <div className="demo-controls">
        <Slider label="wind amp" min={0} max={1} step={0.01} value={amp} onChange={setAmp} />
        <Slider label="wind speed" min={0} max={3} step={0.05} value={speed} onChange={setSpeed} />
        <div className="demo-chips">
          <ResetChip
            onClick={() => {
              setAmp(0.5);
              setSpeed(1);
            }}
          />
        </div>
        <p className="demo-note">
          Each stalk reads a drifting noise field, seeded differently — so no two
          ever sway alike.
        </p>
      </div>
    </div>
  );
}
