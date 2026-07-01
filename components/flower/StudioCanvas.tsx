"use client";

import { Mouse, Move, Rotate3D } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  createFlowerScene,
  type FlowerSceneApi,
  type PetalShapeState,
} from "./flowerScene";
import {
  downloadBlob,
  exportPngSequence,
  exportPngStill,
  recordVideo,
  type Background,
} from "./flowerExport";
import PetalShapePreview from "./PetalShapePreview";
import {
  PanelButton,
  PanelActionRow,
  PanelChip,
  PanelField,
  PanelSection,
  PanelSegmented,
  PanelSelect,
  PanelSwitch,
} from "./StudioPanelControls";

type BgMode = "transparent" | "solid";
type Rgb = { r: number; g: number; b: number };
type Hsv = { h: number; s: number; v: number };
type Hsl = { h: number; s: number; l: number };
type ColorFormat = "hex" | "rgb" | "hsl";

// Resolutions are target heights; the width is derived from the live canvas
// aspect at export time so the output frames the flower exactly as previewed.
const RES_OPTIONS: { label: string; h: number }[] = [
  { label: "720p", h: 720 },
  { label: "1080p", h: 1080 },
  { label: "2K", h: 1440 },
  { label: "4K", h: 2160 },
];
const DEFAULT_RES = 1; // 1080p
const BG_OPTIONS: { label: string; value: BgMode }[] = [
  { label: "Solid", value: "solid" },
  { label: "Transparent", value: "transparent" },
];
const DEFAULT_PETAL_SHAPE: PetalShapeState = {
  petalLen: 0.95,
  w0: 0.16,
  w1: 0.28,
  w2: 0.3,
  w3: 0.2,
  curlOpen: -0.35,
  curlBias: 2.3,
  cup: 0.4,
  sideCurl: 0.45,
  waveAmp: 0.035,
  asym: 0.08,
};

// Palette-only starter looks (5 stops, cold rim -> hot core), applied instantly
// via scene.setPalette without rebuilding the mesh.
const PRESETS: { name: string; stops: [number, number, number][] }[] = [
  {
    name: "Aurora",
    stops: [
      [0.05, 0.2, 0.65],
      [0.15, 0.55, 0.95],
      [0.85, 0.92, 1.0],
      [1.0, 0.72, 0.0],
      [1.0, 0.25, 0.0],
    ],
  },
  {
    name: "Scarlet",
    stops: [
      [0.35, 0.0, 0.05],
      [0.85, 0.1, 0.12],
      [1.0, 0.85, 0.8],
      [1.0, 0.4, 0.1],
      [0.7, 0.0, 0.05],
    ],
  },
  {
    name: "Sunset",
    stops: [
      [0.4, 0.05, 0.35],
      [0.95, 0.35, 0.2],
      [1.0, 0.9, 0.6],
      [1.0, 0.55, 0.1],
      [0.85, 0.15, 0.25],
    ],
  },
  {
    name: "Moonlight",
    stops: [
      [0.1, 0.15, 0.35],
      [0.3, 0.45, 0.7],
      [0.95, 0.97, 1.0],
      [0.7, 0.85, 1.0],
      [0.4, 0.55, 0.9],
    ],
  },
];

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

function rgbToHex({ r, g, b }: Rgb) {
  const toHex = (n: number) =>
    Math.round(clamp(n, 0, 255)).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function hexToRgb(hex: string): Rgb | null {
  const raw = hex.replace("#", "").trim();
  if (!/^[\da-f]{6}$/i.test(raw)) return null;
  return {
    r: parseInt(raw.slice(0, 2), 16),
    g: parseInt(raw.slice(2, 4), 16),
    b: parseInt(raw.slice(4, 6), 16),
  };
}

function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;

  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return {
    h,
    s: max === 0 ? 0 : d / max,
    v: max,
  };
}

function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];

  return {
    r: (rp + m) * 255,
    g: (gp + m) * 255,
    b: (bp + m) * 255,
  };
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s, l };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];

  return {
    r: (rp + m) * 255,
    g: (gp + m) * 255,
    b: (bp + m) * 255,
  };
}

