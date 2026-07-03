"use client";

import { useRef } from "react";
import { FlowerStory } from "./FlowerStory";
import type { FlowerSceneApi } from "./flowerScene";
import { FLOWER_STEPS } from "./storySteps";
import { useDesignCtaVisibility } from "./useDesignCtaVisibility";
import { useFlowerSceneScroll } from "./useFlowerSceneScroll";

export default function FlowerCanvas() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FlowerSceneApi | null>(null);

  useFlowerSceneScroll({ rootRef, canvasRef, sceneRef });
  const showFullDesignCta = useDesignCtaVisibility(rootRef);

  return (
    <div ref={rootRef} className="app-container">
      <FlowerStory
        canvasRef={canvasRef}
        showFullDesignCta={showFullDesignCta}
        steps={FLOWER_STEPS}
        onBloom={() => sceneRef.current?.playBloom()}
      />
    </div>
  );
}
