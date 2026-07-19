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
import type { FlowerConfig } from "./flowerConfig";
import { GENERATED_FLOWERS } from "./generated";

type BgMode = "transparent" | "solid";

type StudioSheetPages = {
  design: TabPageApi;
  export: TabPageApi;
};

// The flower reads fully open before the shader curve reaches 1.0. Keep the
// Design scrubber focused on the visible part of the bloom.
const DESIGN_PREVIEW_COMPLETE_PROGRESS = 0.7;

// Resolutions are target heights; the width is derived from the live canvas
// aspect at export time so the output frames the flower exactly as previewed.
const RES_OPTIONS: { label: string; h: number }[] = [
  { label: "720p", h: 720 },
  { label: "1080p", h: 1080 },
  { label: "2K", h: 1440 },
  { label: "4K", h: 2160 },
];
const DEFAULT_RES = 1; // 1080p
const ROSE_PETAL_SHAPE = {
  petalLen: 0.95,
  w0: 0.16,
  w1: 0.28,
  w2: 0.3,
  w3: 0.2,
  w4: 0.02,
  curlOpen: -0.35,
  curlBias: 2.3,
  cup: 0.4,
  sideCurl: 0.45,
  waveAmp: 0.035,
  asym: 0.08,
} satisfies PetalShapeState;
const DEFAULT_PETAL_SHAPE: PetalShapeState = { ...ROSE_PETAL_SHAPE };
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
  transition: 0.35,
  curlClosed: 1.7,
  propagation: 1.2,
  ...ROSE_PETAL_SHAPE,
  wrapWidth: 0.35,
  wrapCup: 0.5,
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
  transition: 0.35,
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
  w4: 0.045,
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

// Garland (crown) daisy. Unlike the rose/dahlia dome recipe, this is a FLAT
// star rosette: a tiny bloom radius with a steep radial spread makes every
// ray sprout from one central hub (like real rays ringing the disc), zero
// centre height keeps it flat, and a low outer angle with an early tilt
// falloff fans the rays up and out into the star. Hand-tuned in the studio.
const GARLAND_DAISY_PARAMS: FlowerPresetParams = {
  numPetals: 43,
  goldenAngle: 137.5,
  outwardPush: true,
  radius: 0.11, // all rays attach near the golden disc...
  radiusBias: 2.45, // ...then separate into a loose daisy ring
  height: 0.02, // nearly flat, with just enough lift for the disc
  heightBias: 1.2,
  scaleInner: 0.1, // disc florets stay tiny against the long rays
  tiltInner: 0.8, // every ray leans well out from the vertical
  outAngle: 37.4, // rays fan upward-out, star-like — not pancake-flat
  tiltBias: 0.7, // tilt arrives early, so the whole ring shares the fan
  // A wide bloom wavefront keeps the centre florets half-open — splayed
  // little tubes that read as the fluffy golden disc of a real daisy.
  transition: 0.55,
  petalLen: 1.2, // long slender straps like daisy rays
  curlClosed: 1.6,
  curlOpen: 0.03, // almost flat, the faintest upward scoop
  curlBias: 2.0,
  propagation: 1.2,
  // Strap (ligulate) profile: narrow base, near-parallel sides, blunt head.
  w0: 0.045,
  w1: 0.105,
  w2: 0.13,
  w3: 0.125,
  w4: 0.115,
  cup: 0.24, // shallow lengthwise groove
  sideCurl: 0.12,
  wrapWidth: 0.15,
  wrapCup: 0.3,
  waveAmp: 0.012,
  asym: 0.05,
  jitter: 0.06, // a little raggedness — real rays never sit perfectly
  noiseAmp: 0.01,
  noiseFreq: 1,
  shellGap: 0.1,
  windAmp: 0.16, // light rays flutter more than heavy dahlia scales
  windSpeed: 1.6,
  windHeading: 35,
  flat: false, // soft light so the golden disc reads as a dome
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
    name: "Blush Dahlia",
    // Soft pink tips, clear crimson faces, and a deep burgundy centre.
    palette: [
      [0.984, 0.706, 0.737],
      [1.0, 0.435, 0.506],
      [0.773, 0.094, 0.2],
      [0.451, 0.02, 0.102],
      [0.239, 0.012, 0.071],
    ],
    params: CRIMSON_DAHLIA_PARAMS,
  },
  {
    name: "Garland Daisy",
    // White rays that warm into a yellow wash at their base, then a golden
    // disc: white tips (c0-c1), pale-yellow transition (c2), marigold heart
    // (c3-c4). The shader's closeness ramp puts c3/c4 on petal bases and the
    // furled centre florets, which is exactly where the photo carries gold.
    // Rays stay white for their upper two-thirds (c0/c1); the yellow wash is
    // compressed into c2 so it only climbs the lower third of each ray, then
    // c3/c4 carry the marigold disc — matching the photo's colour bands.
    palette: [
      [1.0, 1.0, 0.97],
      [1.0, 0.98, 0.9],
      [1.0, 0.85, 0.42],
      [1.0, 0.65, 0.1],
      [0.85, 0.5, 0.04],
    ],
    params: GARLAND_DAISY_PARAMS,
  },
];