function formatColorValue(rgb: Rgb, format: ColorFormat) {
  if (format === "hex") return rgbToHex(rgb);
  if (format === "rgb") {
    return `${Math.round(rgb.r)} ${Math.round(rgb.g)} ${Math.round(rgb.b)}`;
  }
  const hsl = rgbToHsl(rgb);
  return `${Math.round(hsl.h)} ${Math.round(hsl.s * 100)}% ${Math.round(hsl.l * 100)}%`;
}

function parseColorValue(value: string, format: ColorFormat): Rgb | null {
  if (format === "hex") return hexToRgb(value);
  const nums = value.match(/-?\d*\.?\d+/g)?.map(Number) ?? [];
  if (format === "rgb") {
    if (nums.length < 3) return null;
    return {
      r: clamp(nums[0], 0, 255),
      g: clamp(nums[1], 0, 255),
      b: clamp(nums[2], 0, 255),
    };
  }
  if (nums.length < 3) return null;
  return hslToRgb({
    h: ((nums[0] % 360) + 360) % 360,
    s: clamp(nums[1], 0, 100) / 100,
    l: clamp(nums[2], 0, 100) / 100,
  });
}

export default function StudioCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const guiRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FlowerSceneApi | null>(null);
  const planeThumbRef = useRef<HTMLSpanElement>(null);
  const hueThumbRef = useRef<HTMLSpanElement>(null);
  const colorRef = useRef("#0b1020");
  const pendingColorRef = useRef<string | null>(null);
  const colorRafRef = useRef<number | null>(null);

  const [bgMode, setBgMode] = useState<BgMode>("solid");
  const [color, setColor] = useState("#0b1020");
  const [colorFormat, setColorFormat] = useState<ColorFormat>("hex");
  const [colorDraft, setColorDraft] = useState("#0B1020");
  // Aurora (index 0) is the scene's default palette, so it starts selected.
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [duration, setDuration] = useState(5);
  const [imageRes, setImageRes] = useState(DEFAULT_RES);
  const [videoRes, setVideoRes] = useState(DEFAULT_RES);
  const [showCameraFrame, setShowCameraFrame] = useState(false);
  const [activeDesignTab, setActiveDesignTab] = useState("Petal Geometry");
  const [petalShape, setPetalShape] = useState<PetalShapeState>(DEFAULT_PETAL_SHAPE);
  const [exporting, setExporting] = useState(false);
  const [exportKind, setExportKind] = useState<"image" | "video" | null>(null);
  const [progress, setProgress] = useState(0);

  // The Duration slider doubles as the preview: dragging it shows the flower at
  // the *final* frame of a d-second export, so you see how far the bloom gets
  // for that length (bloom runs over scene.bloomDuration regardless of total).
  // ▶ plays the whole bloom -> sway in real time. Same mapping the exporter
  // uses (bloomForTime), so the preview matches the output exactly.
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    colorRef.current = color;
  }, [color]);

  useEffect(
    () => () => {
      if (colorRafRef.current !== null) cancelAnimationFrame(colorRafRef.current);
    },
    [],
  );

  const previewEnd = (d: number) => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setBloom(scene.bloomAt(d / scene.bloomDuration));
  };

  const stopPlay = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPlaying(false);
  };

  const togglePlay = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (rafRef.current !== null) {
      stopPlay();
      return;
    }
    setPlaying(true);
    const start = performance.now();
    const tick = () => {
      const t = (performance.now() - start) / 1000;
      scene.setBloom(scene.bloomAt(t / scene.bloomDuration));
      if (t >= duration) {
        rafRef.current = null;
        setPlaying(false);
        previewEnd(duration); // settle on the export's final frame
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  // Stop playback if the duration changes.
  useEffect(() => {
    stopPlay();
  }, [duration]);

  // Clean up any running preview loop on unmount.
  useEffect(() => () => stopPlay(), []);

  // Boot the scene once. Same engine + designer panel as the story page, minus
  // all the scroll wiring — the flower just sits fully bloomed and orbitable.
  useEffect(() => {
    if (!canvasRef.current || !guiRef.current) return;
    const scene = createFlowerScene(
      canvasRef.current,
      guiRef.current,
      tabsRef.current,
      {
        onActiveDesignTabChange: setActiveDesignTab,
        onPetalShapeChange: setPetalShape,
      },
    );
    sceneRef.current = scene;
    scene.setWheelZoomEnabled(true);
    scene.setBloom(scene.bloomMax);
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  const background: Background =
    bgMode === "transparent" ? { mode: "transparent" } : { mode: "solid", color };

  // Keep the live preview's clear colour in sync with the chosen background.
  useEffect(() => {
    sceneRef.current?.setBackground(background);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgMode, color]);

  // Target export size from a resolution height, using the live canvas aspect
  // so framing matches the preview. H.264 needs even dimensions.
  const sizeFor = (h: number) => {
    const c = sceneRef.current?.getCanvas();
    const aspect = c && c.clientHeight ? c.clientWidth / c.clientHeight : 16 / 9;
    let w = Math.round(h * aspect);
    if (w % 2) w += 1;
    return { w, h };
  };

  async function runExport(kind: "image" | "video", job: () => Promise<void>) {
    const scene = sceneRef.current;
    if (!scene || exporting) return;
    stopPlay();
    setExporting(true);
    setExportKind(kind);
    setProgress(0);
    try {
      await job();
    } catch (err) {
      console.error("Export failed:", err);
      window.alert(`Export failed: ${(err as Error).message}`);
    } finally {
      // Export mutates the clear colour; re-assert the UI's current background.
      scene.setBackground(background);
      setExporting(false);
      setExportKind(null);
      setProgress(0);
    }
  }

  function handleExportImage() {
    runExport("image", async () => {
      const scene = sceneRef.current!;
      const blob = await exportPngStill(scene, {
        background,
        size: sizeFor(RES_OPTIONS[imageRes].h),
      });
      downloadBlob(blob, `flower-${timestamp()}.png`);
    });
  }

  // Background decides the video format: Solid → MP4 (opaque, universal),
  // Transparent → PNG sequence (.zip) with alpha (H.264 can't carry alpha).
  function handleExportVideo() {
    runExport("video", async () => {
      const scene = sceneRef.current!;
      const stamp = timestamp();
      const common = {
        durationMs: duration * 1000,
        fps: 30,
        background,
        size: sizeFor(RES_OPTIONS[videoRes].h),
        onProgress: setProgress,
      };
      if (bgMode === "solid") {
        const { blob, ext } = await recordVideo(scene, common);
        downloadBlob(blob, `flower-${stamp}.${ext}`);
      } else {
        const blob = await exportPngSequence(scene, common);
        downloadBlob(blob, `flower-frames-${stamp}.zip`);
      }
    });
  }

  const rgb = hexToRgb(color) ?? { r: 11, g: 16, b: 32 };
  const hsv = rgbToHsv(rgb);
  const hueColor = rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));

  useEffect(() => {
    setColorDraft(formatColorValue(hexToRgb(color) ?? { r: 11, g: 16, b: 32 }, colorFormat));
  }, [colorFormat, color]);

  function queueColor(nextColor: string) {
    if (nextColor === colorRef.current && !pendingColorRef.current) return;
    pendingColorRef.current = nextColor;
    if (colorRafRef.current !== null) return;
    colorRafRef.current = requestAnimationFrame(() => {
      colorRafRef.current = null;
      const queued = pendingColorRef.current;
      pendingColorRef.current = null;
      if (!queued || queued === colorRef.current) return;
      colorRef.current = queued;
      setColor(queued);
    });
  }

  function colorFromHsv(next: Hsv) {
    return rgbToHex(hsvToRgb({
      h: (next.h + 360) % 360,
      s: clamp(next.s, 0, 1),
      v: clamp(next.v, 0, 1),
    }));
  }

  function currentHsv() {
    return rgbToHsv(hexToRgb(colorRef.current) ?? rgb);
  }

  function setColorFromHsv(next: Hsv) {
    queueColor(colorFromHsv(next));
  }

  function updateColorPlane(e: PointerEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, 0, rect.width);
    const y = clamp(e.clientY - rect.top, 0, rect.height);
    const nextS = x / rect.width;
    const nextV = 1 - y / rect.height;
    if (planeThumbRef.current) {
      planeThumbRef.current.style.left = `${nextS * 100}%`;
      planeThumbRef.current.style.top = `${(1 - nextV) * 100}%`;
    }
    setColorFromHsv({
      h: currentHsv().h,
      s: nextS,
      v: nextV,
    });
  }

  function updateHue(e: PointerEvent<HTMLButtonElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, 0, rect.width);
    const nextH = (x / rect.width) * 360;
    if (hueThumbRef.current) hueThumbRef.current.style.left = `${(nextH / 360) * 100}%`;
    const { s, v } = currentHsv();
    setColorFromHsv({
      h: nextH,
      s,
      v,
    });
  }

  function updateColorValue(value: string) {
    const next = colorFormat === "hex" ? value.toUpperCase() : value;
    setColorDraft(next);
    const parsed = parseColorValue(next, colorFormat);
    if (parsed) setColor(rgbToHex(parsed));
  }

  return (
    <div className="studio">
      <div
        ref={canvasRef}
        className={`studio-stage${bgMode === "transparent" ? " is-transparent" : ""}`}
      />
      {showCameraFrame && (
        <div className="studio-export-frame" aria-hidden="true">
          <span className="studio-export-frame-label">Camera Frame</span>
          <span className="studio-export-frame-corner is-top-left" />
          <span className="studio-export-frame-corner is-top-right" />
          <span className="studio-export-frame-corner is-bottom-left" />
          <span className="studio-export-frame-corner is-bottom-right" />
        </div>
      )}

      <header className="studio-head">
        <h1 className="studio-title">Bloom Animation Generator</h1>
      </header>

      {/* Parameter designer — the engine mounts its tabbed lil-gui here. */}
      <div className="gui-container liquid-glass-strong">
        <div ref={tabsRef} className="gui-tabs" />
        <div className="studio-design-panel-main">
          {activeDesignTab === "Petal Geometry" && (
            <PetalShapePreview
              shape={petalShape}
              palette={PRESETS[selectedPreset].stops}
              onReset={() => sceneRef.current?.resetPetalGeometry()}
            />
          )}
          <div ref={guiRef} className="gui-scroll" />
        </div>
      </div>

      {/* Export panel — end-credits theme (cream ground, blue mono type) */}
      <aside className="studio-export studio-export--credits">
        <h2 className="studio-export-title">Export Sheet</h2>

        <PanelField label="Presets">
          <div className="studio-chips">
            {PRESETS.map((p, i) => (
              <PanelChip
                key={p.name}
                active={selectedPreset === i}
                onClick={() => {
                  setSelectedPreset(i);
                  sceneRef.current?.setPalette(p.stops);
                }}
              >
                {p.name}
              </PanelChip>
            ))}
          </div>
        </PanelField>

        <PanelSection title="Background">
          <PanelField label="Mode">
            <PanelSegmented
              value={bgMode}
              options={BG_OPTIONS}
              onChange={setBgMode}
            />
          </PanelField>

          {bgMode === "solid" && (
            <PanelField label="Color" full className="studio-color-field">
              <div className="studio-color-picker">
                <div className="studio-color-head">
                  <span
                    className="studio-color-swatch"
                    style={{ backgroundColor: color }}
                    aria-hidden="true"
                  />
                  <input
                    className="studio-color-input"
                    value={colorDraft}
                    maxLength={colorFormat === "hex" ? 7 : 18}
                    spellCheck={false}
                    onChange={(e) => updateColorValue(e.target.value)}
                    onBlur={() => {
                      setColorDraft(formatColorValue(rgb, colorFormat));
                    }}
                    aria-label={`Background color ${colorFormat.toUpperCase()}`}
                  />
                  <select
                    className="studio-color-format"
                    value={colorFormat}
                    onChange={(e) => setColorFormat(e.target.value as ColorFormat)}
                    aria-label="Color format"
                  >
                    <option value="hex">HEX</option>
                    <option value="rgb">RGB</option>
                    <option value="hsl">HSL</option>
                  </select>
                </div>

                <button
                  type="button"
                  className="studio-color-plane"
                  style={{
                    background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
                  }}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    updateColorPlane(e);
                  }}
                  onPointerMove={(e) => {
                    if (e.buttons === 1) updateColorPlane(e);
                  }}
                  aria-label="Pick saturation and brightness"
                >
                  <span
                    ref={planeThumbRef}
                    className="studio-color-plane-thumb"
                    style={{
                      left: `${hsv.s * 100}%`,
                      top: `${(1 - hsv.v) * 100}%`,
                    }}
                  />
                </button>

                <button
                  type="button"
                  className="studio-hue-track"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    updateHue(e);
                  }}
                  onPointerMove={(e) => {
                    if (e.buttons === 1) updateHue(e);
                  }}
                  aria-label="Pick hue"
                >
                  <span
                    ref={hueThumbRef}
                    className="studio-hue-thumb"
                    style={{ left: `${(hsv.h / 360) * 100}%` }}
                  />
                </button>
              </div>
            </PanelField>
          )}
        </PanelSection>

        {/* ---- Image Export ---- */}
        <PanelSection title="Image Export">
          <PanelField label="Resolution" className="studio-mini">
            <PanelSelect
              value={imageRes}
              options={RES_OPTIONS.map((r, i) => ({ label: r.label, value: i }))}
              onChange={setImageRes}
              disabled={exporting}
            />
          </PanelField>
          <PanelActionRow>
            <PanelButton
              disabled={exporting}
              onClick={handleExportImage}
            >
              {exportKind === "image" ? "Exporting…" : "Export Image"}
            </PanelButton>
          </PanelActionRow>
        </PanelSection>

        {/* ---- Video Export ---- */}
        <PanelSection title="Video Export">
          <PanelField label="Resolution" className="studio-mini">
            <PanelSelect
              value={videoRes}
              options={RES_OPTIONS.map((r, i) => ({ label: r.label, value: i }))}
              onChange={setVideoRes}
              disabled={exporting}
            />
          </PanelField>

          {/* The Duration slider doubles as the preview — dragging it sets the
              length and shows where the bloom lands; ▶ plays the full clip. */}
          <PanelField label="Duration" value={`${duration}s`}>
            <div className="studio-timeline">
              <button
                type="button"
                className="studio-play"
                onClick={togglePlay}
                disabled={exporting}
                aria-label={playing ? "Pause preview" : "Play preview"}
              >
                {playing ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <input
                className="studio-scrub"
                type="range"
                min={2}
                max={10}
                step={1}
                value={duration}
                disabled={exporting}
                onChange={(e) => {
                  stopPlay();
                  const d = Number(e.target.value);
                  setDuration(d);
                  previewEnd(d);
                }}
                aria-label="Duration and bloom preview"
              />
            </div>
          </PanelField>

          {bgMode === "transparent" && (
            <p className="studio-hint">
              Transparent → PNG sequence (.zip) with alpha. Drop into any editor,
              or make a ProRes 4444 MOV:{" "}
              <code>
                ffmpeg -framerate 30 -i flower_%04d.png -c:v prores_ks -profile:v
                4444 -pix_fmt yuva444p10le flower.mov
              </code>
            </p>
          )}

          <PanelActionRow>
            <PanelButton
              disabled={exporting}
              onClick={handleExportVideo}
            >
              {exportKind === "video"
                ? `Rendering… ${Math.round(progress * 100)}%`
                : bgMode === "solid"
                  ? "Export Video"
                  : "Export PNG Sequence"}
            </PanelButton>
          </PanelActionRow>
          {exportKind === "video" && (
            <div className="studio-progress" aria-hidden="true">
              <span style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
        </PanelSection>

        <div className="studio-panel-footer">
          <div className="studio-frame-toggle">
            <span className="studio-panel-footer-label">Camera Frame</span>
            <PanelSwitch
              checked={showCameraFrame}
              onChange={setShowCameraFrame}
              disabled={exporting}
            />
          </div>
          <p className="studio-interaction-guide" aria-label="Canvas controls">
            <span className="studio-interaction-item">
              <b>Orbit</b>
              <Rotate3D className="studio-interaction-icon" aria-hidden="true" />
              <span className="studio-interaction-input">Left drag</span>
            </span>
            <span className="studio-interaction-divider" aria-hidden="true" />
            <span className="studio-interaction-item">
              <b>Pan</b>
              <Move className="studio-interaction-icon" aria-hidden="true" />
              <span className="studio-interaction-input">Right drag</span>
            </span>
            <span className="studio-interaction-divider" aria-hidden="true" />
            <span className="studio-interaction-item">
              <b>Zoom</b>
              <Mouse className="studio-interaction-icon" aria-hidden="true" />
              <span className="studio-interaction-input">Scroll</span>
            </span>
          </p>
        </div>
      </aside>
    </div>
  );
}
