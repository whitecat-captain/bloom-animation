"use client";

import dynamic from "next/dynamic";
import "../flower.css";
import "./studio.css";

// WebGL + MediaRecorder are browser-only — skip SSR.
const StudioCanvas = dynamic(() => import("@/components/flower/StudioCanvas"), {
  ssr: false,
});

export default function StudioPage() {
  return <StudioCanvas />;
}
