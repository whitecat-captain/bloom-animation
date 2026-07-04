"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pane, type TabPageApi } from "tweakpane";
import {
  createFlowerScene,
  STUDIO_FLOWER_GROUP_Y,
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
    radius: 0.165,
    radiusBias: 1.15,
    height: 0.155,
    heightBias: 1.2,
    scaleInner: 0.46,
    tiltInner: 0.2,
    outAngle: 68,
    tiltBias: 2.2,
  },
  wind: {
    jitter: 0.04,
    shellGap: 0.18,
    noiseAmp: 0.045,
    noiseFreq: 5,
    windAmp: 0.15,
    windSpeed: 1.5,
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

// Whole-flower presets: geometry patch + 5-stop palette (cold rim -> hot
// core). Selecting one re-shapes the mesh via scene.applyPreset AND recolours
// via scene.setPalette; the palette stays independently editable afterwards.
type FlowerPresetParams = Parameters<FlowerSceneApi["applyPreset"]>[0];
type FlowerPreset = {
  name: string;
  palette: [number, number, number][];
  params: FlowerPresetParams;
};

// "Aurora Rose" is the studio's boot look — these params mirror the scene
// defaults in flowerScene.ts so preset 0 always round-trips to the same flower.
const AURORA_ROSE_PARAMS: FlowerPresetParams = {
  numPetals: 36,
  goldenAngle: 137.5,
  outwardPush: true,
  radius: 0.165,
  radiusBias: 1.15,
  height: 0.155,
  heightBias: 1.2,
  scaleInner: 0.46,
  tiltInner: 0.2,
  outAngle: 68,
  tiltBias: 2.2,
  petalLen: 0.95,
  curlClosed: 1.7,
  curlOpen: -0.35,
  curlBias: 2.3,
  propagation: 1.2,
  w0: 0.16,
  w1: 0.28,
  w2: 0.3,
  w3: 0.2,
  cup: 0.4,
  sideCurl: 0.45,
  wrapWidth: 0.35,
  wrapCup: 0.5,
  waveAmp: 0.035,
  asym: 0.08,
  jitter: 0.04,
  noiseAmp: 0.045,
  noiseFreq: 5,
  shellGap: 0.18,
  windAmp: 0.15,
  windSpeed: 1.5,
  windHeading: 35,
  flat: true,
};

// Open decorative dahlia, read off a real bloom (an "Arabian Night" style
// red): a wide, fairly FLAT rosette of slender boat-folded petals in regular
// rings — tiny furled florets at the centre, each ring longer and more open,
// and the outermost rings tipping past horizontal so they drape down and out
// around the stem like a skirt.
const CRIMSON_DAHLIA_PARAMS: FlowerPresetParams = {
  numPetals: 132, // dense — neighbouring petals overlap like the photo
  goldenAngle: 137.5,
  outwardPush: true,
  radius: 0.22, // wide rosette, not a tight ball
  radiusBias: 1.05, // near-linear ring spacing keeps the layers legible
  height: 0.4, // tall domed receptacle so the outer rings fall away below it
  heightBias: 1.1,
  scaleInner: 0.3, // centre florets stay tiny against the long outer petals
  tiltInner: 0.5, // inner florets stand up out of the throat
  outAngle: 122, // rim tips past horizontal -> the drooping skirt
  tiltBias: 1.75, // mid rings open up too — only the very centre stays furled
  petalLen: 0.95, // long, slender petals
  curlClosed: 1.85,
  curlOpen: -0.12, // gentle backward arch so the skirt drapes, not spikes
  curlBias: 2.0,
  propagation: 1.2,
  // Lance profile: narrow base, widest ~40% up, easing to a ROUNDED point —
  // a generous tip width keeps the rings reading as a ruffle, not star spikes.
  w0: 0.11,
  w1: 0.28,
  w2: 0.28,
  w3: 0.16,
  cup: 0.6, // boat/trough fold along the midrib
  sideCurl: 0.5,
  wrapWidth: 0.12,
  wrapCup: 0.2,
  waveAmp: 0.015, // dahlia petals are neat — barely any edge wave
  asym: 0.04,
  jitter: 0.03, // regular, ring-like placement
  noiseAmp: 0.03,
  noiseFreq: 5,
  shellGap: 0.08,
  windAmp: 0.12,
  windSpeed: 1.5,
  windHeading: 35,
  flat: false,
};

const FLOWER_PRESETS: FlowerPreset[] = [
  {
    name: "Aurora Rose",
    palette: [
      [0.05, 0.2, 0.65],
      [0.15, 0.55, 0.95],
      [0.85, 0.92, 1.0],
      [1.0, 0.72, 0.0],
      [1.0, 0.25, 0.0],
    ],
    params: AURORA_ROSE_PARAMS,
  },
  {
    name: "Crimson Dahlia",
    // Cool velvet crimson, read off the reference photo: rosy light kissing
    // the outer petal tips, rich blue-leaning crimson faces (never orange),
    // sinking to a dark burgundy at the furled centre.
    palette: [
      [1.0, 0.42, 0.48],
      [0.87, 0.1, 0.2],
      [0.7, 0.04, 0.14],
      [0.45, 0.02, 0.1],
      [0.24, 0.01, 0.07],
    ],
    params: CRIMSON_DAHLIA_PARAMS,
  },
];

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export default function StudioCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FlowerSceneApi | null>(null);

  const [bgMode, setBgMode] = useState<BgMode>("solid");
  const [color, setColor] = useState("#0b1020");
  // Aurora Rose (index 0) mirrors the scene's boot defaults, so it starts
  // selected. The palette is deliberately its own state, decoupled from the
  // preset: picking a preset seeds it, then each stop is editable on its own.
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [palette, setPalette] = useState<[number, number, number][]>(
    FLOWER_PRESETS[0].palette,
  );
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
  const [arrangementPreviewResetKey, setArrangementPreviewResetKey] = useState(0);
  const [windPreviewResetKey, setWindPreviewResetKey] = useState(0);

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

  // Boot the scene once. Studio uses its Tweakpane design sheet instead of the
  // legacy lil-gui designer panel used by the story page.
  useEffect(() => {
    if (!canvasRef.current) return;
    const scene = createFlowerScene(
      canvasRef.current,
      null,
      null,
      {
        flowerGroupY: STUDIO_FLOWER_GROUP_Y,
        onPetalShapeChange: setPetalShape,
        onDesignStateChange: setDesignState,
      },
    );
    sceneRef.current = scene;
    scene.setBloom(scene.bloomMax);
    // Boot look is preset 0 (Aurora Rose), which mirrors the scene defaults, so
    // resets start out pointing at it too.
    scene.setResetBaseline(FLOWER_PRESETS[0].params);

    const zoomWithAltScroll = (event: WheelEvent) => {
      if (!event.altKey) return;
      const target = event.target;
      if (target instanceof Node && sheetRef.current?.contains(target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      // Normalise to pixels first: mouse wheels commonly report lines
      // (deltaMode 1, deltaY ~±3) — far too small for the exp()-based zoom to
      // register — while trackpads report pixels. Without this a mouse feels
      // like Opt+scroll "does nothing".
      const unit =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? window.innerHeight
            : 1;
      scene.zoomBy(event.deltaY * unit);
    };
    window.addEventListener("wheel", zoomWithAltScroll, {
      capture: true,
      passive: false,
    });

    return () => {
      window.removeEventListener("wheel", zoomWithAltScroll, true);
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

  // A preset is a whole flower: geometry patch + palette seed. The scene
  // notifies the shape/design state back, which refreshes every pane binding.
  function handlePresetChange(index: number) {
    const preset = FLOWER_PRESETS[index];
    if (!preset) return;
    setSelectedPreset(index);
    setPalette(preset.palette);
    const scene = sceneRef.current;
    if (!scene) return;
    scene.applyPreset(preset.params);
    scene.setPalette(preset.palette);
    // Every reset (all / geometry / arrangement / wind / detail) now returns to
    // THIS flower's params, not the boot rose.
    scene.setResetBaseline(preset.params);
    // Re-assert the fully-open pose so the new flower shows bloomed, not
    // mid-wavefront (curl params shift what the current bloom value means).
    scene.setBloom(scene.bloomMax);
  }

  function handlePaletteChange(index: number, rgb: [number, number, number]) {
    setPalette((stops) => {
      const next = stops.map((stop, i) =>
        i === index ? rgb : stop,
      ) as [number, number, number][];
      sceneRef.current?.setPalette(next);
      return next;
    });
  }

  function handleResetPetalGeometry() {
    sceneRef.current?.resetPetalGeometry();
    setPetalPreviewResetKey((key) => key + 1);
  }

  function handleResetArrangement() {
    sceneRef.current?.resetArrangement();
    setArrangementPreviewResetKey((key) => key + 1);
  }

  function handleResetWind() {
    sceneRef.current?.resetWind();
    setWindPreviewResetKey((key) => key + 1);
  }

  function handleResetNaturalDetail() {
    sceneRef.current?.resetNaturalDetail();
  }

  function handleDurationChange(nextDuration: number) {
    setDuration(nextDuration);
  }

  // Memoised embedded-React nodes: the sheet re-renders 10x/s during preview
  // playback, and a fresh element would re-render each pane-hosted root.
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
    () => (
      <WindPreview
        wind={{ windAmp, windSpeed, windHeading }}
        resetViewKey={windPreviewResetKey}
      />
    ),
    [windAmp, windSpeed, windHeading, windPreviewResetKey],
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
        resetViewKey={arrangementPreviewResetKey}
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
      arrangementPreviewResetKey,
    ],
  );

  return (
    <div className={`studio${showCameraFrame ? " is-framing" : ""}`}>
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

      <div className="studio-controls-hint" aria-label="Canvas controls">
        <span className="studio-controls-hint-item">
          <span className="studio-controls-hint-key">Left drag</span>Orbit
        </span>
        <span className="studio-controls-hint-item">
          <span className="studio-controls-hint-key">Right drag</span>Pan
        </span>
        <span className="studio-controls-hint-item">
          <span className="studio-controls-hint-key">Opt/Alt + scroll</span>Zoom
        </span>
      </div>

      <p className="studio-credit">
        Built by Whitecat Captain -&gt;{" "}
        <a
          className="studio-github-link"
          href="https://github.com/whitecat-captain/bloom-animation"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
      </p>

      <div ref={sheetRef} className="studio-sheet">
        {sheetPages && (
          <>
            <StudioDesignPane
              pane={sheetPages.design}
              shape={petalShape}
              designState={designState}
              presets={FLOWER_PRESETS}
              selectedPreset={selectedPreset}
              palette={palette}
              outlineEditor={outlineEditor}
              petalPreview={petalPreview}
              arrangementPreview={arrangementPreview}
              windPreview={windPreview}
              duration={duration}
              previewTime={previewTime}
              playing={playing}
              exporting={exporting}
              onPresetChange={handlePresetChange}
              onPaletteChange={handlePaletteChange}
              onPetalFormChange={handlePetalFormChange}
              onPhyllotaxisChange={handlePhyllotaxisChange}
              onWindChange={handleWindChange}
              onRenderStyleChange={handleRenderStyleChange}
              onDurationChange={handleDurationChange}
              onTogglePlay={togglePlay}
              onResetAll={() => sceneRef.current?.resetAll()}
              onStemChange={handleStemChange}
              onResetPetalGeometry={handleResetPetalGeometry}
              onResetArrangement={handleResetArrangement}
              onResetWind={handleResetWind}
              onResetNaturalDetail={handleResetNaturalDetail}
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
