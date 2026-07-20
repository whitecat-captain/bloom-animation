import type { FlowerSceneApi } from "./flowerScene";

export type FlowerPalette = [
  [number, number, number],
  [number, number, number],
  [number, number, number],
  [number, number, number],
  [number, number, number],
];

export type FlowerConfig = {
  id: string;
  name: string;
  source: "generated" | "preset";
  reference?: {
    sourceName?: string;
    fingerprint?: string;
  };
  params: Parameters<FlowerSceneApi["applyPreset"]>[0];
  palette: FlowerPalette;
  camera?: [number, number, number];
};
