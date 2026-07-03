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
type AnimationKey = keyof FlowerDesignState["animation"];
type StemKey = keyof FlowerDesignState["stem"];

type DesignPaneParams = Pick<PetalShapeState, PetalFormKey> &
  FlowerDesignState["phyllotaxis"] &
  FlowerDesignState["wind"] &
  FlowerDesignState["animation"] &
  FlowerDesignState["stem"] &
  FlowerDesignState["renderStyle"] & {
    preset: number;
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
  | AnimationKey
  | StemKey
  | "preset",
  RefreshableBlade
> & {
  playButton: ButtonApi;
  resetAllButton: ButtonApi;
};

type DesignPaneRoots = {
  outline: Root;
  preview: Root;
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
  onPresetChange: (index: number) => void;
  onPetalFormChange: (key: PetalFormKey, value: number) => void;
  onPhyllotaxisChange: (key: PhyllotaxisKey, value: number) => void;
  onWindChange: (key: WindKey, value: number) => void;
  onRenderStyleChange: (key: RenderStyleKey, value: boolean) => void;
  onAnimationChange: <K extends AnimationKey>(
    key: K,
    value: FlowerDesignState["animation"][K],
  ) => void;
  onPlayAnimation: () => void;
  onResetAll: () => void;
  onStemChange: <K extends StemKey>(
    key: K,
    value: FlowerDesignState["stem"][K],
  ) => void;
  onResetPetalGeometry: () => void;
};

function optionMap<T extends string | number>(
  entries: Array<{ label: string; value: T }>,
) {
  return entries.reduce<Record<string, T>>((options, entry) => {
    options[entry.label] = entry.value;
    return options;
  }, {});
}

export default function StudioDesignPane({
  pane,
  shape,
  designState,
  presets,
  selectedPreset,
  outlineEditor,
  petalPreview,
  onPresetChange,
  onPetalFormChange,
  onPhyllotaxisChange,
  onWindChange,
  onRenderStyleChange,
  onAnimationChange,
  onPlayAnimation,
  onResetAll,
  onStemChange,
  onResetPetalGeometry,
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
    onAnimationChange,
    onPlayAnimation,
    onResetAll,
    onStemChange,
    onResetPetalGeometry,
  });
  const paramsRef = useRef<DesignPaneParams>({
    preset: selectedPreset,
    curlOpen: shape.curlOpen,
    curlBias: shape.curlBias,
    cup: shape.cup,
    sideCurl: shape.sideCurl,
    waveAmp: shape.waveAmp,
    asym: shape.asym,
    ...designState.phyllotaxis,
    ...designState.wind,
    ...designState.renderStyle,
    ...designState.animation,
    ...designState.stem,
  });

  useEffect(() => {
    callbacksRef.current = {
      onPresetChange,
      onPetalFormChange,
      onPhyllotaxisChange,
      onWindChange,
      onRenderStyleChange,
      onAnimationChange,
      onPlayAnimation,
      onResetAll,
      onStemChange,
      onResetPetalGeometry,
    };
  }, [
    onAnimationChange,
    onPetalFormChange,
    onPhyllotaxisChange,
    onPlayAnimation,
    onPresetChange,
    onResetAll,
    onRenderStyleChange,
    onResetPetalGeometry,
    onStemChange,
    onWindChange,
  ]);

  useEffect(() => {
    const params = paramsRef.current;
    const createdBlades: BladeApi[] = [];

    const renderStyle = pane.addFolder({
      title: "Render Style",
      expanded: true,
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
    const previewResetSlot = document.createElement("div");
    previewResetSlot.className = "studio-design-preview-reset-slot";
    const previewResetButton = document.createElement("button");
    previewResetButton.type = "button";
    previewResetButton.className = "studio-design-preview-reset-button";
    previewResetButton.textContent = "Reset Petal Geometry";
    previewResetButton.addEventListener("click", () => {
      callbacksRef.current.onResetPetalGeometry();
    });
    previewResetSlot.appendChild(previewResetButton);
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

    const getFolderContent = (folder: FolderApi) =>
      folder.element.querySelector(":scope > .tp-fldv_c");
    getFolderContent(petalGeometry)?.insertBefore(previewSlot, outline.element);
    getFolderContent(petalGeometry)?.insertBefore(
      previewResetSlot,
      outline.element,
    );
    getFolderContent(outline)?.appendChild(outlineSlot);

    const previewRoot = createRoot(previewSlot);
    const outlineRoot = createRoot(outlineSlot);
    rootsRef.current = {
      preview: previewRoot,
      outline: outlineRoot,
    };

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
    const phyllotaxis = pane.addFolder({
      title: "Phyllotaxis Layout",
      expanded: false,
    });
    createdBlades.push(phyllotaxis);
    const numPetals = bindNumber(
      phyllotaxis,
      "numPetals",
      "Petals Count",
      5,
      150,
      1,
      0,
    );
    numPetals.on("change", (event) => {
      callbacksRef.current.onPhyllotaxisChange("numPetals", event.value);
    });
    const goldenAngle = bindNumber(
      phyllotaxis,
      "goldenAngle",
      "Golden Angle",
      90,
      180,
      0.1,
    );
    goldenAngle.on("change", (event) => {
      callbacksRef.current.onPhyllotaxisChange("goldenAngle", event.value);
    });
    const radius = bindNumber(phyllotaxis, "radius", "Base Radius", 0.1, 1.5, 0.1);
    radius.on("change", (event) => {
      callbacksRef.current.onPhyllotaxisChange("radius", event.value);
    });
    const radiusBias = bindNumber(
      phyllotaxis,
      "radiusBias",
      "Radius Distribution",
      0.3,
      3,
      0.1,
    );
    radiusBias.on("change", (event) => {
      callbacksRef.current.onPhyllotaxisChange("radiusBias", event.value);
    });
    const height = bindNumber(phyllotaxis, "height", "Receptacle Height", 0, 1, 0.1);
    height.on("change", (event) => {
      callbacksRef.current.onPhyllotaxisChange("height", event.value);
    });
    const heightBias = bindNumber(
      phyllotaxis,
      "heightBias",
      "Height Distribution",
      0.3,
      3,
      0.1,
    );
    heightBias.on("change", (event) => {
      callbacksRef.current.onPhyllotaxisChange("heightBias", event.value);
    });
    const scaleInner = bindNumber(
      phyllotaxis,
      "scaleInner",
      "Inner Scale",
      0.1,
      1,
      0.1,
    );
    scaleInner.on("change", (event) => {
      callbacksRef.current.onPhyllotaxisChange("scaleInner", event.value);
    });
    const tiltInner = bindNumber(
      phyllotaxis,
      "tiltInner",
      "Inner Tilt",
      -0.5,
      1.5,
      0.1,
    );
    tiltInner.on("change", (event) => {
      callbacksRef.current.onPhyllotaxisChange("tiltInner", event.value);
    });
    const outAngle = bindNumber(
      phyllotaxis,
      "outAngle",
      "Outer Angle",
      0,
      120,
      0.1,
    );
    outAngle.on("change", (event) => {
      callbacksRef.current.onPhyllotaxisChange("outAngle", event.value);
    });
    const tiltBias = bindNumber(
      phyllotaxis,
      "tiltBias",
      "Tilt Distribution",
      0.5,
      6,
      0.1,
    );
    tiltBias.on("change", (event) => {
      callbacksRef.current.onPhyllotaxisChange("tiltBias", event.value);
    });

    const wind = pane.addFolder({
      title: "Wind & Jitter",
      expanded: false,
    });
    createdBlades.push(wind);
    const jitter = bindNumber(wind, "jitter", "Petal Jitter", 0, 0.4, 0.01, 2);
    jitter.on("change", (event) => {
      callbacksRef.current.onWindChange("jitter", event.value);
    });
    const shellGap = bindNumber(wind, "shellGap", "Shell Gap", 0, 0.5, 0.01, 2);
    shellGap.on("change", (event) => {
      callbacksRef.current.onWindChange("shellGap", event.value);
    });
    const noiseAmp = bindNumber(wind, "noiseAmp", "Surface Noise Amp", 0, 0.12, 0.01, 2);
    noiseAmp.on("change", (event) => {
      callbacksRef.current.onWindChange("noiseAmp", event.value);
    });
    const noiseFreq = bindNumber(wind, "noiseFreq", "Surface Noise Freq", 1, 15, 0.1);
    noiseFreq.on("change", (event) => {
      callbacksRef.current.onWindChange("noiseFreq", event.value);
    });
    const windAmp = bindNumber(wind, "windAmp", "Wind Amplitude", 0, 0.5, 0.01, 2);
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
    const length = bindNumber(stem, "length", "Stem Length", 0.8, 3, 0.1);
    length.on("change", (event) => {
      callbacksRef.current.onStemChange("length", event.value);
    });
    const leaves = stem.addBinding(params, "leaves", {
      label: "Show Leaves",
    }) as ChangeableBlade<boolean>;
    leaves.on("change", (event) => {
      callbacksRef.current.onStemChange("leaves", event.value);
    });

    const animation = pane.addFolder({
      title: "Animation",
      expanded: false,
    });
    createdBlades.push(animation);
    const bloom = bindNumber(animation, "bloom", "Bloom Progress", 0, 1, 0.01, 2);
    bloom.on("change", (event) => {
      callbacksRef.current.onAnimationChange("bloom", event.value);
    });
    const bloomMax = bindNumber(animation, "bloomMax", "Bloom Limit", 0.5, 1, 0.01, 2);
    bloomMax.on("change", (event) => {
      callbacksRef.current.onAnimationChange("bloomMax", event.value);
    });
    const transition = bindNumber(
      animation,
      "transition",
      "Propagation Width",
      0.05,
      1,
      0.01,
      2,
    );
    transition.on("change", (event) => {
      callbacksRef.current.onAnimationChange("transition", event.value);
    });
    const animate = animation.addBinding(params, "animate", {
      label: "Auto-Animate",
    }) as ChangeableBlade<boolean>;
    animate.on("change", (event) => {
      callbacksRef.current.onAnimationChange("animate", event.value);
    });
    const playButton = animation.addButton({ title: "Play" });
    playButton.on("click", () => {
      callbacksRef.current.onPlayAnimation();
    });

    const resetAllButton = pane.addButton({ title: "Reset All" });
    createdBlades.push(resetAllButton);
    resetAllButton.on("click", () => {
      callbacksRef.current.onResetAll();
    });

    paneRef.current = pane;
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
      bloom,
      bloomMax,
      transition,
      animate,
      playButton,
      resetAllButton,
    };

    return () => {
      const roots = rootsRef.current;
      if (roots) {
        window.setTimeout(() => {
          roots.preview.unmount();
          roots.outline.unmount();
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
    const params = paramsRef.current;
    params.preset = selectedPreset;
    params.curlOpen = shape.curlOpen;
    params.curlBias = shape.curlBias;
    params.cup = shape.cup;
    params.sideCurl = shape.sideCurl;
    params.waveAmp = shape.waveAmp;
    params.asym = shape.asym;
    Object.assign(params, designState.phyllotaxis);
    Object.assign(params, designState.wind);
    Object.assign(params, designState.renderStyle);
    Object.assign(params, designState.animation);
    Object.assign(params, designState.stem);

    const bindings = bindingsRef.current;
    if (!bindings) return;

    Object.values(bindings).forEach((binding) => {
      if ("refresh" in binding) binding.refresh();
    });
  }, [designState, selectedPreset, shape]);

  return null;
}

export type {
  AnimationKey,
  PetalFormKey,
  PhyllotaxisKey,
  WindKey,
  RenderStyleKey,
  StemKey,
};
