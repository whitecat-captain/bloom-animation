"use client";

import dynamic from "next/dynamic";
import "./flower.css";

// WebGL scene runs in the browser only — skip SSR.
const FlowerCanvas = dynamic(() => import("@/components/flower/FlowerCanvas"), {
  ssr: false,
});

export default function FlowerPage() {
  return <FlowerCanvas />;
}
