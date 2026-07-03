"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pane, type TabPageApi } from "tweakpane";
import {
  createFlowerScene,
  type FlowerDesignState,
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
import PhyllotaxisPreview from "./PhyllotaxisPreview";
import StudioDesignPane, {
  type PetalFormKey,
  type PhyllotaxisKey,
  type RenderStyleKey,
  type StemKey,
  type WindKey,
} from "./StudioDesignPane";
import StudioExportPane from "./StudioExportPane";
import WindPreview from "./WindPreview";

type BgMode = "transparent" | "solid";

type StudioSheetPages = {
  design: TabPageApi;
  export: TabPageApi;
};

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
const DEFAULT_DESIGN_STATE: FlowerDesignState = {
  phyllotaxis: {
    numPetals: 36,
    goldenAngle: 137.5,
    radius: 0.14,
    radiusBias: 1.15,
    height: 0.13,
    heightBias: 1.2,
    scaleInner: 0.5,
    tiltInner: 0.08,
    outAngle: 68,
    tiltBias: 2.2,
  },
  wind: {
    jitter: 0.04,
    shellGap: 0.14,
    noiseAmp: 0.045,
    noiseFreq: 5,
    windAmp: 0.09,
    windSpeed: 1,
    windHeading: 35,
  },
  renderStyle: {
    flat: true,
  },
  animation: {
    bloom: 0,
    bloomMax: 0.78,
    transition: 0.35,
    animate: false,
  },
  stem: {
    show: true,
    length: 1.8,
    leaves: true,
  },
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
  const sheetRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FlowerSceneApi | null>(null);

  const [bgMode, setBgMode] = useState<BgMode>("solid");
  const [color, setColor] = useState("#0b1020");
  // Aurora (index 0) is the scene's default palette, so it starts selected.
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [duration, setDuration] = useState(5);
  const [imageRes, setImageRes] = useState(DEFAULT_RES);
  const [videoRes, setVideoRes] = useState(DEFAULT_RES);
  const [showCameraFrame, setShowCameraFrame] = useState(false);
  const [petalShape, setPetalShape] = useState<PetalShapeState>(DEFAULT_PETAL_SHAPE);
  const [designState, setDesignState] =
    useState<FlowerDesignState>(DEFAULT_DESIGN_STATE);
  const [exporting, setExporting] = useState(false);
  const [exportKind, setExportKind] = useState<"image" | "video" | null>(null);
  const [progress, setProgress] = useState(0);
  const [previewTime, setPreviewTime] = useState(0);
  const [sheetPages, setSheetPages] = useState<StudioSheetPages | null>(null);
  const [petalPreviewResetKey, setPetalPreviewResetKey] = useState(0);

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
        onPetalShapeChange: setPetalShape,
        onDesignStateChange: setDesignState,
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

  useEffect(() => {
    const container = sheetRef.current;
    if (!container) return;

    const pane = new Pane({
      container,
      title: "Bloom Animation Generator",
      expanded: true,
    });
    const tab = pane.addTab({
      pages: [{ title: "DESIGN" }, { title: "EXPORT" }],
    });

    setSheetPages({
      design: tab.pages[0],
      export: tab.pages[1],
    });

    return () => {
      pane.dispose();
    };
  }, []);

  const background: Background =
    bgMode === "transparent" ? { mode: "transparent" } : { mode: "solid", color };

  // Keep the live preview's clear colour in sync with the chosen background.
  useEffect(() => {
    sceneRef.current?.setBackground(background);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgMode, color]);

  const handlePetalOutlineChange = useCallback(
    ({
      petalLen,
      widths,
    }: {
      petalLen: number;
      widths: [number, number, number, number];
    }) => {
      sceneRef.current?.setPetalOutline(petalLen, widths);
    },
    [],
  );

  // Rebuild-triggering setters (phyllotaxis, jitter, stem) regenerate the
  // whole mesh; coalesce drag events so at most one rebuild runs per frame.
  const pendingSceneOpsRef = useRef(new Map<string, () => void>());
  const sceneOpRafRef = useRef<number | null>(null);
  const scheduleSceneOp = useCallback((key: string, op: () => void) => {
    pendingSceneOpsRef.current.set(key, op);
    if (sceneOpRafRef.current !== null) return;
    sceneOpRafRef.current = requestAnimationFrame(() => {
      sceneOpRafRef.current = null;
      const ops = [...pendingSceneOpsRef.current.values()];
      pendingSceneOpsRef.current.clear();
      ops.forEach((run) => run());
    });
  }, []);
  useEffect(
    () => () => {
      if (sceneOpRafRef.current !== null) {
        cancelAnimationFrame(sceneOpRafRef.current);
      }
    },
    [],
  );

  const handlePetalFormChange = (key: PetalFormKey, value: number) => {
    const scene = sceneRef.current;
    if (!scene) return;

    switch (key) {
      case "curlOpen":
        scene.setCurlOpen(value);
        break;
      case "curlBias":
        scene.setCurlBias(value);
        break;
      case "cup":
        scene.setCup(value);
        break;
      case "sideCurl":
        scene.setSideCurl(value);
        break;
      case "waveAmp":
        scene.setWaveAmp(value);
        break;
      case "asym":
        scene.setAsym(value);
        break;
    }
  };

  const handlePhyllotaxisChange = (key: PhyllotaxisKey, value: number) => {
    scheduleSceneOp(`phyllotaxis:${key}`, () =>
      sceneRef.current?.setPhyllotaxis(key, value),
    );
  };

  const handleWindChange = (key: WindKey, value: number) => {
    if (key === "jitter") {
      scheduleSceneOp("wind:jitter", () =>
        sceneRef.current?.setWind(key, value),
      );
      return;
    }
    sceneRef.current?.setWind(key, value);
  };

  const handleRenderStyleChange = (key: RenderStyleKey, value: boolean) => {
    sceneRef.current?.setRenderStyle(key, value);
  };

  const handleStemChange = <K extends StemKey>(
    key: K,
    value: FlowerDesignState["stem"][K],
  ) => {
    if (key === "length") {
      scheduleSceneOp("stem:length", () =>
        sceneRef.current?.setStem(key, value),
      );
      return;
    }
    sceneRef.current?.setStem(key, value);
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

  function handleResetPetalGeometry() {
    sceneRef.current?.resetPetalGeometry();
    setPetalPreviewResetKey((key) => key + 1);
  }

  function handleDurationChange(nextDuration: number) {
    setDuration(nextDuration);
  }

  // Memoised embedded-React nodes: the sheet re-renders 10x/s during preview
  // playback, and a fresh element would re-render each pane-hosted root.
  const palette = PRESETS[selectedPreset].stops;
  const outlineEditor = useMemo(
    () => (
      <PetalOutlineEditor
        shape={petalShape}
        palette={palette}
        onOutlineChange={handlePetalOutlineChange}
      />
    ),
    [handlePetalOutlineChange, palette, petalShape],
  );
  const petalPreview = useMemo(
    () => (
      <PetalShapePreview
        shape={petalShape}
        palette={palette}
        resetViewKey={petalPreviewResetKey}
      />
    ),
    [palette, petalShape, petalPreviewResetKey],
  );
  const { windAmp, windSpeed, windHeading } = designState.wind;
  const windPreview = useMemo(
    () => <WindPreview wind={{ windAmp, windSpeed, windHeading }} />,
    [windAmp, windSpeed, windHeading],
  );
  const {
    numPetals,
    goldenAngle,
    radius,
    radiusBias,
    height,
    heightBias,
    scaleInner,
    tiltInner,
    outAngle,
    tiltBias,
  } = designState.phyllotaxis;
  const arrangementPreview = useMemo(
    () => (
      <PhyllotaxisPreview
        layout={{
          numPetals,
          goldenAngle,
          radius,
          radiusBias,
          height,
          heightBias,
          scaleInner,
          tiltInner,
          outAngle,
          tiltBias,
        }}
        palette={palette}
      />
    ),
    [
      numPetals,
      goldenAngle,
      radius,
      radiusBias,
      height,
      heightBias,
      scaleInner,
      tiltInner,
      outAngle,
      tiltBias,
      palette,
    ],
  );

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

      {/* Parameter designer — the engine mounts its tabbed lil-gui here. */}
      <div className="gui-container liquid-glass-strong">
        <div ref={tabsRef} className="gui-tabs" />
        <div className="studio-design-panel-main">
          <div ref={guiRef} className="gui-scroll" />
        </div>
      </div>

      <div ref={sheetRef} className="studio-sheet">
        {sheetPages && (
          <>
            <StudioDesignPane
              pane={sheetPages.design}
              shape={petalShape}
              designState={designState}
              presets={PRESETS}
              selectedPreset={selectedPreset}
              outlineEditor={outlineEditor}
              petalPreview={petalPreview}
              arrangementPreview={arrangementPreview}
              windPreview={windPreview}
              duration={duration}
              previewTime={previewTime}
              playing={playing}
              exporting={exporting}
              onPresetChange={handlePresetChange}
              onPetalFormChange={handlePetalFormChange}
              onPhyllotaxisChange={handlePhyllotaxisChange}
              onWindChange={handleWindChange}
              onRenderStyleChange={handleRenderStyleChange}
              onDurationChange={handleDurationChange}
              onTogglePlay={togglePlay}
              onResetAll={() => sceneRef.current?.resetAll()}
              onStemChange={handleStemChange}
              onResetPetalGeometry={handleResetPetalGeometry}
            />
            <StudioExportPane
              pane={sheetPages.export}
              resolutions={RES_OPTIONS}
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
          </>
        )}
      </div>
    </div>
  );
}
