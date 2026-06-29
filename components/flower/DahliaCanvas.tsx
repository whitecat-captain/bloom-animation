"use client";

import { useEffect, useRef, useState } from "react";
import { createFlowerScene, type FlowerSceneApi } from "./flowerScene";

// ============================================================================
// Scarlet ball-dahlia showcase.
//
// Reuses the phyllotaxis flower engine (createFlowerScene) unchanged and only
// drives it through its public API: a one-shot preset that reshapes the generic
// flower into this specific bloom, a scarlet colour ramp, and per-card sliders
// that each isolate one observed trait of the photographed dahlia.
//
// Read off the photo (a red decorative / ball dahlia):
//   • Petals are broad & ovate — narrow base, widest mid-length, rounded tip.
//   • Each petal is cupped along its midrib and its edges roll inward, forming
//     the little spoon/quill that gives ball dahlias their honeycombed face.
//   • Dozens of petals stack on a domed receptacle into a near-spherical head,
//     tight furled centre to recurving outer ring — a golden-angle spiral.
//   • Colour is monochromatic scarlet: bright coral where light grazes the tips,
//     deepening to crimson/maroon in the shaded throat.
// ============================================================================

// Base width control points [base, lower, upper, tip] — broad ovate profile
// with a blunt, rounded tip (dahlia ray petals are broad scales, not spikes).
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
  // centre furled and the dome upright, so only the outermost rings drop. The
  // bloom still GROWS outward (not deflates) thanks to wrapWidth/wrapCup/shellGap.
  outAngle: 112,
  tiltBias: 2.9,
  petalLen: 0.82, // long enough to overlap like shingles and drape at the rim
  curlClosed: 1.85, // furl into a small bud without spiking the tips
  curlOpen: 0.18, // open nearly flat with only a slight forward cup (not conical)
  curlBias: 2.3,
  propagation: 1.2,
  w0: DAHLIA_WIDTHS[0],
  w1: DAHLIA_WIDTHS[1],
  w2: DAHLIA_WIDTHS[2],
  w3: DAHLIA_WIDTHS[3],
  cup: 0.5, // shallow concave scale, not a deep cone
  sideCurl: 0.45, // gentle edge roll -> rounded scale, not a quill point
  // Keep the furled bud compact: little extra width/cup while closed, and a
  // small inter-shell gap, so the head opens up rather than shrinking down.
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

// Five-stop ramp, cold rim (petal tip / outer ring) -> hot core (base / centre).
const DAHLIA_PALETTE: [number, number, number][] = [
  [1.0, 0.46, 0.34], // bright coral highlight on the tips
  [0.97, 0.22, 0.18], // scarlet
  [0.85, 0.1, 0.13], // pure red petal face
  [0.55, 0.04, 0.1], // crimson shadow
  [0.3, 0.02, 0.07], // deep maroon furled throat
];

const CARDS = [
  { id: "petal", no: "01", title: "阔卵形花瓣", sub: "Broad ovate petals" },
  { id: "quill", no: "02", title: "内卷如匙", sub: "Involute spoons" },
  { id: "spiral", no: "03", title: "黄金角螺旋", sub: "Golden-angle spiral" },
  { id: "bloom", no: "04", title: "绽放波前", sub: "Bloom wavefront" },
  { id: "wind", no: "05", title: "风与生气", sub: "Wind & life" },
] as const;

const GOLDEN_ANGLES = [90, 120, 137.5, 144] as const;

