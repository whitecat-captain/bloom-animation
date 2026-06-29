"use client";

import dynamic from "next/dynamic";
import "../flower.css";
import "../social/social.css";
import "./dahlia.css";

// WebGL scene is browser-only — skip SSR (same pattern as /social).
const DahliaCanvas = dynamic(
  () => import("@/components/flower/DahliaCanvas"),
  { ssr: false },
);

export default function DahliaPage() {
  return <DahliaCanvas />;
}
