"use client";

import { useEffect, useRef, useState } from "react";
import { createFlowerScene, type FlowerSceneApi } from "./flowerScene";
import {
  downloadBlob,
  exportPngSequence,
  exportPngStill,
  recordVideo,
  type Background,
} from "./flowerExport";

type BgMode = "transparent" | "solid";

// Resolutions are target heights; the width is derived from the live canvas
// aspect at export time so the output frames the flower exactly as previewed.
const RES_OPTIONS: { label: string; h: number }[] = [
  { label: "720p", h: 720 },
  { label: "1080p", h: 1080 },
  { label: "2K", h: 1440 },
  { label: "4K", h: 2160 },
];
const DEFAULT_RES = 1; // 1080p

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

export default function StudioCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const guiRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FlowerSceneApi | null>(null);

  const [bgMode, setBgMode] = useState<BgMode>("solid");
  const [color, setColor] = useState("#0b1020");
  // Aurora (index 0) is the scene's default palette, so it starts selected.
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [duration, setDuration] = useState(5);
  const [imageRes, setImageRes] = useState(DEFAULT_RES);
  const [videoRes, setVideoRes] = useState(DEFAULT_RES);
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
    );
    sceneRef.current = scene;
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

  return (
    <div className="studio">
      <div
        ref={canvasRef}
        className={`studio-stage${bgMode === "transparent" ? " is-transparent" : ""}`}
      />

      <header className="studio-head">
        <h1 className="studio-title">Flower Studio</h1>
        <p className="studio-sub">
          Customize below · drag to orbit · export your bloom
        </p>
      </header>

      {/* Parameter designer — the engine mounts its tabbed lil-gui here. */}
      <div className="gui-container liquid-glass-strong">
        <div ref={tabsRef} className="gui-tabs" />
        <div ref={guiRef} className="gui-scroll" />
      </div>

      {/* Export panel — end-credits theme (cream ground, blue mono type) */}
      <aside className="studio-export studio-export--credits">
        <h2 className="studio-export-title">Flower Studio · Export Sheet</h2>

        <div className="studio-field">
          <span className="studio-label">Presets</span>
          <div className="studio-chips">
            {PRESETS.map((p, i) => (
              <button
                key={p.name}
                type="button"
                className={`studio-chip${selectedPreset === i ? " active" : ""}`}
                onClick={() => {
                  setSelectedPreset(i);
                  sceneRef.current?.setPalette(p.stops);
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        <div className="studio-field">
          <span className="studio-label">Background</span>
          <div className="studio-seg">
            <button
              type="button"
              className={`studio-seg-btn${bgMode === "transparent" ? " active" : ""}`}
              onClick={() => setBgMode("transparent")}
            >
              Transparent
            </button>
            <button
              type="button"
              className={`studio-seg-btn${bgMode === "solid" ? " active" : ""}`}
              onClick={() => setBgMode("solid")}
            >
              Solid
            </button>
          </div>
        </div>

        {bgMode === "solid" && (
          <div className="studio-field">
            <span className="studio-label">Color</span>
            <input
              type="color"
              className="studio-color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-label="Background color"
            />
          </div>
        )}

        {/* ---- Image Export ---- */}
        <section className="studio-section">
          <h3 className="studio-section-title">Image Export</h3>
          <label className="studio-field studio-mini">
            <span className="studio-label">Resolution</span>
            <select
              value={imageRes}
              onChange={(e) => setImageRes(Number(e.target.value))}
              disabled={exporting}
            >
              {RES_OPTIONS.map((r, i) => (
                <option key={r.label} value={i}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="studio-export-btn"
            disabled={exporting}
            onClick={handleExportImage}
          >
            {exportKind === "image" ? "Exporting…" : "Export Image"}
          </button>
        </section>

        {/* ---- Video Export ---- */}
        <section className="studio-section">
          <h3 className="studio-section-title">Video Export</h3>
          <label className="studio-field studio-mini">
            <span className="studio-label">Resolution</span>
            <select
              value={videoRes}
              onChange={(e) => setVideoRes(Number(e.target.value))}
              disabled={exporting}
            >
              {RES_OPTIONS.map((r, i) => (
                <option key={r.label} value={i}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          {/* The Duration slider doubles as the preview — dragging it sets the
              length and shows where the bloom lands; ▶ plays the full clip. */}
          <div className="studio-field">
            <span className="studio-label">
              Duration <em>{duration}s</em>
            </span>
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
          </div>

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

          <button
            type="button"
            className="studio-export-btn"
            disabled={exporting}
            onClick={handleExportVideo}
          >
            {exportKind === "video"
              ? `Rendering… ${Math.round(progress * 100)}%`
              : bgMode === "solid"
                ? "Start Recording (MP4)"
                : "Export PNG Sequence"}
          </button>
          {exportKind === "video" && (
            <div className="studio-progress" aria-hidden="true">
              <span style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}
