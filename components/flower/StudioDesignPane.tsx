"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  type BladeApi,
  type ButtonApi,
  type FolderApi,
  type TabPageApi,
} from "tweakpane";
import type { FlowerDesignState, PetalShapeState } from "./flowerScene";

type PetalFormKey =
  | "curlOpen"
  | "curlBias"
  | "cup"
  | "sideCurl"
  | "waveAmp"
  | "asym";

type PhyllotaxisKey = keyof FlowerDesignState["phyllotaxis"];
type WindKey = keyof FlowerDesignState["wind"];
type RenderStyleKey = keyof FlowerDesignState["renderStyle"];
type StemKey = keyof FlowerDesignState["stem"];

type DesignPaneParams = Pick<PetalShapeState, PetalFormKey> &
  FlowerDesignState["phyllotaxis"] &
  FlowerDesignState["wind"] &
  FlowerDesignState["stem"] &
  FlowerDesignState["renderStyle"] & {
    preset: number;
    duration: number;
    previewTime: number;
  };

type RefreshableBlade = BladeApi & {
  refresh: () => void;
};

type ChangeableBlade<T> = RefreshableBlade & {
  on: (
    eventName: "change",
    handler: (event: { value: T }) => void,
  ) => ChangeableBlade<T>;
};

type DesignPaneBindings = Record<
  | PetalFormKey
  | PhyllotaxisKey
  | WindKey
  | RenderStyleKey
  | StemKey
  | "preset"
  | "duration"
  | "previewTime",
  RefreshableBlade
> & {
  playPreviewButton: ButtonApi;
  resetAllButton: ButtonApi;
};

type DesignPaneRoots = {
  outline: Root;
  preview: Root;
  arrangement: Root;
  wind: Root;
};

type DesignPanePreset = {
  name: string;
};

type StudioDesignPaneProps = {
  pane: TabPageApi;
  shape: PetalShapeState;
  designState: FlowerDesignState;
  presets: DesignPanePreset[];
  selectedPreset: number;
  outlineEditor: ReactNode;
  petalPreview: ReactNode;
  arrangementPreview: ReactNode;
  windPreview: ReactNode;
  duration: number;
  previewTime: number;
  playing: boolean;
  exporting: boolean;
  onPresetChange: (index: number) => void;
  onPetalFormChange: (key: PetalFormKey, value: number) => void;
  onPhyllotaxisChange: (key: PhyllotaxisKey, value: number) => void;
  onWindChange: (key: WindKey, value: number) => void;
  onRenderStyleChange: (key: RenderStyleKey, value: boolean) => void;
  onDurationChange: (duration: number) => void;
  onTogglePlay: () => void;
  onResetAll: () => void;
  onStemChange: <K extends StemKey>(
    key: K,
    value: FlowerDesignState["stem"][K],
  ) => void;
  onResetPetalGeometry: () => void;
  onResetArrangement: () => void;
  onResetWind: () => void;
  onResetNaturalDetail: () => void;
};

function optionMap<T extends string | number>(
  entries: Array<{ label: string; value: T }>,
) {
  return entries.reduce<Record<string, T>>((options, entry) => {
    options[entry.label] = entry.value;
    return options;
  }, {});
}

const noop = () => {};
// Swapped in while the refresh loop runs: tweakpane fires change events
// synchronously from refresh() when a value moved, and letting those echo
// into the scene would re-apply stale values (e.g. revert a rebuild that is
// still queued behind requestAnimationFrame).
const SYNC_GUARD_CALLBACKS = {
  onPresetChange: noop,
  onPetalFormChange: noop,
  onPhyllotaxisChange: noop,
  onWindChange: noop,
  onRenderStyleChange: noop,
  onDurationChange: noop,
  onTogglePlay: noop,
  onResetAll: noop,
  onStemChange: noop,
  onResetPetalGeometry: noop,
  onResetArrangement: noop,
  onResetWind: noop,
  onResetNaturalDetail: noop,
};

function setPreviewExitState(button: ButtonApi, active: boolean) {
  button.element.classList.toggle("is-preview-exit", active);
  const tip = active ? "Preview is playing. Click to exit preview." : "";
  if (button.element.title !== tip) button.element.title = tip;
  const action = button.element.querySelector<HTMLButtonElement>(".tp-btnv_b");
  if (action && action.title !== tip) action.title = tip;
}

