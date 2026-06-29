"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createFlowerScene, type FlowerSceneApi } from "./flowerScene";
import type { FlowerSync } from "./StepDemos";
import { FLOWER_STEPS } from "./storySteps";

// Social-media showcase. No scroll: the flower is the subject in the upper 3/5
// of a 9:16 frame, and one demo card sits in the bottom 2/5. Side arrows swap
// which demo is shown; the bottom counter tracks position.
export default function SocialCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const guiRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FlowerSceneApi | null>(null);
  const [active, setActive] = useState(0);
  // false → hide the deck and show a centred Bloom button instead (clean shot)
  const [showCards, setShowCards] = useState(true);
  // instance count shared between the One Draw Call card and its off-frame bar
  const [instances, setInstances] = useState(36);
  const n = FLOWER_STEPS.length;

  useEffect(() => {
    if (!canvasRef.current || !guiRef.current) return;
    const scene = createFlowerScene(canvasRef.current, guiRef.current);
    sceneRef.current = scene;

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
  }, []);

  const go = (dir: 1 | -1) => setActive((a) => (a + dir + n) % n);

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
    <div
      className={`app-container social social--stack${
        showCards ? "" : " social--bloom"
      }`}
    >
      {/* fixed WebGL layer (framed in the upper 3/5 via social.css) */}
      <div ref={canvasRef} className="canvas-container" />

      {/* visible 9:16 boundary — purely a recording/layout guide */}
      <div className="social-bounds" aria-hidden="true" />

      {/* one demo card at a time, in the bottom 2/5 */}
      <div className="social-stack">
        {FLOWER_STEPS.map((step, i) => (
          <article
            key={step.no}
            className="step-card social-card liquid-glass"
            data-active={i === active}
            style={{ zIndex: i === active ? 2 : 1 }}
            aria-hidden={i !== active}
          >
            <h2>{step.short}</h2>
            <figure className="step-fig social-fig">
              <step.Demo
                active={i === active}
                onSync={applySync}
                autoPlay={false}
                count={instances}
                onCount={setInstances}
              />
            </figure>
          </article>
        ))}
      </div>

      {/* side navigation arrows */}
      <button
        type="button"
        className="social-arrow social-arrow--prev liquid-glass-strong"
        aria-label="Previous"
        onClick={() => go(-1)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <button
        type="button"
        className="social-arrow social-arrow--next liquid-glass-strong"
        aria-label="Next"
        onClick={() => go(1)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>

      {/* pagination dots */}
      <div className="social-dots" role="tablist" aria-label="Demos">
        {FLOWER_STEPS.map((step, i) => (
          <button
            key={step.no}
            type="button"
            className="social-dot"
            data-active={i === active}
            role="tab"
            aria-selected={i === active}
            aria-label={step.short}
            onClick={() => setActive(i)}
          />
        ))}
      </div>

      {/* replay control, centred — only shown in Bloom mode */}
      <button
        type="button"
        className="social-bloom-btn liquid-glass-strong"
        aria-label="Replay bloom"
        onClick={() => sceneRef.current?.playBloom()}
      >
        <svg className="bloom-btn-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
        <span>Bloom</span>
      </button>

      {/* off-frame control bar (left letterbox) — always visible */}
      <div className="social-railbar">
        <span className="social-railbar-val">{instances}</span>
        <input
          type="range"
          min={1}
          max={150}
          step={1}
          value={instances}
          onChange={(e) => setInstances(Number(e.target.value))}
          aria-label="Instances"
        />
        <span className="social-railbar-label">Petals</span>
      </div>

      {/* hidden toggle, bottom-left: swap between the card deck and Bloom */}
      <button
        type="button"
        className="social-switch"
        aria-label="Toggle deck / bloom"
        onClick={() => setShowCards((v) => !v)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9h13l-3.5 -3.5 M20 15H7l3.5 3.5" />
        </svg>
      </button>

      {/* hidden GUI plumbing — the scene mounts lil-gui here; kept off-screen */}
      <div className="gui-container collapsed" aria-hidden="true">
        <div className="gui-tabs" />
        <div ref={guiRef} className="gui-scroll" />
      </div>
    </div>
  );
}
