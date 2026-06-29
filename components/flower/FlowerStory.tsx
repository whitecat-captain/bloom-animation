import type { RefObject } from "react";
import type { FlowerStep } from "./storySteps";

type FlowerStoryProps = {
  canvasRef: RefObject<HTMLDivElement | null>;
  guiRef: RefObject<HTMLDivElement | null>;
  tabsRef: RefObject<HTMLDivElement | null>;
  open: boolean;
  showFullDesignCta: boolean;
  steps: FlowerStep[];
  onOpenDesigner: () => void;
  onCloseDesigner: () => void;
  onBloom: () => void;
};

export function FlowerStory({
  canvasRef,
  guiRef,
  tabsRef,
  open,
  showFullDesignCta,
  steps,
  onOpenDesigner,
  onCloseDesigner,
  onBloom,
}: FlowerStoryProps) {
  return (
    <>
      <div
        ref={canvasRef}
        className={`canvas-container${open ? " pushed" : ""}`}
      />

      <main className="story">
        <section className="hero-section" data-step="00">
          <div className="hero-magazine">
            <p className="hero-edition" aria-hidden="true">
              <span>No. 036</span>
              <span>Procedural Botany</span>
              <span>WebGL botanical review</span>
            </p>
            <p className="hero-side-note hero-side-note--left" aria-hidden="true">
              Thirty-six petals arranged like a small piece of weather.
            </p>
            <p
              className="hero-side-note hero-side-note--right"
              aria-hidden="true"
            >
              Shader, wind, spiral: an artificial flower in slow bloom.
            </p>
            <h1
              className="hero-title"
              aria-label="Bloom — how a flower grows out of pure math"
            >
              <span className="hero-line">
                <em>Bloom</em>
              </span>
              <span className="hero-line">
                How a <em>flower</em>
              </span>
              <span className="hero-line">
                grows out of <em>pure math</em>.
              </span>
            </h1>
            <div className="hero-folio" aria-hidden="true">
              <span>Field notes</span>
              <span>Geometry / motion / light</span>
            </div>
          </div>
        </section>

        {steps.map((step, i) => (
          <section
            className={`step ${i % 2 ? "step--right" : "step--left"}`}
            data-step={step.no}
            key={step.no}
          >
            <article className="step-card liquid-glass">
              <span className="step-no">{step.no}</span>
              <h2>{step.title}</h2>
              <p>{step.body}</p>
              <figure className="step-fig">
                <step.Demo />
              </figure>
              <pre className="step-code">
                <code>{step.code}</code>
              </pre>
            </article>
          </section>
        ))}

        <section className="finale" data-step="05">
          <div className="finale-inner" />
        </section>
      </main>

      {showFullDesignCta ? (
        <div className="finale-actions">
          <button
            type="button"
            className="bloom-btn liquid-glass-strong"
            aria-label="Replay bloom"
            onClick={onBloom}
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
            onClick={onOpenDesigner}
          >
            <span className="cta-design-text">Design Flower</span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`cta-design cta-design--mini liquid-glass-strong${
            open ? " shifted" : ""
          }`}
          aria-label="Open flower designer"
          onClick={onOpenDesigner}
        >
          <svg className="flower-icon" viewBox="0 0 32 32" aria-hidden="true">
            <circle className="flower-icon-petal" cx="16" cy="7.5" r="5.4" />
            <circle className="flower-icon-petal" cx="24.1" cy="13.4" r="5.4" />
            <circle className="flower-icon-petal" cx="21" cy="22.9" r="5.4" />
            <circle className="flower-icon-petal" cx="11" cy="22.9" r="5.4" />
            <circle className="flower-icon-petal" cx="7.9" cy="13.4" r="5.4" />
            <circle className="flower-icon-core" cx="16" cy="16" r="4.2" />
          </svg>
        </button>
      )}

      <button
        type="button"
        className={`settings-btn liquid-glass-strong${open ? "" : " collapsed"}`}
        aria-label="Close settings"
        aria-expanded={open}
        onClick={onCloseDesigner}
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
    </>
  );
}
