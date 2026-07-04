"use client";

import dynamic from "next/dynamic";
import "../flower.css";
import "./studio.css";

// WebGL + MediaRecorder are browser-only — skip SSR.
const StudioCanvas = dynamic(() => import("@/components/flower/StudioCanvas"), {
  loading: () => <StudioLoading />,
  ssr: false,
});

function StudioLoading() {
  return (
    <main className="studio studio-loading" aria-label="Loading flower studio">
      <div className="studio-loading-card">
        <div className="studio-loading-mark">Loading Studio</div>
        <div className="studio-loading-track" aria-hidden="true">
          <span className="studio-loading-progress" />
        </div>
      </div>
    </main>
  );
}

export default function StudioPage() {
  return <StudioCanvas />;
}
