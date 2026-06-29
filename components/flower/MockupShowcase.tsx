"use client";

import { useEffect, useRef, useState } from "react";
import { createFlowerScene, type FlowerSceneApi } from "./flowerScene";

/* palette mirrors the fragment shader's ramp (cold rim → hot core) */
const RAMP = [
  [13, 51, 166],
  [38, 140, 242],
  [217, 235, 255],
  [255, 184, 0],
  [255, 64, 0],
];
function ramp(t: number, alpha = 1) {
  const x = Math.min(Math.max(t, 0), 1) * (RAMP.length - 1);
  const i = Math.min(Math.floor(x), RAMP.length - 2);
  const f = x - i;
  const c = RAMP[i].map((v, k) => Math.round(v + (RAMP[i + 1][k] - v) * f));
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

/** Vogel spiral scatter — the static "math" centrepiece of the mockup. */
function SpiralFigure({ angle }: { angle: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

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
      ctx.clearRect(0, 0, w, h);
      const N = 220;
      const cx = w / 2,
        cy = h / 2;
      const maxR = Math.min(w, h) / 2 - 3;
      for (let i = 0; i < N; i++) {
        const f = i / (N - 1);
        const a = (i * angle * Math.PI) / 180;
        const r = maxR * Math.sqrt(f); // Vogel: r ∝ √i for even density
        ctx.beginPath();
        ctx.arc(
          cx + Math.cos(a) * r,
          cy + Math.sin(a) * r,
          0.8 + 1.9 * f,
          0,
          Math.PI * 2,
        );
        ctx.fillStyle = ramp(1 - f, 0.92);
        ctx.fill();
      }
    };
    render();
    const ro = new ResizeObserver(render);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [angle]);

  return <canvas ref={ref} className="fig-canvas" />;
}

/**
 * Showcase used by /mockup: flower on the right, a stack of pill cards on
 * the left — title, a Vogel-spiral math figure, three tiny sliders. Built
 * for social media covers, so the math has to read in a static screenshot.
 */
export default function MockupShowcase() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const guiRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<FlowerSceneApi | null>(null);
  // Once the user grabs the bloom slider, the intro animation lets go.
  const bloomTouched = useRef(false);

  const [angle, setAngle] = useState(137.5);
  const [bloom, setBloom] = useState(78);
  const [petals, setPetals] = useState(36);

  useEffect(() => {
    if (!canvasRef.current || !guiRef.current) return;
    const api = createFlowerScene(canvasRef.current, guiRef.current);
    apiRef.current = api;

    // Cmd/Ctrl + scroll zooms the flower (matches the main story page).
    const zoomWithCommandScroll = (event: WheelEvent) => {
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      api.zoomBy(event.deltaY);
    };
    window.addEventListener("wheel", zoomWithCommandScroll, {
      capture: true,
      passive: false,
    });

    // Intro: ease the bloom open once, then leave camera and flower alone.
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const x = Math.min((now - t0) / 4500, 1);
      if (!bloomTouched.current) {
        api.setBloom(0.04 + (api.bloomMax - 0.04) * (1 - Math.pow(1 - x, 3)));
      }
      if (x < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("wheel", zoomWithCommandScroll, true);
      apiRef.current = null;
      api.dispose();
    };
  }, []);

  return (
    <div className="mock-stage">
      <div className="mock-laptop">
        <div className="mock-screen">
          <span className="mock-camera" />
          <div className="mock-display">
            <div ref={canvasRef} className="mock-canvas" />

            <div className="mock-pills">
              <div className="mock-pill mock-pill--fig">
                <SpiralFigure angle={angle} />
                <div className="fig-meta">
                  <span className="fig-label">Vogel spiral</span>
                  <span className="fig-math">
                    θ<sub>i</sub>
                    {` = i × ${angle.toFixed(1)}°`}
                  </span>
                  <span className="fig-math">r ∝ √i</span>
                </div>
              </div>

              <label className="mock-pill mock-pill--ctl">
                <span className="ctl-name">Golden angle</span>
                <input
                  type="range"
                  min={90}
                  max={180}
                  step={0.1}
                  value={angle}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setAngle(v);
                    apiRef.current?.setGoldenAngle(v);
                  }}
                />
                <span className="ctl-val">{angle.toFixed(1)}°</span>
              </label>

              <label className="mock-pill mock-pill--ctl">
                <span className="ctl-name">Bloom</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={bloom}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    bloomTouched.current = true;
                    setBloom(v);
                    apiRef.current?.setBloom(v / 100);
                  }}
                />
                <span className="ctl-val">{bloom}%</span>
              </label>

              <label className="mock-pill mock-pill--ctl">
                <span className="ctl-name">Petals</span>
                <input
                  type="range"
                  min={5}
                  max={150}
                  step={1}
                  value={petals}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setPetals(v);
                    apiRef.current?.setNumPetals(v);
                  }}
                />
                <span className="ctl-val">{petals}</span>
              </label>
            </div>
          </div>
        </div>
        <div className="mock-base">
          <span className="mock-notch" />
        </div>
      </div>
      {/* lil-gui needs a mount point even though the mockup never shows it */}
      <div ref={guiRef} className="mock-gui-hidden" />
    </div>
  );
}
