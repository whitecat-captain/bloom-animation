"use client";

import { useEffect, useRef, useState } from "react";
import { createFlowerScene, type FlowerSceneApi } from "./flowerScene";
import { CRIMSON_ROSE_CONFIG } from "./generated/crimsonRose";

export default function ReferenceRoseCanvas() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<FlowerSceneApi | null>(null);
  const [openness, setOpenness] = useState(74);
  const [density, setDensity] = useState(46);
  const [breeze, setBreeze] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    const scene = createFlowerScene(canvasRef.current, null, null, {
      flowerGroupY: 0.6,
    });
    sceneRef.current = scene;
    scene.applyPreset(CRIMSON_ROSE_CONFIG.params);
    scene.setPalette(CRIMSON_ROSE_CONFIG.palette);
    scene.setBloom(0.74);
    if (CRIMSON_ROSE_CONFIG.camera) {
      scene.setCameraView(CRIMSON_ROSE_CONFIG.camera);
    }

    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.setBloom(openness / 100);
  }, [openness]);

  useEffect(() => {
    sceneRef.current?.setPhyllotaxis("numPetals", density);
  }, [density]);

  useEffect(() => {
    sceneRef.current?.setWind("windAmp", breeze ? 0.18 : 0.08);
    sceneRef.current?.setWind("windSpeed", breeze ? 1.55 : 1.1);
  }, [breeze]);

  function handleOpenness(next: number) {
    setOpenness(next);
  }

  function handleDensity(next: number) {
    setDensity(next);
  }

  function toggleBreeze() {
    setBreeze((current) => !current);
  }

  return (
    <main className="reference-rose">
      <div ref={canvasRef} className="reference-rose__canvas" />

      <header className="reference-rose__heading">
        <p>Generated from a flower reference</p>
        <h1>Crimson Rose</h1>
        <span>an interactive study</span>
      </header>

      <section className="reference-rose__controls" aria-label="Rose controls">
        <button
          type="button"
          className="reference-rose__bloom"
          onClick={() => sceneRef.current?.playBloom()}
        >
          <span aria-hidden="true">▶</span> Replay bloom
        </button>

        <label>
          <span>Openness</span>
          <output>{openness}%</output>
          <input
            type="range"
            aria-label="Rose openness"
            min="35"
            max="100"
            value={openness}
            onChange={(event) => handleOpenness(Number(event.target.value))}
          />
        </label>

        <label>
          <span>Petal density</span>
          <output>{density}</output>
          <input
            type="range"
            aria-label="Rose petal density"
            min="30"
            max="90"
            step="1"
            value={density}
            onChange={(event) => handleDensity(Number(event.target.value))}
          />
        </label>

        <button
          type="button"
          className={`reference-rose__breeze${breeze ? " is-active" : ""}`}
          aria-pressed={breeze}
          onClick={toggleBreeze}
        >
          Gentle breeze
        </button>
      </section>
    </main>
  );
}
