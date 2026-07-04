"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { RefObject } from "react";
import type { FlowerStep } from "./storySteps";

const STUDIO_HREF = "/studio";
let studioBundlePromise: Promise<unknown> | null = null;

function preloadStudioBundle() {
  studioBundlePromise ??= import("./StudioCanvas");
  return studioBundlePromise;
}

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
  const router = useRouter();
  const warmedStudioRef = useRef(false);

  const warmStudio = useCallback(() => {
    if (warmedStudioRef.current) return;
    warmedStudioRef.current = true;
    router.prefetch(STUDIO_HREF);
    void preloadStudioBundle();
  }, [router]);

  useEffect(() => {
    if (typeof window.requestIdleCallback !== "function") {
      const timeout = window.setTimeout(warmStudio, 1800);
      return () => window.clearTimeout(timeout);
    }

    const idle = window.requestIdleCallback(warmStudio, { timeout: 2400 });
    return () => window.cancelIdleCallback(idle);
  }, [warmStudio]);

  useEffect(() => {
    if (!showFullDesignCta) return;
    const timeout = window.setTimeout(warmStudio, 350);
    return () => window.clearTimeout(timeout);
  }, [showFullDesignCta, warmStudio]);

  return (
    <>
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
          <Link
            className="cta-design cta-design--full liquid-glass-strong"
            href={STUDIO_HREF}
            prefetch
            aria-label="Design this flower"
            onFocus={warmStudio}
            onPointerEnter={warmStudio}
            onTouchStart={warmStudio}
          >
            <span className="cta-design-text">Design Flower</span>
          </Link>
        </div>
      )}
    </>
  );
}
