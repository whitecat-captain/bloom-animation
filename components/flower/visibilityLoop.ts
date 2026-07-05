/**
 * Runs a requestAnimationFrame loop only while `host` is actually visible.
 *
 * The studio's 3D demo boxes (petal / arrangement / wind) each own a WebGL
 * context; without gating they all render at full frame rate forever, even
 * while their tweakpane folder is collapsed (display: none). An
 * IntersectionObserver pauses the loop whenever the host leaves view and
 * resumes it — rendering the latest state — the moment it returns.
 *
 * Returns a cleanup function that disconnects the observer and stops the loop.
 */
export function startVisibilityGatedLoop(
  host: Element,
  tick: () => void,
): () => void {
  let raf: number | null = null;

  const run = () => {
    tick();
    raf = requestAnimationFrame(run);
  };
  const start = () => {
    if (raf === null) raf = requestAnimationFrame(run);
  };
  const stop = () => {
    if (raf !== null) {
      cancelAnimationFrame(raf);
      raf = null;
    }
  };

  // Fires immediately with the current state, so a visible host starts the
  // loop right away and a collapsed one never spins it up at all.
  const observer = new IntersectionObserver((entries) => {
    const latest = entries[entries.length - 1];
    if (latest.isIntersecting) start();
    else stop();
  });
  observer.observe(host);

  return () => {
    observer.disconnect();
    stop();
  };
}
