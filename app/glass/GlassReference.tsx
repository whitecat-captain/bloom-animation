import { ArrowUpRight, Play, Plus, Settings2 } from "lucide-react";
import GlassButton from "@/components/flower/GlassButton";
import GlassReferenceControls from "./GlassReferenceControls";
import MockupControlBars from "./MockupControlBars";

export default function GlassReference() {
  return (
    <main className="glass-reference">
      <section className="glass-reference__content" aria-labelledby="glass-title">
        <header className="glass-reference__header">
          <span>Bloom Animation Generator</span>
          <span>Design reference</span>
        </header>

        <div className="glass-reference__intro">
          <p>Existing interface primitives</p>
          <h1 id="glass-title">Liquid glass</h1>
        </div>

        <section className="glass-reference__section" aria-labelledby="surfaces-title">
          <div className="glass-reference__section-heading">
            <h2 id="surfaces-title">Surfaces</h2>
            <span>01</span>
          </div>
          <div className="glass-reference__surface-grid">
            <article className="glass-reference__surface liquid-glass">
              <div className="glass-reference__surface-content">
                <span className="glass-reference__label">Standard</span>
                <p>Low blur</p>
                <small>Ambient overlay</small>
              </div>
            </article>
            <article className="glass-reference__surface glass-reference__surface--strong liquid-glass-strong">
              <div className="glass-reference__surface-content">
                <span className="glass-reference__label">Strong</span>
                <p>High blur</p>
                <small>Focused panel</small>
              </div>
            </article>
            <article className="glass-reference__surface glass-reference__surface--story">
              <div className="glass-reference__surface-content">
                <span className="glass-reference__label">Story</span>
                <p>Reading card</p>
                <small>Dark canvas copy</small>
              </div>
            </article>
          </div>
        </section>

        <section className="glass-reference__section" aria-labelledby="actions-title">
          <div className="glass-reference__section-heading">
            <h2 id="actions-title">Actions</h2>
            <span>02</span>
          </div>
          <div className="glass-reference__actions liquid-glass-strong">
            <div className="glass-reference__actions-content">
              <GlassButton className="glass-reference__action glass-reference__action--bloom" type="button">
                <Play size={13} fill="currentColor" />
                Bloom
              </GlassButton>
              <GlassButton className="glass-reference__action" type="button">
                Design flower
                <ArrowUpRight size={15} />
              </GlassButton>
              <button className="glass-reference__icon-action liquid-glass-strong" type="button" title="Open settings" aria-label="Open settings">
                <Settings2 size={17} />
              </button>
              <button className="glass-reference__icon-action liquid-glass-strong" type="button" title="Add flower" aria-label="Add flower">
                <Plus size={17} />
              </button>
            </div>
          </div>
        </section>

        <section className="glass-reference__section" aria-labelledby="controls-title">
          <div className="glass-reference__section-heading">
            <h2 id="controls-title">Controls</h2>
            <span>03</span>
          </div>
          <GlassReferenceControls />
        </section>

        <section className="glass-reference__section" aria-labelledby="mockup-components-title">
          <div className="glass-reference__section-heading">
            <h2 id="mockup-components-title">Mockup components</h2>
            <span>04</span>
          </div>
          <MockupControlBars />
        </section>
      </section>
    </main>
  );
}