export default function StudioDesignPane({
  pane,
  shape,
  designState,
  presets,
  selectedPreset,
  outlineEditor,
  petalPreview,
  arrangementPreview,
  windPreview,
  duration,
  previewTime,
  playing,
  exporting,
  onPresetChange,
  onPetalFormChange,
  onPhyllotaxisChange,
  onWindChange,
  onRenderStyleChange,
  onDurationChange,
  onTogglePlay,
  onResetAll,
  onStemChange,
  onResetPetalGeometry,
  onResetArrangement,
  onResetWind,
  onResetNaturalDetail,
}: StudioDesignPaneProps) {
  const paneRef = useRef<TabPageApi | null>(null);
  const bindingsRef = useRef<DesignPaneBindings | null>(null);
  const rootsRef = useRef<DesignPaneRoots | null>(null);
  const callbacksRef = useRef({
    onPresetChange,
    onPetalFormChange,
    onPhyllotaxisChange,
    onWindChange,
    onRenderStyleChange,
    onDurationChange,
    onTogglePlay,
    onResetAll,
    onStemChange,
    onResetPetalGeometry,
    onResetArrangement,
    onResetWind,
    onResetNaturalDetail,
  });
  const paramsRef = useRef<DesignPaneParams>({
    preset: selectedPreset,
    duration,
    previewTime,
    curlOpen: shape.curlOpen,
    curlBias: shape.curlBias,
    cup: shape.cup,
    sideCurl: shape.sideCurl,
    waveAmp: shape.waveAmp,
    asym: shape.asym,
    ...designState.phyllotaxis,
    ...designState.wind,
    ...designState.renderStyle,
    ...designState.stem,
  });

  useEffect(() => {
    callbacksRef.current = {
      onPresetChange,
      onPetalFormChange,
      onPhyllotaxisChange,
      onWindChange,
      onRenderStyleChange,
      onDurationChange,
      onTogglePlay,
      onResetAll,
      onStemChange,
      onResetPetalGeometry,
      onResetArrangement,
      onResetWind,
      onResetNaturalDetail,
    };
  }, [
    onDurationChange,
    onPetalFormChange,
    onPhyllotaxisChange,
    onPresetChange,
    onResetAll,
    onRenderStyleChange,
    onResetArrangement,
    onResetNaturalDetail,
    onResetPetalGeometry,
    onResetWind,
    onStemChange,
    onTogglePlay,
    onWindChange,
  ]);

  useEffect(() => {
    const params = paramsRef.current;
    const createdBlades: BladeApi[] = [];

    const renderStyle = pane.addFolder({
      title: "Render Style",
      expanded: false,
    });
    createdBlades.push(renderStyle);
    const preset = renderStyle.addBinding(params, "preset", {
      label: "Preset",
      options: optionMap(presets.map((presetItem, index) => ({
        label: presetItem.name,
        value: index,
      }))),
    }) as ChangeableBlade<number>;
    preset.on("change", (event) => {
      callbacksRef.current.onPresetChange(event.value);
    });
    const flat = renderStyle.addBinding(params, "flat", {
      label: "Flat Shading",
    }) as ChangeableBlade<boolean>;
    flat.on("change", (event) => {
      callbacksRef.current.onRenderStyleChange("flat", event.value);
    });

    const petalGeometry = pane.addFolder({
      title: "Petal Geometry",
      expanded: true,
    });
    createdBlades.push(petalGeometry);
    const previewSlot = document.createElement("div");
    previewSlot.className = "studio-design-preview-slot";
    const outlineSlot = document.createElement("div");
    outlineSlot.className = "studio-design-outline-slot";
    const outline = petalGeometry.addFolder({
      title: "Outline",
      expanded: true,
    });
    const form = petalGeometry.addFolder({
      title: "3D Form",
      expanded: true,
    });
    const resetPetalGeometryButton = petalGeometry.addButton({
      title: "Reset Geometry",
    });
    resetPetalGeometryButton.element.classList.add("studio-soft-reset-button");
    resetPetalGeometryButton.on("click", () => {
      callbacksRef.current.onResetPetalGeometry();
    });

    const getFolderContent = (folder: FolderApi) =>
      folder.element.querySelector(":scope > .tp-fldv_c");
    getFolderContent(petalGeometry)?.insertBefore(previewSlot, outline.element);
    getFolderContent(outline)?.appendChild(outlineSlot);

    const previewRoot = createRoot(previewSlot);
    const outlineRoot = createRoot(outlineSlot);

    const bindNumber = <K extends keyof DesignPaneParams>(
      folder: FolderApi,
      key: K,
      label: string,
      min: number,
      max: number,
      step: number,
      digits = 1,
    ) => {
      const binding = folder.addBinding(params, key, {
        label,
        min,
        max,
        step,
        format: (value) => value.toFixed(digits),
      }) as ChangeableBlade<number>;
      return binding;
    };

    const curlOpen = bindNumber(form, "curlOpen", "Lengthwise Curl", -1.5, 1, 0.1);
    curlOpen.on("change", (event) => {
      callbacksRef.current.onPetalFormChange("curlOpen", event.value);
    });
    const curlBias = bindNumber(form, "curlBias", "Curl Focus", 0.3, 4, 0.1);
    curlBias.on("change", (event) => {
      callbacksRef.current.onPetalFormChange("curlBias", event.value);
    });
    const cup = bindNumber(form, "cup", "Cup Depth", 0, 1.5, 0.1);
    cup.on("change", (event) => {
      callbacksRef.current.onPetalFormChange("cup", event.value);
    });
    const sideCurl = bindNumber(form, "sideCurl", "Edge Roll", -3, 3, 0.1);
    sideCurl.on("change", (event) => {
      callbacksRef.current.onPetalFormChange("sideCurl", event.value);
    });
    const waveAmp = bindNumber(form, "waveAmp", "Edge Wave", 0, 0.08, 0.01, 2);
    waveAmp.on("change", (event) => {
      callbacksRef.current.onPetalFormChange("waveAmp", event.value);
    });
    const asym = bindNumber(form, "asym", "Asymmetry", -0.4, 0.4, 0.1);
    asym.on("change", (event) => {
      callbacksRef.current.onPetalFormChange("asym", event.value);
    });
    // "Petal Arrangement" = phyllotaxis. Overall shape first (count, size,
    // dome, inner/outer petals), fine-tuning curves last.
    const arrangement = pane.addFolder({
      title: "Petal Arrangement",
      expanded: false,
    });
    createdBlades.push(arrangement);
    const numPetals = bindNumber(
      arrangement,
      "numPetals",
      "Petal Count",
      5,
      150,
      1,
      0,
    );
    numPetals.on("change", (event) => {
      callbacksRef.current.onPhyllotaxisChange("numPetals", event.value);
    });
    const radius = bindNumber(arrangement, "radius", "Bloom Radius", 0.1, 1.5, 0.1);
    radius.on("change", (event) => {
      callbacksRef.current.onPhyllotaxisChange("radius", event.value);
    });
    const height = bindNumber(arrangement, "height", "Center Height", 0, 1, 0.1);
    height.on("change", (event) => {
      callbacksRef.current.onPhyllotaxisChange("height", event.value);
    });
    const scaleInner = bindNumber(
      arrangement,
      "scaleInner",
      "Inner Petal Size",
      0.1,
      1,
      0.1,
    );
    scaleInner.on("change", (event) => {
      callbacksRef.current.onPhyllotaxisChange("scaleInner", event.value);
    });
    const tiltInner = bindNumber(
      arrangement,
      "tiltInner",
      "Inner Petal Tilt",
      -0.5,
      1.5,
      0.1,
    );
    tiltInner.on("change", (event) => {
      callbacksRef.current.onPhyllotaxisChange("tiltInner", event.value);
    });
    const outAngle = bindNumber(
      arrangement,
      "outAngle",
      "Outer Petal Angle",
      0,
      120,
      0.1,
    );
    outAngle.on("change", (event) => {
      callbacksRef.current.onPhyllotaxisChange("outAngle", event.value);
    });
    const goldenAngle = bindNumber(
      arrangement,
      "goldenAngle",
      "Spiral Angle",
      90,
      180,
      0.1,
    );
    goldenAngle.on("change", (event) => {
      callbacksRef.current.onPhyllotaxisChange("goldenAngle", event.value);
    });
    const radiusBias = bindNumber(
      arrangement,
      "radiusBias",
      "Radial Spread",
      0.3,
      3,
      0.1,
    );
    radiusBias.on("change", (event) => {
      callbacksRef.current.onPhyllotaxisChange("radiusBias", event.value);
    });
    const heightBias = bindNumber(
      arrangement,
      "heightBias",
      "Height Taper",
      0.3,
      3,
      0.1,
    );
    heightBias.on("change", (event) => {
      callbacksRef.current.onPhyllotaxisChange("heightBias", event.value);
    });
    const tiltBias = bindNumber(
      arrangement,
      "tiltBias",
      "Tilt Falloff",
      0.5,
      6,
      0.1,
    );
    tiltBias.on("change", (event) => {
      callbacksRef.current.onPhyllotaxisChange("tiltBias", event.value);
    });
    const resetArrangementButton = arrangement.addButton({
      title: "Reset Arrangement",
    });
    resetArrangementButton.element.classList.add("studio-soft-reset-button");
    resetArrangementButton.on("click", () => {
      callbacksRef.current.onResetArrangement();
    });
    // Foreign DOM must go in after every blade exists — tweakpane positions
    // new blades by rack index, so an earlier insert would shuffle them.
    const arrangementSlot = document.createElement("div");
    arrangementSlot.className = "studio-design-preview-slot";
    getFolderContent(arrangement)?.insertBefore(
      arrangementSlot,
      numPetals.element,
    );
    const arrangementRoot = createRoot(arrangementSlot);

    // Wind proper: exactly the parameters the demo box visualises.
    const wind = pane.addFolder({
      title: "Wind",
      expanded: false,
    });
    createdBlades.push(wind);
    const windAmp = bindNumber(wind, "windAmp", "Wind Strength", 0, 0.5, 0.01, 2);
    windAmp.on("change", (event) => {
      callbacksRef.current.onWindChange("windAmp", event.value);
    });
    const windSpeed = bindNumber(wind, "windSpeed", "Wind Speed", 0, 4, 0.1);
    windSpeed.on("change", (event) => {
      callbacksRef.current.onWindChange("windSpeed", event.value);
    });
    const windHeading = bindNumber(wind, "windHeading", "Wind Direction", 0, 360, 1, 0);
    windHeading.on("change", (event) => {
      callbacksRef.current.onWindChange("windHeading", event.value);
    });
    const resetWindButton = wind.addButton({ title: "Reset Wind" });
    resetWindButton.element.classList.add("studio-soft-reset-button");
    resetWindButton.on("click", () => {
      callbacksRef.current.onResetWind();
    });
    const windSlot = document.createElement("div");
    windSlot.className = "studio-design-preview-slot";
    getFolderContent(wind)?.insertBefore(windSlot, windAmp.element);
    const windRoot = createRoot(windSlot);

    // Petal-surface irregularity — affects the petals themselves, not the
    // wind, so it lives apart from the wind demo.
    const detail = pane.addFolder({
      title: "Natural Detail",
      expanded: false,
    });
    createdBlades.push(detail);
    const jitter = bindNumber(detail, "jitter", "Petal Randomness", 0, 0.4, 0.01, 2);
    jitter.on("change", (event) => {
      callbacksRef.current.onWindChange("jitter", event.value);
    });
    const noiseAmp = bindNumber(detail, "noiseAmp", "Surface Ripple", 0, 0.12, 0.01, 2);
    noiseAmp.on("change", (event) => {
      callbacksRef.current.onWindChange("noiseAmp", event.value);
    });
    const noiseFreq = bindNumber(detail, "noiseFreq", "Ripple Detail", 1, 15, 0.1);
    noiseFreq.on("change", (event) => {
      callbacksRef.current.onWindChange("noiseFreq", event.value);
    });
    const shellGap = bindNumber(detail, "shellGap", "Closed Bud Gap", 0, 0.5, 0.01, 2);
    shellGap.on("change", (event) => {
      callbacksRef.current.onWindChange("shellGap", event.value);
    });
    const resetDetailButton = detail.addButton({ title: "Reset Detail" });
    resetDetailButton.element.classList.add("studio-soft-reset-button");
    resetDetailButton.on("click", () => {
      callbacksRef.current.onResetNaturalDetail();
    });

    const stem = pane.addFolder({
      title: "Stem & Leaves",
      expanded: false,
    });
    createdBlades.push(stem);
    const show = stem.addBinding(params, "show", {
      label: "Show Stem",
    }) as ChangeableBlade<boolean>;
    show.on("change", (event) => {
      callbacksRef.current.onStemChange("show", event.value);
    });
    const leaves = stem.addBinding(params, "leaves", {
      label: "Show Leaves",
    }) as ChangeableBlade<boolean>;
    leaves.on("change", (event) => {
      callbacksRef.current.onStemChange("leaves", event.value);
    });
    const length = bindNumber(stem, "length", "Stem Length", 0.8, 3, 0.1);
    length.on("change", (event) => {
      callbacksRef.current.onStemChange("length", event.value);
    });

    // Mirrors Export → Video Export's preview trio (duration / clock / play),
    // minus resolution and the export button.
    const animationPreview = pane.addFolder({
      title: "Animation Preview",
      expanded: true,
    });
    createdBlades.push(animationPreview);
    const durationBinding = animationPreview.addBinding(params, "duration", {
      label: "Duration",
      min: 2,
      max: 10,
      step: 1,
      format: (value) => `${value.toFixed(0)}s`,
    }) as ChangeableBlade<number>;
    durationBinding.on("change", (event) => {
      callbacksRef.current.onDurationChange(event.value);
    });
    const previewTimeBinding = animationPreview.addBinding(params, "previewTime", {
      label: "Time",
      readonly: true,
      // Manual ticker — the refresh effect drives updates; no idle polling.
      interval: 0,
      format: (value) => `${value.toFixed(1)}s`,
    }) as RefreshableBlade;
    const playPreviewButton = animationPreview.addButton({
      title: "Play",
    });
    playPreviewButton.element.classList.add("studio-export-preview-button");
    playPreviewButton.on("click", () => {
      callbacksRef.current.onTogglePlay();
    });

    const resetAllButton = pane.addButton({ title: "Reset All" });
    resetAllButton.hidden = true;
    createdBlades.push(resetAllButton);
    resetAllButton.on("click", () => {
      callbacksRef.current.onResetAll();
    });

    paneRef.current = pane;
    rootsRef.current = {
      preview: previewRoot,
      outline: outlineRoot,
      arrangement: arrangementRoot,
      wind: windRoot,
    };
    bindingsRef.current = {
      preset,
      flat,
      curlOpen,
      curlBias,
      cup,
      sideCurl,
      waveAmp,
      asym,
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
      jitter,
      shellGap,
      noiseAmp,
      noiseFreq,
      windAmp,
      windSpeed,
      windHeading,
      show,
      length,
      leaves,
      duration: durationBinding,
      previewTime: previewTimeBinding,
      playPreviewButton,
      resetAllButton,
    };

    return () => {
      const roots = rootsRef.current;
      if (roots) {
        window.setTimeout(() => {
          roots.preview.unmount();
          roots.outline.unmount();
          roots.arrangement.unmount();
          roots.wind.unmount();
        }, 0);
      }
      rootsRef.current = null;
      bindingsRef.current = null;
      paneRef.current = null;
      createdBlades.forEach((blade) => {
        try {
          pane.remove(blade);
        } catch {
          // The shared root may already be disposed during page teardown.
        }
      });
    };
  }, [pane, presets]);

  useEffect(() => {
    rootsRef.current?.preview.render(petalPreview);
    rootsRef.current?.outline.render(outlineEditor);
  }, [outlineEditor, petalPreview]);

  useEffect(() => {
    rootsRef.current?.arrangement.render(arrangementPreview);
  }, [arrangementPreview]);

  useEffect(() => {
    rootsRef.current?.wind.render(windPreview);
  }, [windPreview]);

  useEffect(() => {
    const params = paramsRef.current;
    const bindings = bindingsRef.current;
    const next: DesignPaneParams = {
      preset: selectedPreset,
      duration,
      previewTime,
      curlOpen: shape.curlOpen,
      curlBias: shape.curlBias,
      cup: shape.cup,
      sideCurl: shape.sideCurl,
      waveAmp: shape.waveAmp,
      asym: shape.asym,
      ...designState.phyllotaxis,
      ...designState.wind,
      ...designState.renderStyle,
      ...designState.stem,
    };

    // Refresh only the bindings whose value actually changed — a full-pane
    // refresh here would touch ~30 DOM inputs 10x/s during preview playback.
    // Callbacks are muted for the duration: refresh() emits change events.
    const activeCallbacks = callbacksRef.current;
    callbacksRef.current = SYNC_GUARD_CALLBACKS;
    try {
      for (const key of Object.keys(next) as Array<keyof DesignPaneParams>) {
        if (Object.is(params[key], next[key])) continue;
        params[key] = next[key] as never;
        const binding = bindings?.[key];
        if (binding && "refresh" in binding) binding.refresh();
      }
    } finally {
      callbacksRef.current = activeCallbacks;
    }

    if (!bindings) return;
    const playTitle = playing ? "Exit Preview" : "Play";
    if (bindings.playPreviewButton.title !== playTitle) {
      bindings.playPreviewButton.title = playTitle;
    }
    setPreviewExitState(bindings.playPreviewButton, playing);
    if (bindings.duration.disabled !== exporting) {
      bindings.duration.disabled = exporting;
    }
    if (bindings.playPreviewButton.disabled !== exporting) {
      bindings.playPreviewButton.disabled = exporting;
    }
  }, [designState, duration, exporting, playing, previewTime, selectedPreset, shape]);

  return null;
}

export type {
  PetalFormKey,
  PhyllotaxisKey,
  WindKey,
  RenderStyleKey,
  StemKey,
};