const STUDIO_FLOWERS: FlowerConfig[] = [
  ...GENERATED_FLOWERS,
  ...FLOWER_PRESETS.map((preset, index) => ({
    id: `legacy-preset-${index}`,
    source: "preset" as const,
    ...preset,
    palette: preset.palette as FlowerConfig["palette"],
  })),
];

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export default function StudioCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FlowerSceneApi | null>(null);

  const [bgMode, setBgMode] = useState<BgMode>("solid");
  const [color, setColor] = useState("#000000");
  // Skill-generated flowers use the same loading path as legacy presets.
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [palette, setPalette] = useState<[number, number, number][]>(
    STUDIO_FLOWERS[0].palette,
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
  const [exportPreviewTime, setExportPreviewTime] = useState(0);
  const [exportPreviewPlaying, setExportPreviewPlaying] = useState(false);
  const [designPreviewBloom, setDesignPreviewBloom] = useState(1);
  const [sheetPages, setSheetPages] = useState<StudioSheetPages | null>(null);
  const [petalPreviewResetKey, setPetalPreviewResetKey] = useState(0);
  const [arrangementPreviewResetKey, setArrangementPreviewResetKey] = useState(0);
  const [windPreviewResetKey, setWindPreviewResetKey] = useState(0);

  // Export preview loops over the chosen clip length. Design preview is a
  // separate one-shot scrubber over the flower's native bloom curve.
  const exportPreviewRafRef = useRef<number | null>(null);
  const designPreviewRafRef = useRef<number | null>(null);
  const durationRef = useRef(duration);
  const exportPreviewTimeRef = useRef(0);
  const designPreviewBloomRef = useRef(designPreviewBloom);

  const setExportPreviewClock = (seconds: number) => {
    const rounded = Math.round(seconds * 10) / 10;
    if (rounded === exportPreviewTimeRef.current) return;
    exportPreviewTimeRef.current = rounded;
    setExportPreviewTime(rounded);
  };

  const setDesignPreviewProgress = (progress: number) => {
    const scene = sceneRef.current;
    if (!scene) return;
    const next = Math.min(Math.max(progress, 0), 1);
    if (next !== designPreviewBloomRef.current) {
      designPreviewBloomRef.current = next;
      setDesignPreviewBloom(next);
    }
    scene.setBloom(scene.bloomAt(next * DESIGN_PREVIEW_COMPLETE_PROGRESS));
  };

  const editPose = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.setBloom(scene.bloomMax);
    if (designPreviewBloomRef.current !== 1) {
      designPreviewBloomRef.current = 1;
      setDesignPreviewBloom(1);
    }
  };

  const stopExportPreview = () => {
    if (exportPreviewRafRef.current !== null) {
      cancelAnimationFrame(exportPreviewRafRef.current);
    }
    exportPreviewRafRef.current = null;
    setExportPreviewPlaying(false);
  };

  const stopDesignPreview = () => {
    if (designPreviewRafRef.current !== null) {
      cancelAnimationFrame(designPreviewRafRef.current);
    }
    designPreviewRafRef.current = null;
  };

  const exitExportPreview = () => {
    stopExportPreview();
    setExportPreviewClock(0);
    editPose();
  };

  const toggleExportPreview = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (exportPreviewRafRef.current !== null) {
      exitExportPreview();
      return;
    }
    stopDesignPreview();
    setExportPreviewClock(0);
    scene.setBloom(scene.bloomAt(0));
    setDesignPreviewBloom(0);
    designPreviewBloomRef.current = 0;
    setExportPreviewPlaying(true);
    const start = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000;
      const clipDuration = Math.max(durationRef.current, 0.001);
      const t = elapsed % clipDuration;
      const progress = Math.min(t / scene.bloomDuration, 1);
      setExportPreviewClock(t);
      scene.setBloom(scene.bloomAt(progress));
      const previewProgress = Math.min(
        progress / DESIGN_PREVIEW_COMPLETE_PROGRESS,
        1,
      );
      const roundedProgress = Math.round(previewProgress * 100) / 100;
      if (roundedProgress !== designPreviewBloomRef.current) {
        designPreviewBloomRef.current = roundedProgress;
        setDesignPreviewBloom(roundedProgress);
      }
      exportPreviewRafRef.current = requestAnimationFrame(tick);
    };
    exportPreviewRafRef.current = requestAnimationFrame(tick);
  };

  const handleDesignPreviewBloomChange = (progress: number) => {
    stopExportPreview();
    stopDesignPreview();
    setDesignPreviewProgress(progress);
  };

  const playDesignPreview = () => {
    const scene = sceneRef.current;
    if (!scene) return;
    stopExportPreview();
    stopDesignPreview();
    setExportPreviewClock(0);
    setDesignPreviewProgress(0);
    const start = performance.now();
    const tick = () => {
      const elapsed = (performance.now() - start) / 1000;
      const previewDuration = scene.bloomDuration * DESIGN_PREVIEW_COMPLETE_PROGRESS;
      const progress = Math.min(elapsed / previewDuration, 1);
      scene.setBloom(
        scene.bloomAt(progress * DESIGN_PREVIEW_COMPLETE_PROGRESS),
      );
      const roundedProgress = Math.round(progress * 100) / 100;
      if (roundedProgress !== designPreviewBloomRef.current) {
        designPreviewBloomRef.current = roundedProgress;
        setDesignPreviewBloom(roundedProgress);
      }
      if (progress < 1) {
        designPreviewRafRef.current = requestAnimationFrame(tick);
        return;
      }
      designPreviewRafRef.current = null;
      setDesignPreviewProgress(1);
    };
    designPreviewRafRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // Clean up any running preview loop on unmount.
  useEffect(() => () => {
    stopExportPreview();
    stopDesignPreview();
  }, []);

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
        // The studio exports PNGs from this canvas, so its frame must stay
        // readable after compositing.
        exportSurface: true,
      },
    );
    sceneRef.current = scene;
    const initialFlower = STUDIO_FLOWERS[0];
    scene.applyPreset(initialFlower.params);
    scene.setPalette(initialFlower.palette);
    if (initialFlower.camera) scene.setCameraView(initialFlower.camera);
    scene.setBloom(scene.bloomMax);
    scene.setResetBaseline(initialFlower.params);

    // Touch devices have no wheel and no Opt key, so give them OrbitControls'
    // native two-finger pinch-zoom (dolly). Desktop keeps zoom off and uses the
    // Opt/Alt+scroll handler below.
    if (window.matchMedia("(pointer: coarse)").matches) {
      scene.setWheelZoomEnabled(true);
    }

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
      widths: [number, number, number, number, number];
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
      case "petalLen":
        scene.setPetalLength(value);
        break;
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
    stopExportPreview();
    stopDesignPreview();
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
    const preset = STUDIO_FLOWERS[index];
    if (!preset) return;
    setSelectedPreset(index);
    setPalette(preset.palette);
    stopExportPreview();
    stopDesignPreview();
    const scene = sceneRef.current;
    if (!scene) return;
    scene.applyPreset(preset.params);
    scene.setPalette(preset.palette);
    if (preset.camera) scene.setCameraView(preset.camera);
    // Every reset (all / geometry / arrangement / wind / detail) now returns to
    // THIS flower's params, not the boot rose.
    scene.setResetBaseline(preset.params);
    // Re-assert the fully-open pose so the new flower shows bloomed, not
    // mid-wavefront (curl params shift what the current bloom value means).
    editPose();
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
              presets={STUDIO_FLOWERS}
              selectedPreset={selectedPreset}
              palette={palette}
              outlineEditor={outlineEditor}
              petalPreview={petalPreview}
              arrangementPreview={arrangementPreview}
              windPreview={windPreview}
              previewBloom={designPreviewBloom}
              exporting={exporting}
              onPresetChange={handlePresetChange}
              onPaletteChange={handlePaletteChange}
              onPetalFormChange={handlePetalFormChange}
              onPhyllotaxisChange={handlePhyllotaxisChange}
              onWindChange={handleWindChange}
              onRenderStyleChange={handleRenderStyleChange}
              onPreviewBloomChange={handleDesignPreviewBloomChange}
              onPlayPreview={playDesignPreview}
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
              previewTime={exportPreviewTime}
              playing={exportPreviewPlaying}
              onBgModeChange={setBgMode}
              onColorChange={setColor}
              onImageResChange={setImageRes}
              onVideoResChange={setVideoRes}
              onDurationChange={handleDurationChange}
              onShowCameraFrameChange={setShowCameraFrame}
              onTogglePlay={toggleExportPreview}
              onExportImage={handleExportImage}
              onExportVideo={handleExportVideo}
            />
          </>
        )}
      </div>
    </div>
  );
}
