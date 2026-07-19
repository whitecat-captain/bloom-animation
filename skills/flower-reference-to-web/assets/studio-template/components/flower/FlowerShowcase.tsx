"use client";

import type { ReactNode, RefObject } from "react";

// ============================================================================
// FlowerShowcase — the shared 9:16 "card deck" chrome.
//
// Both /demo and /dahlia present the same flower engine the same way: a tall
// recording frame with the bloom up top, one card at a time in the lower
// region, side arrows + pagination dots in the letterbox, a persistent petal
// rail, and a deck/bloom toggle. This component owns all of that chrome; each
// page supplies only its data, its card body (via `renderCard`), and the scene
// callbacks. The scene lifecycle itself stays with the parent, which passes in
// the `canvasRef` / `guiRef` mount points.
// ============================================================================

export interface ShowcaseRail {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** doubles as the rail's visible label and its accessible name */
  label?: string;
}

interface FlowerShowcaseProps<T> {
  /** scene mount points — the parent owns scene creation/disposal */
  canvasRef: RefObject<HTMLDivElement | null>;
  guiRef: RefObject<HTMLDivElement | null>;
  /** extra container modifier, e.g. "dahlia" */
  variant?: string;
  /** optional masthead rendered above the deck */
  header?: ReactNode;
  /** the cards to page through */
  items: readonly T[];
  /** stable React key for an item */
  getKey: (item: T, index: number) => string;
  active: number;
  onActiveChange: (index: number) => void;
  /** inner content of the active-aware <article> card wrapper */
  renderCard: (item: T, index: number) => ReactNode;
  /** accessible name for a single pagination dot */
  dotLabel: (item: T) => string;
  /** accessible name for the dots tablist */
  dotsLabel: string;
  /** false → hide the deck and show a centred replay button (clean shot) */
  showCards: boolean;
  onToggleCards: () => void;
  onReplayBloom: () => void;
  rail: ShowcaseRail;
}

export default function FlowerShowcase<T>({
  canvasRef,
  guiRef,
  variant,
  header,
  items,
  getKey,
  active,
  onActiveChange,
  renderCard,
  dotLabel,
  dotsLabel,
  showCards,
  onToggleCards,
  onReplayBloom,
  rail,
}: FlowerShowcaseProps<T>) {
  const n = items.length;
  const go = (dir: 1 | -1) => onActiveChange((active + dir + n) % n);
  const { value, onChange, min = 1, max = 150, label = "Petals" } = rail;

  return (
    <div
      className={`app-container demo-page${variant ? ` ${variant}` : ""} demo-page--stack${
        showCards ? "" : " demo-page--bloom"
      }`}
    >
      <div ref={canvasRef} className="canvas-container" />
      <div className="demo-bounds" aria-hidden="true" />

      {header}

      {/* one card at a time, in the lower region */}
      <div className="demo-stack">
        {items.map((item, i) => (
          <article
            key={getKey(item, i)}
            className="step-card demo-card liquid-glass"
            data-active={i === active}
            style={{ zIndex: i === active ? 2 : 1 }}
            aria-hidden={i !== active}
          >
            {renderCard(item, i)}
          </article>
        ))}
      </div>

      {/* side navigation arrows (in the letterbox, off the 9:16 frame) */}
      <button
        type="button"
        className="demo-arrow demo-arrow--prev liquid-glass-strong"
        aria-label="Previous"
        onClick={() => go(-1)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>
      <button
        type="button"
        className="demo-arrow demo-arrow--next liquid-glass-strong"
        aria-label="Next"
        onClick={() => go(1)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </button>

      {/* pagination dots */}
      <div className="demo-dots" role="tablist" aria-label={dotsLabel}>
        {items.map((item, i) => (
          <button
            key={getKey(item, i)}
            type="button"
            className="demo-dot"
            data-active={i === active}
            role="tab"
            aria-selected={i === active}
            aria-label={dotLabel(item)}
            onClick={() => onActiveChange(i)}
          />
        ))}
      </div>

      {/* replay control, centred — only shown in Bloom mode */}
      <button
        type="button"
        className="demo-bloom-btn liquid-glass-strong"
        aria-label="Replay bloom"
        onClick={onReplayBloom}
      >
        <svg className="bloom-btn-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5v14l11-7z" />
        </svg>
        <span>Bloom</span>
      </button>

      {/* persistent petal-count rail (left letterbox) */}
      <div className="demo-railbar">
        <span className="demo-railbar-val">{value}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
        />
        <span className="demo-railbar-label">{label}</span>
      </div>

      {/* deck / bloom toggle (left letterbox) */}
      <button
        type="button"
        className="demo-switch"
        aria-label="Toggle deck / bloom"
        onClick={onToggleCards}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 9h13l-3.5 -3.5 M20 15H7l3.5 3.5" />
        </svg>
      </button>

      {/* hidden lil-gui plumbing kept off-screen (engine mounts into it) */}
      <div className="gui-container collapsed" aria-hidden="true">
        <div className="gui-tabs" />
        <div ref={guiRef} className="gui-scroll" />
      </div>
    </div>
  );
}
