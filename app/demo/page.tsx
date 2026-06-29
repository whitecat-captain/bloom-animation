"use client";

import dynamic from "next/dynamic";
import "../flower.css";
import "./demo.css";

// WebGL scene runs in the browser only — skip SSR.
const DemoCanvas = dynamic(
  () => import("@/components/flower/DemoCanvas"),
  { ssr: false },
);

export default function DemoPage() {
  return <DemoCanvas />;
}
