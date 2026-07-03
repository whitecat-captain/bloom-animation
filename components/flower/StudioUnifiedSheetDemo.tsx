"use client";

import { useEffect, useRef } from "react";
import { Pane } from "tweakpane";

type DemoParams = {
  preset: string;
  flat: boolean;
  curl: number;
  petals: number;
  wind: number;
  bgMode: string;
  imageRes: string;
  videoRes: string;
  duration: number;
  cameraFrame: boolean;
};

const params: DemoParams = {
  preset: "Aurora",
  flat: true,
  curl: -0.3,
  petals: 36,
  wind: 0.09,
  bgMode: "Solid",
  imageRes: "1080p",
  videoRes: "1080p",
  duration: 5,
  cameraFrame: false,
};

export default function StudioUnifiedSheetDemo() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const pane = new Pane({
      container,
      title: "Studio Sheet",
      expanded: true,
    });

    const design = pane.addFolder({
      title: "Design",
      expanded: true,
    });
    const render = design.addFolder({
      title: "Render Style",
      expanded: true,
    });
    render.addBinding(params, "preset", {
      label: "Preset",
      options: {
        Aurora: "Aurora",
        Scarlet: "Scarlet",
        Sunset: "Sunset",
        Moonlight: "Moonlight",
      },
    });
    render.addBinding(params, "flat", { label: "Flat Shading" });

    const petal = design.addFolder({
      title: "Petal Geometry",
      expanded: true,
    });
    petal.addBinding(params, "curl", {
      label: "Lengthwise Curl",
      min: -1.5,
      max: 1,
      step: 0.1,
      format: (value) => value.toFixed(1),
    });

    const layout = design.addFolder({
      title: "Phyllotaxis Layout",
      expanded: false,
    });
    layout.addBinding(params, "petals", {
      label: "Petals Count",
      min: 5,
      max: 150,
      step: 1,
      format: (value) => value.toFixed(0),
    });

    const wind = design.addFolder({
      title: "Wind & Jitter",
      expanded: false,
    });
    wind.addBinding(params, "wind", {
      label: "Wind Amplitude",
      min: 0,
      max: 0.5,
      step: 0.01,
      format: (value) => value.toFixed(2),
    });

    pane.addBlade({ view: "separator" });

    const exportFolder = pane.addFolder({
      title: "Export",
      expanded: true,
    });
    const background = exportFolder.addFolder({
      title: "Background",
      expanded: true,
    });
    background.addBinding(params, "bgMode", {
      label: "Mode",
      options: {
        Solid: "Solid",
        Transparent: "Transparent",
      },
    });

    const image = exportFolder.addFolder({
      title: "Image Export",
      expanded: true,
    });
    image.addBinding(params, "imageRes", {
      label: "Resolution",
      options: {
        "720p": "720p",
        "1080p": "1080p",
        "2K": "2K",
        "4K": "4K",
      },
    });
    image.addButton({ title: "Export Image" });

    const video = exportFolder.addFolder({
      title: "Video Export",
      expanded: true,
    });
    video.addBinding(params, "videoRes", {
      label: "Resolution",
      options: {
        "720p": "720p",
        "1080p": "1080p",
        "2K": "2K",
        "4K": "4K",
      },
    });
    video.addBinding(params, "duration", {
      label: "Duration",
      min: 2,
      max: 10,
      step: 1,
      format: (value) => `${value.toFixed(0)}s`,
    });
    video.addButton({ title: "Export Video" });

    const view = exportFolder.addFolder({
      title: "View",
      expanded: false,
    });
    view.addBinding(params, "cameraFrame", {
      label: "Camera Frame",
    });

    return () => {
      pane.dispose();
    };
  }, []);

  return <aside ref={containerRef} className="studio-unified-demo" />;
}
