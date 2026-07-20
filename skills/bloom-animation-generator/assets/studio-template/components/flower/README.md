# Flower Component Notes

This folder is split to keep future edits small:

- `FlowerCanvas.tsx` is the client boundary and should stay small.
- `FlowerStory.tsx` owns JSX structure only.
- `storySteps.ts` owns narrative content only.
- `useFlowerSceneScroll.ts` owns GSAP and browser lifecycle side effects.
- `useDesignCtaVisibility.ts` owns compact/full designer CTA switching.
- `flowerScene.ts` owns WebGL, shaders, GUI controls, and rendering.
- `StepDemos.tsx` owns the canvas explainer figures.

When changing behavior, open the narrowest file first. Pull in adjacent files only when the change crosses boundaries, such as adding a new story step that also needs a new demo component.
