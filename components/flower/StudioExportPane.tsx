"use client";

import { useEffect, useRef } from "react";
import {
  Pane,
  type BladeApi,
  type ButtonApi,
} from "tweakpane";

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
  preset: number;
  bgMode: BgMode;
  color: string;
  imageRes: number;
  videoRes: number;
  duration: number;
  previewTime: number;
  showCameraFrame: boolean;
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
  preset: RefreshableBlade;
  bgMode: RefreshableBlade;
  color: RefreshableBlade;
  imageRes: RefreshableBlade;
  videoRes: RefreshableBlade;
  duration: RefreshableBlade;
  previewTime: RefreshableBlade;
  showCameraFrame: RefreshableBlade;
  progress: RefreshableBlade;
  transparentOutput: RefreshableBlade;
  imageButton: ButtonApi;
  playButton: ButtonApi;
  videoButton: ButtonApi;
};

type StudioExportPaneProps = {
  presets: StudioExportPreset[];
  resolutions: StudioExportResolution[];
  selectedPreset: number;
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
  onPresetChange: (index: number) => void;
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

function optionMap<T extends string | number>(
  entries: Array<{ label: string; value: T }>,
) {
  return entries.reduce<Record<string, T>>((options, entry) => {
    options[entry.label] = entry.value;
    return options;
  }, {});
}

export default function StudioExportPane({
  presets,
  resolutions,
  selectedPreset,
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
  onPresetChange,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const paneRef = useRef<Pane | null>(null);
  const bindingsRef = useRef<ExportPaneBindings | null>(null);
  const callbacksRef = useRef({
    onPresetChange,
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
    preset: selectedPreset,
    bgMode,
    color,
    imageRes,
    videoRes,
    duration,
    previewTime,
    showCameraFrame,
    progress,
    transparentOutput: TRANSPARENT_OUTPUT_NOTE,
    orbitControl: "Left drag",
    panControl: "Right drag",
    zoomControl: "Scroll",
  });

  useEffect(() => {
    callbacksRef.current = {
      onPresetChange,
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
    onPresetChange,
    onShowCameraFrameChange,
    onTogglePlay,
    onVideoResChange,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const params = paramsRef.current;
    const pane = new Pane({
      container,
      title: "Export Sheet",
      expanded: true,
    });

    const preset = pane.addBinding(params, "preset", {
      label: "Preset",
      options: optionMap(presets.map((presetItem, index) => ({
        label: presetItem.name,
        value: index,
      }))),
    }) as ChangeableBlade<number>;
    preset.on("change", (event) => {
      callbacksRef.current.onPresetChange(event.value);
    });

    const background = pane.addFolder({
      title: "Background",
      expanded: true,
    });
    const bgModeBinding = background.addBinding(params, "bgMode", {
      label: "Mode",
      options: {
        Solid: "solid",
        Transparent: "transparent",
      },
    }) as ChangeableBlade<BgMode>;
    bgModeBinding.on("change", (event) => {
      callbacksRef.current.onBgModeChange(event.value);
    });

    const colorBinding = background.addBinding(params, "color", {
      label: "Color",
      picker: "inline",
      expanded: true,
    }) as ChangeableBlade<string>;
    colorBinding.on("change", (event) => {
      callbacksRef.current.onColorChange(event.value);
    });

    const image = pane.addFolder({
      title: "Image Export",
      expanded: true,
    });
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
      format: (value) => `${value.toFixed(1)}s`,
    }) as RefreshableBlade;

    const playButton = video.addButton({ title: "Play Preview" });
    playButton.on("click", () => {
      callbacksRef.current.onTogglePlay();
    });

    const transparentOutput = video.addBinding(params, "transparentOutput", {
      label: "Alpha",
      readonly: true,
      view: "text",
    }) as RefreshableBlade;

    const videoButton = video.addButton({ title: "Export Video" });
    videoButton.on("click", () => {
      callbacksRef.current.onExportVideo();
    });

    const progressBinding = video.addBinding(params, "progress", {
      label: "Progress",
      readonly: true,
      min: 0,
      max: 100,
      format: (value) => `${value.toFixed(0)}%`,
    }) as RefreshableBlade;

    const view = pane.addFolder({
      title: "View",
      expanded: true,
    });
    const showCameraFrameBinding = view.addBinding(params, "showCameraFrame", {
      label: "Camera Frame",
    }) as ChangeableBlade<boolean>;
    showCameraFrameBinding.on("change", (event) => {
      callbacksRef.current.onShowCameraFrameChange(event.value);
    });

    const controls = pane.addFolder({
      title: "Canvas Controls",
      expanded: false,
    });
    controls.addBinding(params, "orbitControl", {
      label: "Orbit",
      readonly: true,
    });
    controls.addBinding(params, "panControl", {
      label: "Pan",
      readonly: true,
    });
    controls.addBinding(params, "zoomControl", {
      label: "Zoom",
      readonly: true,
    });

    paneRef.current = pane;
    bindingsRef.current = {
      preset,
      bgMode: bgModeBinding,
      color: colorBinding,
      imageRes: imageResBinding,
      videoRes: videoResBinding,
      duration: durationBinding,
      previewTime: previewTimeBinding,
      showCameraFrame: showCameraFrameBinding,
      progress: progressBinding,
      transparentOutput,
      imageButton,
      playButton,
      videoButton,
    };

    return () => {
      bindingsRef.current = null;
      paneRef.current = null;
      pane.dispose();
    };
  }, [presets, resolutions]);

  useEffect(() => {
    const params = paramsRef.current;
    params.preset = selectedPreset;
    params.bgMode = bgMode;
    params.color = color;
    params.imageRes = imageRes;
    params.videoRes = videoRes;
    params.duration = duration;
    params.previewTime = previewTime;
    params.showCameraFrame = showCameraFrame;
    params.progress = Math.round(progress * 100);

    const bindings = bindingsRef.current;
    if (!bindings) return;

    bindings.preset.refresh();
    bindings.bgMode.refresh();
    bindings.color.refresh();
    bindings.imageRes.refresh();
    bindings.videoRes.refresh();
    bindings.duration.refresh();
    bindings.previewTime.refresh();
    bindings.showCameraFrame.refresh();
    bindings.progress.refresh();

    bindings.color.hidden = bgMode !== "solid";
    bindings.transparentOutput.hidden = bgMode !== "transparent";
    bindings.progress.hidden = exportKind !== "video";

    bindings.imageRes.disabled = exporting;
    bindings.videoRes.disabled = exporting;
    bindings.duration.disabled = exporting;
    bindings.previewTime.disabled = exporting;
    bindings.showCameraFrame.disabled = exporting;
    bindings.imageButton.disabled = exporting;
    bindings.playButton.disabled = exporting;
    bindings.videoButton.disabled = exporting;

    bindings.imageButton.title =
      exportKind === "image" ? "Exporting..." : "Export Image";
    bindings.playButton.title = playing ? "Exit Preview" : "Play Preview";
    bindings.videoButton.title =
      exportKind === "video"
        ? `Rendering... ${Math.round(progress * 100)}%`
        : bgMode === "solid"
          ? "Export Video"
          : "Export PNG Sequence";
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
    selectedPreset,
    showCameraFrame,
    videoRes,
  ]);

  return <aside ref={containerRef} className="studio-export" />;
}
