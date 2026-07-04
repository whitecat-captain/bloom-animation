import type { RefObject } from "react";
import { StudioCtaLink, StudioRoutePreloader } from "./StudioRouteLink";
import type { FlowerStep } from "./storySteps";

type FlowerStoryProps = {
  canvasRef: RefObject<HTMLDivElement | null>;
  showFullDesignCta: boolean;
  steps: FlowerStep[];
  onBloom: () => void;
};

export function FlowerStory({
  canvasRef,
  showFullDesignCta,
  steps,
  onBloom,
}: FlowerStoryProps) {
  return (
    <>
      <StudioRoutePreloader />
      <div ref={canvasRef} className="canvas-container" />

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

      {showFullDesignCta && (
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
          <StudioCtaLink
            ariaLabel="Design this flower"
            className="cta-design cta-design--full liquid-glass-strong"
          >
            <span className="cta-design-text">Design Flower</span>
          </StudioCtaLink>
        </div>
      )}
    </>
  );
}
