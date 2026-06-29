"use client";

import dynamic from "next/dynamic";
import "../flower.css";
import "./social.css";

// WebGL scene runs in the browser only — skip SSR.
const SocialCanvas = dynamic(
  () => import("@/components/flower/SocialCanvas"),
  { ssr: false },
);

export default function SocialPage() {
  return <SocialCanvas />;
}
