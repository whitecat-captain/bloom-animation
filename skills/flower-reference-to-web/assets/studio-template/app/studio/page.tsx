"use client";

import dynamic from "next/dynamic";
import StudioLoading from "@/components/flower/StudioLoading";
import "../flower.css";
import "./studio-loading.css";
import "./studio.css";
import "./studio-sheet.css";
import "./studio-responsive.css";

// WebGL + MediaRecorder are browser-only — skip SSR.
const StudioCanvas = dynamic(() => import("@/components/flower/StudioCanvas"), {
  loading: () => <StudioLoading />,
  ssr: false,
});

export default function StudioPage() {
  return <StudioCanvas />;
}