export default function DahliaCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const guiRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FlowerSceneApi | null>(null);

  const [active, setActive] = useState(0);
  const [showCards, setShowCards] = useState(true);

  // Persistent petal-count rail (mirrors /social).
  const [instances, setInstances] = useState(DAHLIA_PRESET.numPetals);
  // Per-trait controls — initial values match the preset so the mount-time
  // effects below are no-ops, not overrides.
  const [breadth, setBreadth] = useState(1); // petal-width multiplier
  const [tipCurl, setTipCurl] = useState(DAHLIA_PRESET.curlOpen); // curlOpen
  const [cup, setCup] = useState(DAHLIA_PRESET.cup);
  const [roll, setRoll] = useState(DAHLIA_PRESET.sideCurl);
  const [spiral, setSpiral] = useState(true);
  const [angle, setAngle] = useState(137.5);
  const [bloom, setBloom] = useState(1); // fraction of bloomMax
  const [transition, setTransition] = useState(0.35);
  const [windAmp, setWindAmp] = useState(DAHLIA_PRESET.windAmp);
  const [windSpeed, setWindSpeed] = useState(DAHLIA_PRESET.windSpeed);

  const n = CARDS.length;
  const go = (dir: 1 | -1) => setActive((a) => (a + dir + n) % n);

  // ---- boot the scene, apply the dahlia look, auto-bloom once ----
  useEffect(() => {
    if (!canvasRef.current || !guiRef.current) return;
    const scene = createFlowerScene(canvasRef.current, guiRef.current);
    sceneRef.current = scene;

    scene.applyPreset(DAHLIA_PRESET);
    scene.setPalette(DAHLIA_PALETTE);
    // Frame the bloom nearly side-on (slightly above), like the reference photo,
    // so the recurving outer petals that droop down the sides are visible.
    scene.setCameraView([0.3, 2.5, 3.95]);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) scene.setBloom(scene.bloomMax);
    else scene.playBloom();

    // ⌘/Ctrl + wheel dollies the camera; plain wheel is left alone.
    const zoomWithModifierScroll = (event: WheelEvent) => {
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      scene.zoomBy(event.deltaY);
    };
    window.addEventListener("wheel", zoomWithModifierScroll, {
      capture: true,
      passive: false,
    });

    return () => {
      window.removeEventListener("wheel", zoomWithModifierScroll, true);
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // ---- live bindings: each control drives one scene uniform/layout ----
  useEffect(() => {
    sceneRef.current?.setPetalWidths(DAHLIA_WIDTHS.map((w) => w * breadth));
  }, [breadth]);
  useEffect(() => void sceneRef.current?.setCurlOpen(tipCurl), [tipCurl]);
  useEffect(() => void sceneRef.current?.setCup(cup), [cup]);
  useEffect(() => void sceneRef.current?.setSideCurl(roll), [roll]);
  useEffect(() => void sceneRef.current?.setNumPetals(instances), [instances]);
  useEffect(() => void sceneRef.current?.setOutwardPush(spiral), [spiral]);
  useEffect(() => void sceneRef.current?.setGoldenAngle(angle), [angle]);
  useEffect(() => void sceneRef.current?.setTransition(transition), [transition]);
  useEffect(() => void sceneRef.current?.setWindAmp(windAmp), [windAmp]);
  useEffect(() => void sceneRef.current?.setWindSpeed(windSpeed), [windSpeed]);
  useEffect(() => {
    const s = sceneRef.current;
    if (s) s.setBloom(bloom * s.bloomMax);
  }, [bloom]);

  // Only the spiral card may switch to the concentric layout; every other card
  // forces the natural golden spiral back so it never gets stuck "mechanical".
  useEffect(() => {
    if (CARDS[active].id !== "spiral") {
      setSpiral(true);
      setAngle(137.5);
    }
  }, [active]);

  return (
    <div
      className={`app-container social dahlia social--stack${
        showCards ? "" : " social--bloom"
      }`}
    >
      <div ref={canvasRef} className="canvas-container" />
      <div className="social-bounds" aria-hidden="true" />

      {/* masthead — names the subject, echoes the /social editorial chrome */}
      <header className="dahlia-masthead" aria-hidden="true">
        <span className="dahlia-kicker">Phyllotaxis Atlas · No.06</span>
        <h1 className="dahlia-name">Scarlet Dahlia</h1>
        <span className="dahlia-latin">Dahlia × · ball form</span>
      </header>

      {/* one analysis card at a time, lower region */}
      <div className="social-stack">
        {CARDS.map((card, i) => (
          <article
            key={card.id}
            className="step-card social-card liquid-glass"
            data-active={i === active}
            style={{ zIndex: i === active ? 2 : 1 }}
            aria-hidden={i !== active}
          >
            <span className="step-no">{card.no} · {card.sub}</span>
            <h2>{card.title}</h2>
            <div className="dahlia-controls">{renderControls(card.id)}</div>
          </article>
        ))}
      </div>

      {/* side navigation arrows (in the letterbox, off the 9:16 frame) */}
      <button
        type="button"
        className="social-arrow social-arrow--prev liquid-glass-strong"
        aria-label="Previous"
        onClick={() => go(-1)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <button
        type="button"
        className="social-arrow social-arrow--next liquid-glass-strong"
        aria-label="Next"
        onClick={() => go(1)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>

      {/* pagination dots */}
      <div className="social-dots" role="tablist" aria-label="Traits">
        {CARDS.map((card, i) => (
          <button
            key={card.id}
            type="button"
            className="social-dot"
            data-active={i === active}
            role="tab"
            aria-selected={i === active}
            aria-label={card.sub}
            onClick={() => setActive(i)}
          />
        ))}
      </div>

      {/* replay control — only shown in Bloom mode */}
      <button
        type="button"
        className="social-bloom-btn liquid-glass-strong"
        aria-label="Replay bloom"
        onClick={() => sceneRef.current?.playBloom()}
      >
        <svg className="bloom-btn-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
        <span>Bloom</span>
      </button>

      {/* persistent petal-count rail (left letterbox) */}
      <div className="social-railbar">
        <span className="social-railbar-val">{instances}</span>
        <input
          type="range"
          min={1}
          max={150}
          step={1}
          value={instances}
          onChange={(e) => setInstances(Number(e.target.value))}
          aria-label="Petals"
        />
        <span className="social-railbar-label">Petals</span>
      </div>

      {/* deck / bloom toggle */}
      <button
        type="button"
        className="social-switch"
        aria-label="Toggle deck / bloom"
        onClick={() => setShowCards((v) => !v)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9h13l-3.5 -3.5 M20 15H7l3.5 3.5" />
        </svg>
      </button>

      {/* hidden lil-gui plumbing kept off-screen (engine mounts into it) */}
      <div className="gui-container collapsed" aria-hidden="true">
        <div className="gui-tabs" />
        <div ref={guiRef} className="gui-scroll" />
      </div>
    </div>
  );

  // ---- per-card control bodies ----
  function renderControls(id: (typeof CARDS)[number]["id"]) {
    switch (id) {
      case "petal":
        return (
          <>
            <p className="dahlia-note">
              基部窄、中段最宽、先端圆收 —— 四个宽度控制点经样条勾出阔卵形轮廓。
            </p>
            <Slider
              name="宽度 Breadth"
              value={breadth}
              min={0.5}
              max={1.5}
              step={0.01}
              onChange={setBreadth}
            />
            <Slider
              name="尖端 Tip curl"
              value={tipCurl}
              min={-0.6}
              max={0.8}
              step={0.01}
              onChange={setTipCurl}
            />
          </>
        );
      case "quill":
        return (
          <>
            <p className="dahlia-note">
              花瓣沿中脉杯起、边缘内卷成匙状小管 —— 球状大丽花的标志性蜂窝面。
            </p>
            <Slider
              name="杯度 Cup"
              value={cup}
              min={0}
              max={1.3}
              step={0.01}
              onChange={setCup}
            />
            <Slider
              name="内卷 Roll"
              value={roll}
              min={0}
              max={2.2}
              step={0.01}
              onChange={setRoll}
            />
          </>
        );
      case "spiral":
        return (
          <>
            <p className="dahlia-note">
              花瓣按 137.5° 黄金角发散，幂律半径堆成穹顶。换角或退化成同心环，立现辐条与空隙。
            </p>
            <div className="demo-chips">
              {GOLDEN_ANGLES.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`demo-chip${
                    spiral && angle === a ? " active" : ""
                  }`}
                  onClick={() => {
                    setSpiral(true);
                    setAngle(a);
                  }}
                >
                  {a}°
                </button>
              ))}
              <button
                type="button"
                className={`demo-chip${!spiral ? " active" : ""}`}
                onClick={() => setSpiral(false)}
              >
                同心环 Rings
              </button>
            </div>
          </>
        );
      case "bloom":
        return (
          <>
            <p className="dahlia-note">
              一个 0→1 的数字像波一样从外圈扫向花心 —— 每片花瓣按位置延迟开放。
            </p>
            <Slider
              name="绽放 Bloom"
              value={bloom}
              min={0}
              max={1}
              step={0.01}
              onChange={setBloom}
            />
            <Slider
              name="波前 Wavefront"
              value={transition}
              min={0.05}
              max={1}
              step={0.01}
              onChange={setTransition}
            />
          </>
        );
      case "wind":
        return (
          <>
            <p className="dahlia-note">
              值噪声给整朵花一阵随高度加权的阵风，每片花瓣各带种子，没有两片动得一样。
            </p>
            <Slider
              name="风力 Amplitude"
              value={windAmp}
              min={0}
              max={0.4}
              step={0.005}
              onChange={setWindAmp}
            />
            <Slider
              name="风速 Speed"
              value={windSpeed}
              min={0}
              max={3}
              step={0.05}
              onChange={setWindSpeed}
            />
          </>
        );
    }
  }
}

function Slider({
  name,
  value,
  min,
  max,
  step,
  onChange,
}: {
  name: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="demo-slider">
      <span className="demo-slider-name">{name}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="demo-slider-val">{value.toFixed(2)}</span>
    </label>
  );
}
