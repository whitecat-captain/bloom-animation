"use client";

import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { type BladeApi, type ButtonApi, type TabPageApi } from "tweakpane";
import type { FlowerConfig, FlowerPalette } from "./flowerConfig";
import { StudioPaletteStrip } from "./StudioSheetControls";

type QuickPaneParams = {
  preset: number;
  fullness: number;
  movement: number;
  previewBloom: number;
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

type QuickPaneBindings = {
  preset: RefreshableBlade;
  fullness: RefreshableBlade;
  movement: RefreshableBlade;
  previewBloom: RefreshableBlade;
  replayButton: ButtonApi;
  restoreButton: ButtonApi;
};

type StudioQuickPaneProps = {
  pane: TabPageApi;
  presets: Pick<FlowerConfig, "name">[];
  selectedPreset: number;
  palette: FlowerPalette;
  fullness: number;
  movement: number;
  previewBloom: number;
  exporting: boolean;
  onPresetChange: (index: number) => void;
  onPaletteChange: (index: number, rgb: [number, number, number]) => void;
  onFullnessChange: (adjustment: number) => void;
  onMovementChange: (strength: number) => void;
  onPreviewBloomChange: (progress: number) => void;
  onReplayBloom: () => void;
  onRestoreResult: () => void;
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
const SYNC_GUARD_CALLBACKS = {
  onPresetChange: noop,
  onPaletteChange: noop,
  onFullnessChange: noop,
  onMovementChange: noop,
  onPreviewBloomChange: noop,
  onReplayBloom: noop,
  onRestoreResult: noop,
};

export default function StudioQuickPane({
  pane,
  presets,
  selectedPreset,
  palette,
  fullness,
  movement,
  previewBloom,
  exporting,
  onPresetChange,
  onPaletteChange,
  onFullnessChange,
  onMovementChange,
  onPreviewBloomChange,
  onReplayBloom,
  onRestoreResult,
}: StudioQuickPaneProps) {
  const bindingsRef = useRef<QuickPaneBindings | null>(null);
  const paletteRootRef = useRef<Root | null>(null);
  const callbacksRef = useRef({
    onPresetChange,
    onPaletteChange,
    onFullnessChange,
    onMovementChange,
    onPreviewBloomChange,
    onReplayBloom,
    onRestoreResult,
  });
  const paramsRef = useRef<QuickPaneParams>({
    preset: selectedPreset,
    fullness,
    movement,
    previewBloom: previewBloom * 100,
  });

  useEffect(() => {
    callbacksRef.current = {
      onPresetChange,
      onPaletteChange,
      onFullnessChange,
      onMovementChange,
      onPreviewBloomChange,
      onReplayBloom,
      onRestoreResult,
    };
  }, [
    onFullnessChange,
    onMovementChange,
    onPaletteChange,
    onPresetChange,
    onPreviewBloomChange,
    onReplayBloom,
    onRestoreResult,
  ]);

  useEffect(() => {
    const params = paramsRef.current;
    const createdBlades: BladeApi[] = [];

    const preset = pane.addBinding(params, "preset", {
      label: "Flower",
      options: optionMap(
        presets.map((presetItem, index) => ({
          label: presetItem.name,
          value: index,
        })),
      ),
    }) as ChangeableBlade<number>;
    createdBlades.push(preset);
    preset.on("change", (event) => {
      callbacksRef.current.onPresetChange(event.value);
    });

    const fullnessBinding = pane.addBinding(params, "fullness", {
      label: "Fullness",
      min: -25,
      max: 25,
      step: 1,
      format: (value) =>
        value === 0
          ? "Original"
          : `${value > 0 ? "+" : ""}${value.toFixed(0)}%`,
    }) as ChangeableBlade<number>;
    createdBlades.push(fullnessBinding);
    fullnessBinding.on("change", (event) => {
      callbacksRef.current.onFullnessChange(event.value);
    });

    const movementBinding = pane.addBinding(params, "movement", {
      label: "Movement",
      min: 0,
      max: 100,
      step: 1,
      format: (value) => `${value.toFixed(0)}%`,
    }) as ChangeableBlade<number>;
    createdBlades.push(movementBinding);
    movementBinding.on("change", (event) => {
      callbacksRef.current.onMovementChange(event.value);
    });

    const paletteSlot = document.createElement("div");
    paletteSlot.className = "studio-sheet-control-slot studio-quick-palette-slot";
    movementBinding.element.parentElement?.insertBefore(
      paletteSlot,
      movementBinding.element,
    );
    paletteRootRef.current = createRoot(paletteSlot);

    const previewBloomBinding = pane.addBinding(params, "previewBloom", {
      label: "Bloom Preview",
      min: 0,
      max: 100,
      step: 1,
      format: (value) => `${value.toFixed(0)}%`,
    }) as ChangeableBlade<number>;
    createdBlades.push(previewBloomBinding);
    previewBloomBinding.on("change", (event) => {
      callbacksRef.current.onPreviewBloomChange(event.value / 100);
    });

    const replayButton = pane.addButton({ title: "Replay Bloom" });
    replayButton.element.classList.add(
      "studio-export-preview-button",
      "studio-design-preview-button",
    );
    createdBlades.push(replayButton);
    replayButton.on("click", () => {
      callbacksRef.current.onReplayBloom();
    });

    const restoreButton = pane.addButton({ title: "Restore AI Result" });
    restoreButton.element.classList.add("studio-soft-reset-button");
    createdBlades.push(restoreButton);
    restoreButton.on("click", () => {
      callbacksRef.current.onRestoreResult();
    });

    bindingsRef.current = {
      preset,
      fullness: fullnessBinding,
      movement: movementBinding,
      previewBloom: previewBloomBinding,
      replayButton,
      restoreButton,
    };

    return () => {
      const paletteRoot = paletteRootRef.current;
      if (paletteRoot) {
        window.setTimeout(() => paletteRoot.unmount(), 0);
      }
      paletteRootRef.current = null;
      bindingsRef.current = null;
      paletteSlot.remove();
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
    const params = paramsRef.current;
    const bindings = bindingsRef.current;
    if (!bindings) return;

    const next: QuickPaneParams = {
      preset: selectedPreset,
      fullness,
      movement,
      previewBloom: previewBloom * 100,
    };
    const activeCallbacks = callbacksRef.current;
    callbacksRef.current = SYNC_GUARD_CALLBACKS;
    try {
      for (const key of Object.keys(next) as Array<keyof QuickPaneParams>) {
        if (Object.is(params[key], next[key])) continue;
        params[key] = next[key];
        bindings[key].refresh();
      }
    } finally {
      callbacksRef.current = activeCallbacks;
    }

    const setDisabled = (
      blade: RefreshableBlade | ButtonApi,
      disabled: boolean,
    ) => {
      if (blade.disabled !== disabled) blade.disabled = disabled;
    };
    setDisabled(bindings.preset, exporting);
    setDisabled(bindings.fullness, exporting);
    setDisabled(bindings.movement, exporting);
    setDisabled(bindings.previewBloom, exporting);
    setDisabled(bindings.replayButton, exporting);
    setDisabled(bindings.restoreButton, exporting);
  }, [exporting, fullness, movement, previewBloom, selectedPreset]);

  useEffect(() => {
    paletteRootRef.current?.render(
      <StudioPaletteStrip
        label="Colours"
        palette={palette}
        disabled={exporting}
        onChange={(index, rgb) =>
          callbacksRef.current.onPaletteChange(index, rgb)
        }
      />,
    );
  }, [exporting, palette]);

  return null;
}
