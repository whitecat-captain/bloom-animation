"use client";

import { useState } from "react";

const modes = ["Preview", "Design"] as const;

export default function GlassReferenceControls() {
  const [mode, setMode] = useState<(typeof modes)[number]>("Design");
  const [bloom, setBloom] = useState(72);

  return (
    <div className="glass-reference__controls liquid-glass-strong">
      <div className="glass-reference__controls-content">
        <div className="glass-reference__mode" aria-label="Editor mode">
          {modes.map((item) => (
            <button
              key={item}
              className={mode === item ? "is-selected" : ""}
              type="button"
              aria-pressed={mode === item}
              onClick={() => setMode(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="glass-reference__range">
          <span>Bloom</span>
          <input
            type="range"
            min="0"
            max="100"
            value={bloom}
            onChange={(event) => setBloom(Number(event.target.value))}
          />
          <output>{bloom}%</output>
        </label>
      </div>
    </div>
  );
}
