"use client";

import { useEffect, useRef, useState } from "react";
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
import PetalOutlineEditor from "./PetalOutlineEditor";
import PetalShapePreview from "./PetalShapePreview";
import StudioExportPane from "./StudioExportPane";

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
  const [showCameraFrame, setShowCameraFrame] = useState(false);
  const [activeDesignTab, setActiveDesignTab] = useState("Petal Geometry");
  const [petalShape, setPetalShape] = useState<PetalShapeState>(DEFAULT_PETAL_SHAPE);
  const [exporting, setExporting] = useState(false);
  const [exportKind, setExportKind] = useState<"image" | "video" | null>(null);
  const [progress, setProgress] = useState(0);
  const [previewTime, setPreviewTime] = useState(0);

  // Duration is the export clip length. Bloom speed stays fixed to the scene's
  // bloomDuration; Preview loops that exact export-length segment until exited.
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const durationRef = useRef(duration);
  const previewTimeRef = useRef(0);

  const setPreviewClock = (seconds: number) => {
    const rounded = Math.round(seconds * 10) / 10;
    if (rounded === previewTimeRef.current) return;
    previewTimeRef.current = rounded;
    setPreviewTime(rounded);
  };

  const previewStart = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    setPreviewClock(0);
    scene.setBloom(scene.bloomAt(0));
  };

  const editPose = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setBloom(scene.bloomMax);
  };

  const stopPlay = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPlaying(false);
  };

  const exitPreview = () => {
    stopPlay();
    setPreviewClock(0);
    editPose();
  };

  const togglePlay = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (rafRef.current !== null) {
      exitPreview();
      return;
    }
    previewStart();
    setPlaying(true);
    const start = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000;
      const clipDuration = Math.max(durationRef.current, 0.001);
      const t = elapsed % clipDuration;
      setPreviewClock(t);
      scene.setBloom(scene.bloomAt(t / scene.bloomDuration));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    durationRef.current = duration;
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

  const handlePetalOutlineChange = ({
    petalLen,
    widths,
  }: {
    petalLen: number;
    widths: [number, number, number, number];
  }) => {
    sceneRef.current?.setPetalOutline(petalLen, widths);
  };

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

  function handlePresetChange(index: number) {
    setSelectedPreset(index);
    sceneRef.current?.setPalette(PRESETS[index].stops);
  }

  function handleDurationChange(nextDuration: number) {
    setDuration(nextDuration);
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
            <div className="studio-petal-workbench">
              <PetalOutlineEditor
                shape={petalShape}
                palette={PRESETS[selectedPreset].stops}
                onOutlineChange={handlePetalOutlineChange}
              />
              <PetalShapePreview
                shape={petalShape}
                palette={PRESETS[selectedPreset].stops}
                onReset={() => sceneRef.current?.resetPetalGeometry()}
              />
            </div>
          )}
          <div ref={guiRef} className="gui-scroll" />
        </div>
      </div>

      <StudioExportPane
        presets={PRESETS}
        resolutions={RES_OPTIONS}
        selectedPreset={selectedPreset}
        bgMode={bgMode}
        color={color}
        imageRes={imageRes}
        videoRes={videoRes}
        duration={duration}
        showCameraFrame={showCameraFrame}
        exporting={exporting}
        exportKind={exportKind}
        progress={progress}
        previewTime={previewTime}
        playing={playing}
        onPresetChange={handlePresetChange}
        onBgModeChange={setBgMode}
        onColorChange={setColor}
        onImageResChange={setImageRes}
        onVideoResChange={setVideoRes}
        onDurationChange={handleDurationChange}
        onShowCameraFrameChange={setShowCameraFrame}
        onTogglePlay={togglePlay}
        onExportImage={handleExportImage}
        onExportVideo={handleExportVideo}
      />
    </div>
  );
}
