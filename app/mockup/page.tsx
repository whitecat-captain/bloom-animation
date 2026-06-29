"use client";

import dynamic from "next/dynamic";
import "./mockup.css";

// WebGL scene runs in the browser only — skip SSR.
const MockupShowcase = dynamic(
  () => import("@/components/flower/MockupShowcase"),
  { ssr: false },
);

export default function MockupPage() {
  return <MockupShowcase />;
}
