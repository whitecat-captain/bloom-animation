"use client";

import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  type BladeApi,
  type ButtonApi,
  type FolderApi,
  type TabPageApi,
} from "tweakpane";
import {
  StudioSwitchButton,
  StudioTwoButtonSelect,
} from "./StudioSheetControls";

type BgMode = "transparent" | "solid";

export type StudioExportPreset = {
  name: string;
  stops: [number, number, number][];
};

export type StudioExportResolution = {
  label: string;
  h: number;
};

type ExportPaneParams = {
  color: string;
  imageRes: number;
  videoRes: number;
  duration: number;
  previewTime: number;
  progress: number;
  transparentOutput: string;
  orbitControl: string;
  panControl: string;
  zoomControl: string;
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

type ExportPaneBindings = {
  color: RefreshableBlade;
  imageRes: RefreshableBlade;
  videoRes: RefreshableBlade;
  duration: RefreshableBlade;
  previewTime: RefreshableBlade;
  progress: RefreshableBlade;
  transparentOutput: RefreshableBlade;
  imageButton: ButtonApi;
  playButton: ButtonApi;
  videoButton: ButtonApi;
};

type ExportPaneRoots = {
  bgMode: Root;
  cameraFrame: Root;
};

type StudioExportPaneProps = {
  pane: TabPageApi;
  resolutions: StudioExportResolution[];
  bgMode: BgMode;
  color: string;
  imageRes: number;
  videoRes: number;
  duration: number;
  previewTime: number;
  showCameraFrame: boolean;
  exporting: boolean;
  exportKind: "image" | "video" | null;
  progress: number;
  playing: boolean;
  onBgModeChange: (mode: BgMode) => void;
  onColorChange: (color: string) => void;
  onImageResChange: (index: number) => void;
  onVideoResChange: (index: number) => void;
  onDurationChange: (duration: number) => void;
  onShowCameraFrameChange: (show: boolean) => void;
  onTogglePlay: () => void;
  onExportImage: () => void;
  onExportVideo: () => void;
};

const TRANSPARENT_OUTPUT_NOTE =
  "PNG sequence (.zip) with alpha. ffmpeg: -framerate 30 -i flower_%04d.png -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le flower.mov";

const BG_MODE_OPTIONS: [
  { label: string; value: BgMode },
  { label: string; value: BgMode },
] = [
  { label: "Solid", value: "solid" },
  { label: "Transparent", value: "transparent" },
];

function optionMap<T extends string | number>(
  entries: Array<{ label: string; value: T }>,
) {
  return entries.reduce<Record<string, T>>((options, entry) => {
    options[entry.label] = entry.value;
    return options;
  }, {});
}

export default function StudioExportPane({
  pane,
  resolutions,
  bgMode,
  color,
  imageRes,
  videoRes,
  duration,
  previewTime,
  showCameraFrame,
  exporting,
  exportKind,
  progress,
  playing,
  onBgModeChange,
  onColorChange,
  onImageResChange,
  onVideoResChange,
  onDurationChange,
  onShowCameraFrameChange,
  onTogglePlay,
  onExportImage,
  onExportVideo,
}: StudioExportPaneProps) {
  const paneRef = useRef<TabPageApi | null>(null);
  const bindingsRef = useRef<ExportPaneBindings | null>(null);
  const rootsRef = useRef<ExportPaneRoots | null>(null);
  const callbacksRef = useRef({
    onBgModeChange,
    onColorChange,
    onImageResChange,
    onVideoResChange,
    onDurationChange,
    onShowCameraFrameChange,
    onTogglePlay,
    onExportImage,
    onExportVideo,
  });
  const paramsRef = useRef<ExportPaneParams>({
    color,
    imageRes,
    videoRes,
    duration,
    previewTime,
    progress,
    transparentOutput: TRANSPARENT_OUTPUT_NOTE,
    orbitControl: "Left drag",
    panControl: "Right drag",
    zoomControl: "Scroll",
  });

  useEffect(() => {
    callbacksRef.current = {
      onBgModeChange,
      onColorChange,
      onImageResChange,
      onVideoResChange,
      onDurationChange,
      onShowCameraFrameChange,
      onTogglePlay,
      onExportImage,
      onExportVideo,
    };
  }, [
    onBgModeChange,
    onColorChange,
    onDurationChange,
    onExportImage,
    onExportVideo,
    onImageResChange,
    onShowCameraFrameChange,
    onTogglePlay,
    onVideoResChange,
  ]);

  useEffect(() => {
    const params = paramsRef.current;
    const createdBlades: BladeApi[] = [];

    const background = pane.addFolder({
      title: "Background",
      expanded: true,
    });
    createdBlades.push(background);
    const getFolderContent = (folder: FolderApi) =>
      folder.element.querySelector(":scope > .tp-fldv_c");
    const bgModeSlot = document.createElement("div");
    bgModeSlot.className = "studio-sheet-control-slot";

    const colorBinding = background.addBinding(params, "color", {
      label: "Color",
      picker: "inline",
      expanded: true,
    }) as ChangeableBlade<string>;
    getFolderContent(background)?.insertBefore(
      bgModeSlot,
      colorBinding.element,
    );
    colorBinding.on("change", (event) => {
      callbacksRef.current.onColorChange(event.value);
    });

    const image = pane.addFolder({
      title: "Image Export",
      expanded: true,
    });
    createdBlades.push(image);
    const imageResBinding = image.addBinding(params, "imageRes", {
      label: "Resolution",
      options: optionMap(resolutions.map((resolution, index) => ({
        label: resolution.label,
        value: index,
      }))),
    }) as ChangeableBlade<number>;
    imageResBinding.on("change", (event) => {
      callbacksRef.current.onImageResChange(event.value);
    });
    const imageButton = image.addButton({ title: "Export Image" });
    imageButton.on("click", () => {
      callbacksRef.current.onExportImage();
    });

    const video = pane.addFolder({
      title: "Video Export",
      expanded: true,
    });
    createdBlades.push(video);
    const videoResBinding = video.addBinding(params, "videoRes", {
      label: "Resolution",
      options: optionMap(resolutions.map((resolution, index) => ({
        label: resolution.label,
        value: index,
      }))),
    }) as ChangeableBlade<number>;
    videoResBinding.on("change", (event) => {
      callbacksRef.current.onVideoResChange(event.value);
    });

    const durationBinding = video.addBinding(params, "duration", {
      label: "Duration",
      min: 2,
      max: 10,
      step: 1,
      format: (value) => `${value.toFixed(0)}s`,
    }) as ChangeableBlade<number>;
    durationBinding.on("change", (event) => {
      callbacksRef.current.onDurationChange(event.value);
    });

    const previewTimeBinding = video.addBinding(params, "previewTime", {
      label: "Time",
      readonly: true,
      // Manual ticker — the refresh effect drives updates; no idle polling.
      interval: 0,
      format: (value) => `${value.toFixed(1)}s`,
    }) as RefreshableBlade;

    const playButton = video.addButton({ title: "Play Preview" });
    playButton.element.classList.add("studio-export-preview-button");
    playButton.on("click", () => {
      callbacksRef.current.onTogglePlay();
    });

    const transparentOutput = video.addBinding(params, "transparentOutput", {
      label: "Alpha",
      readonly: true,
      interval: 0,
      view: "text",
    }) as RefreshableBlade;

    const videoButton = video.addButton({ title: "Export Video" });
    videoButton.on("click", () => {
      callbacksRef.current.onExportVideo();
    });

    const progressBinding = video.addBinding(params, "progress", {
      label: "Progress",
      readonly: true,
      interval: 0,
      min: 0,
      max: 100,
      format: (value) => `${value.toFixed(0)}%`,
    }) as RefreshableBlade;

    const view = pane.addFolder({
      title: "View",
      expanded: true,
    });
    createdBlades.push(view);
    const cameraFrameSlot = document.createElement("div");
    cameraFrameSlot.className = "studio-sheet-control-slot";
    getFolderContent(view)?.appendChild(cameraFrameSlot);

    const controls = pane.addFolder({
      title: "Canvas Controls",
      expanded: false,
    });
    createdBlades.push(controls);
    controls.addBinding(params, "orbitControl", {
      label: "Orbit",
      readonly: true,
      interval: 0,
    });
    controls.addBinding(params, "panControl", {
      label: "Pan",
      readonly: true,
      interval: 0,
    });
    controls.addBinding(params, "zoomControl", {
      label: "Zoom",
      readonly: true,
      interval: 0,
    });

    paneRef.current = pane;
    rootsRef.current = {
      bgMode: createRoot(bgModeSlot),
      cameraFrame: createRoot(cameraFrameSlot),
    };
    bindingsRef.current = {
      color: colorBinding,
      imageRes: imageResBinding,
      videoRes: videoResBinding,
      duration: durationBinding,
      previewTime: previewTimeBinding,
      progress: progressBinding,
      transparentOutput,
      imageButton,
      playButton,
      videoButton,
    };

    return () => {
      const roots = rootsRef.current;
      if (roots) {
        window.setTimeout(() => {
          roots.bgMode.unmount();
          roots.cameraFrame.unmount();
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
  }, [pane, resolutions]);

  useEffect(() => {
    const params = paramsRef.current;
    const bindings = bindingsRef.current;
    if (!bindings) return;

    // Refresh only bindings whose value changed — previewTime ticks 10x/s
    // during playback and would otherwise drag every input with it.
    const sync = (
      key: "color" | "imageRes" | "videoRes" | "duration" | "previewTime" | "progress",
      value: string | number,
    ) => {
      if (Object.is(params[key], value)) return;
      params[key] = value as never;
      bindings[key].refresh();
    };
    sync("color", color);
    sync("imageRes", imageRes);
    sync("videoRes", videoRes);
    sync("duration", duration);
    sync("previewTime", previewTime);
    sync("progress", Math.round(progress * 100));

    const setHidden = (blade: RefreshableBlade, hidden: boolean) => {
      if (blade.hidden !== hidden) blade.hidden = hidden;
    };
    setHidden(bindings.color, bgMode !== "solid");
    setHidden(bindings.transparentOutput, bgMode !== "transparent");
    setHidden(bindings.progress, exportKind !== "video");

    const setDisabled = (
      blade: RefreshableBlade | ButtonApi,
      disabled: boolean,
    ) => {
      if (blade.disabled !== disabled) blade.disabled = disabled;
    };
    setDisabled(bindings.imageRes, exporting);
    setDisabled(bindings.videoRes, exporting);
    setDisabled(bindings.duration, exporting);
    setDisabled(bindings.previewTime, exporting);
    setDisabled(bindings.imageButton, exporting);
    setDisabled(bindings.playButton, exporting);
    setDisabled(bindings.videoButton, exporting);

    const setTitle = (button: ButtonApi, title: string) => {
      if (button.title !== title) button.title = title;
    };
    setTitle(
      bindings.imageButton,
      exportKind === "image" ? "Exporting..." : "Export Image",
    );
    setTitle(bindings.playButton, playing ? "Exit Preview" : "Play Preview");
    setTitle(
      bindings.videoButton,
      exportKind === "video"
        ? `Rendering... ${Math.round(progress * 100)}%`
        : bgMode === "solid"
          ? "Export Video"
          : "Export PNG Sequence",
    );
  }, [
    bgMode,
    color,
    duration,
    exportKind,
    exporting,
    imageRes,
    playing,
    progress,
    previewTime,
    showCameraFrame,
    videoRes,
  ]);

  useEffect(() => {
    const roots = rootsRef.current;
    if (!roots) return;

    roots.bgMode.render(
      <StudioTwoButtonSelect
        label="Mode"
        value={bgMode}
        options={BG_MODE_OPTIONS}
        onChange={(value) => callbacksRef.current.onBgModeChange(value)}
      />,
    );
    roots.cameraFrame.render(
      <StudioSwitchButton
        label="Camera Frame"
        checked={showCameraFrame}
        disabled={exporting}
        onChange={(checked) =>
          callbacksRef.current.onShowCameraFrameChange(checked)
        }
      />,
    );
  }, [bgMode, exporting, showCameraFrame]);

  return null;
}
