"use client";

import { useEffect, useRef, useState } from "react";
import { createFlowerScene, type FlowerSceneApi } from "./flowerScene";

export default function FlowerHeroCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const guiRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FlowerSceneApi | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !guiRef.current) return;

    const scene = createFlowerScene(
      canvasRef.current,
      guiRef.current,
      tabsRef.current,
    );
    sceneRef.current = scene;
    scene.setBloom(scene.bloomMax);

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  return (
    <main className={`app-container hero-page${open ? " designer-open" : ""}`}>
      <div
        ref={canvasRef}
        className={`canvas-container${open ? " pushed" : ""}`}
      />

      <div className="finale-actions hero-page-actions">
        <button
          type="button"
          className="bloom-btn liquid-glass-strong"
          aria-label="Replay bloom"
          onClick={() => sceneRef.current?.playBloom()}
        >
          <svg className="bloom-btn-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5v14l11-7z" />
          </svg>
          <span className="bloom-btn-text">Bloom</span>
        </button>
        <button
          type="button"
          className="cta-design cta-design--full liquid-glass-strong"
          aria-label="Design this flower"
          onClick={() => setOpen(true)}
        >
          <span className="cta-design-text">Design Flower</span>
        </button>
      </div>

      <button
        type="button"
        className={`settings-btn liquid-glass-strong${open ? "" : " collapsed"}`}
        aria-label="Close settings"
        aria-expanded={open}
        onClick={() => setOpen(false)}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div
        className={`gui-container liquid-glass-strong${open ? "" : " collapsed"}`}
      >
        <div ref={tabsRef} className="gui-tabs" />
        <div ref={guiRef} className="gui-scroll" />
      </div>
    </main>
  );
}
