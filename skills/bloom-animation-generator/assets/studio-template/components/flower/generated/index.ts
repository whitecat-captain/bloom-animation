import type { FlowerConfig } from "../flowerConfig";
import { CRIMSON_ROSE_CONFIG } from "./crimsonRose";

// Put the flower most recently created or updated by the Skill first. Studio
// opens the first generated flower by default; older flowers remain available.
export const GENERATED_FLOWERS: FlowerConfig[] = [
  CRIMSON_ROSE_CONFIG,
];
