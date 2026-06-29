"use client";

import dynamic from "next/dynamic";
import "../flower.css";

const FlowerHeroCanvas = dynamic(
  () => import("@/components/flower/FlowerHeroCanvas"),
  {
    ssr: false,
  },
);

export default function HeroPage() {
  return <FlowerHeroCanvas />;
}
