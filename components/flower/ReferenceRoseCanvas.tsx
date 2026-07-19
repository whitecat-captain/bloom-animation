"use client";

import { useEffect, useRef, useState } from "react";
import { createFlowerScene, type FlowerSceneApi } from "./flowerScene";

const ROSE_PRESET = {
  numPetals: 46,
  goldenAngle: 137.5,
  outwardPush: true,
  radius: 0.145,
  radiusBias: 1.5,
  height: 0.19,
  heightBias: 1.45,
  scaleInner: 0.25,
  tiltInner: 0.18,
  outAngle: 76,
  tiltBias: 2.7,
  transition: 0.38,
  curlClosed: 1.72,
  curlOpen: -0.25,
  curlBias: 2.5,
  propagation: 1.2,
  petalLen: 1.06,
  w0: 0.17,
  w1: 0.36,
  w2: 0.4,
  w3: 0.34,
  w4: 0.14,
  cup: 0.66,
  sideCurl: 0.38,
  wrapWidth: 0.25,
  wrapCup: 0.38,
  waveAmp: 0.008,
  asym: 0.1,
  jitter: 0.045,
  noiseAmp: 0.025,
  noiseFreq: 5,
  shellGap: 0.12,
  windAmp: 0.08,
  windSpeed: 1.1,
  windHeading: 25,
  flat: false,
};

const CRIMSON_PALETTE: [number, number, number][] = [
  [0.34, 0.008, 0.018],
  [0.62, 0.018, 0.035],
  [0.84, 0.07, 0.075],
  [1.0, 0.24, 0.15],
  [0.48, 0.006, 0.028],
];

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
    scene.applyPreset(ROSE_PRESET);
    scene.setPalette(CRIMSON_PALETTE);
    scene.setAnimation("bloomMax", 0.8);
    scene.setBloom(0.74);
    scene.setCameraView([0.55, 2.85, 3.45]);

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
