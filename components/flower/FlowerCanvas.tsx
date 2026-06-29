"use client";

import { useRef, useState } from "react";
import { FlowerStory } from "./FlowerStory";
import type { FlowerSceneApi } from "./flowerScene";
import { FLOWER_STEPS } from "./storySteps";
import { useDesignCtaVisibility } from "./useDesignCtaVisibility";
import { useFlowerSceneScroll } from "./useFlowerSceneScroll";

export default function FlowerCanvas() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const guiRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FlowerSceneApi | null>(null);
  const [open, setOpen] = useState(false);

  useFlowerSceneScroll({ rootRef, canvasRef, guiRef, tabsRef, sceneRef });
  const showFullDesignCta = useDesignCtaVisibility(rootRef);

  return (
    <div
      ref={rootRef}
      className={`app-container${open ? " designer-open" : ""}`}
    >
      <FlowerStory
        canvasRef={canvasRef}
        guiRef={guiRef}
        tabsRef={tabsRef}
        open={open}
        showFullDesignCta={showFullDesignCta}
        steps={FLOWER_STEPS}
        onOpenDesigner={() => setOpen(true)}
        onCloseDesigner={() => setOpen(false)}
        onBloom={() => sceneRef.current?.playBloom()}
      />
    </div>
  );
}
