"use client";

import { useEffect, useRef } from "react";
import { createDreamyScene } from "@/components/flower/dreamyScene";

// Standalone, non-interactive "dreamy photography" showcase: the phyllotaxis
// flower with milky translucent petals, heavy bloom and a hazy film look.
export default function DreamyPage() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const scene = createDreamyScene(containerRef.current);
    return () => scene.dispose();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: "fixed", inset: 0, background: "#2B60E2" }}
    />
  );
}
