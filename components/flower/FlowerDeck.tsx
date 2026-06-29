"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FlowerShowcase from "./FlowerShowcase";
import { createFlowerScene, type FlowerSceneApi } from "./flowerScene";
import type { FlowerSync } from "./StepDemos";
import { FLOWER_STEPS } from "./storySteps";

// ============================================================================
// FlowerDeck — the canonical "demo deck": a 9:16 showcase whose card stack is
// the FLOWER_STEPS demos, each wired to drive the live 3D flower. This is the
// standard every subsequent page reuses; a page customizes only the flower
// (via `customizeScene`) and its accent (via `variant`), never the UI.
// ============================================================================

interface FlowerDeckProps {
  /** container modifier, e.g. "dahlia" — themes the chrome + 2D demos via CSS */
  variant?: string;
  /** run once on the freshly created scene to swap in a different flower
   *  (preset + palette + camera); omitted → the default generic flower */
  customizeScene?: (scene: FlowerSceneApi) => void;
  /** starting petal count for the persistent rail (matches the flower preset) */
  initialInstances?: number;
}

export default function FlowerDeck({
  variant,
  customizeScene,
  initialInstances = 36,
}: FlowerDeckProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const guiRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FlowerSceneApi | null>(null);
  const [active, setActive] = useState(0);
  // false → hide the deck and show a centred Bloom button instead (clean shot)
  const [showCards, setShowCards] = useState(true);
  // instance count shared between the One Draw Call card and its off-frame bar
  const [instances, setInstances] = useState(initialInstances);

  useEffect(() => {
    if (!canvasRef.current || !guiRef.current) return;
    const scene = createFlowerScene(canvasRef.current, guiRef.current);
    sceneRef.current = scene;

    // swap in this page's flower before the first bloom
    customizeScene?.(scene);

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduceMotion) scene.setBloom(scene.bloomMax);
    else scene.playBloom();

    // Same zoom control as the landing page: hold ⌘/Ctrl and scroll to dolly.
    const zoomWithModifierScroll = (event: WheelEvent) => {
      if (!event.metaKey && !event.ctrlKey) return;
      event.preventDefault();
      scene.zoomBy(event.deltaY);
    };
    window.addEventListener("wheel", zoomWithModifierScroll, {
      capture: true,
      passive: false,
    });

    return () => {
      window.removeEventListener("wheel", zoomWithModifierScroll, true);
      scene.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // hide the stem on the single-petal "Folded Petal" card; show it elsewhere
  useEffect(() => {
    sceneRef.current?.setStemVisible(FLOWER_STEPS[active].no !== "01");
  }, [active]);

  // the always-visible Petals bar drives the live petal count on any card
  useEffect(() => {
    sceneRef.current?.setNumPetals(instances);
  }, [instances]);

  // only the Golden Spiral card toggles the arrangement; force the spiral back
  // on every other card so it never gets stuck in the concentric layout
  useEffect(() => {
    if (FLOWER_STEPS[active].no !== "02") {
      sceneRef.current?.setStableLayout(false);
      sceneRef.current?.setOutwardPush(true);
      sceneRef.current?.setGoldenAngle(137.5);
      sceneRef.current?.setNumPetals(instances);
    }
  }, [active, instances]);

  // apply the active card's controls to the live 3D flower
  const applySync = useCallback((s: FlowerSync) => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (s.stableLayout != null) scene.setStableLayout(s.stableLayout);
    if (s.goldenAngle != null) scene.setGoldenAngle(s.goldenAngle);
    if (s.numPetals != null) scene.setNumPetals(s.numPetals);
    if (s.outwardPush != null) scene.setOutwardPush(s.outwardPush);
    // curl slider → open-petal curl, centred on the scene's natural -0.35 at the
    // demo default (1.1) so the resting bloom matches the landing page; moving
    // the slider deviates from there.
    if (s.curl != null) scene.setCurlOpen(-0.35 + (s.curl - 1.1) * 0.85);
    if (s.widths) scene.setPetalWidths(s.widths);
    if (s.bloom != null) scene.setBloom(s.bloom * scene.bloomMax);
    if (s.transition != null) scene.setTransition(s.transition);
    if (s.windAmp != null) scene.setWindAmp(s.windAmp);
    if (s.windSpeed != null) scene.setWindSpeed(s.windSpeed);
  }, []);

  return (
    <FlowerShowcase
      canvasRef={canvasRef}
      guiRef={guiRef}
      variant={variant}
      items={FLOWER_STEPS}
      getKey={(step) => step.no}
      active={active}
      onActiveChange={setActive}
      dotsLabel="Demos"
      dotLabel={(step) => step.short}
      showCards={showCards}
      onToggleCards={() => setShowCards((v) => !v)}
      onReplayBloom={() => sceneRef.current?.playBloom()}
      rail={{ value: instances, onChange: setInstances }}
      renderCard={(step, i) => (
        <>
          <h2>{step.short}</h2>
          <figure className="step-fig demo-fig">
            <step.Demo
              active={i === active}
              onSync={applySync}
              autoPlay={false}
              count={instances}
              onCount={setInstances}
            />
          </figure>
        </>
      )}
    />
  );
}
