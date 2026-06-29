# BLOOM

A Next.js 16 / React 19 WebGL study in procedural botany. The page is one interactive flower story: GSAP drives scroll, Three.js renders the flower, and lil-gui exposes the design controls.

**🌸 [View the live demo →](https://bloom-animation-mu.vercel.app)**

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Open-ff69b4?style=for-the-badge&logo=vercel)](https://bloom-animation-mu.vercel.app)

## Acknowledgments

This project was built entirely by following the approach and ideas of **Danny Laursen**.

📺 **[Danny Laursen — Flower Bloom Tutorial Series](https://www.youtube.com/watch?v=aUajIqvl6H4&list=PLOGJpcoBCf0MhmgDJKTY9SMJJDWrhYLIu)**

Huge thanks to Danny for the clear, generous teaching that made this build possible. If you find this repo useful, please go watch his videos and support his work — all the credit for the underlying concepts belongs to him.

## Tech Stack

- **[Next.js](https://nextjs.org/) 16** / **[React](https://react.dev/) 19** — app shell and routing
- **[Three.js](https://threejs.org/)** — WebGL rendering of the instanced flower geometry and shaders
- **[GSAP](https://gsap.com/)** — scroll-driven animation and timeline scrubbing
- **[lil-gui](https://lil-gui.georgealways.com/)** — live design controls
- **[Tailwind CSS](https://tailwindcss.com/) 4** — styling
- **TypeScript**

## Getting Started

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

The WebGL scene runs in the browser only (SSR is disabled for the canvas).

## Project Map

- `app/page.tsx` — route entry. Dynamically loads the browser-only flower experience and imports page CSS.
- `app/layout.tsx` — metadata and global font setup.
- `app/flower.css` — all visual styling for the flower page, demos, glass controls, and lil-gui theme.
- `components/flower/FlowerCanvas.tsx` — thin client entry that wires refs, open state, scene lifecycle, and story layout.
- `components/flower/FlowerStory.tsx` — page structure: hero, step cards, finale, CTA, close button, and GUI shell.
- `components/flower/storySteps.ts` — editable story content, captions, code snippets, and demo assignment for each step.
- `components/flower/useFlowerSceneScroll.ts` — GSAP intro animation, scroll scrub, rail progress, mobile snap, and desktop wheel section stepping.
- `components/flower/useDesignCtaVisibility.ts` — switches the designer CTA between full and compact labels by active section.
- `components/flower/flowerScene.ts` — Three.js scene, shader, instanced flower geometry, GUI controls, render loop, and cleanup.
- `components/flower/StepDemos.tsx` — canvas-based explanatory figures shown inside the step cards.

## Common Edits

- Change story copy or code snippets: edit `components/flower/storySteps.ts`.
- Change page markup or buttons: edit `components/flower/FlowerStory.tsx`.
- Change scroll timing, section snapping, or reveal animations: edit `components/flower/useFlowerSceneScroll.ts`.
- Change when the CTA is compact/full: edit `components/flower/useDesignCtaVisibility.ts`.
- Change petal math, shader behavior, GUI sliders, or render lifecycle: edit `components/flower/flowerScene.ts`.
- Change small explanatory figures: edit `components/flower/StepDemos.tsx`.
- Change visual layout/theme: edit `app/flower.css`.

## Development

```bash
npm run dev
npm run lint
npm run build
```

Before code changes, read the local Next.js guide in `node_modules/next/dist/docs/` as noted in `AGENTS.md`; this project uses Next 16.2.4.
