---
name: flower-reference-to-web
description: Turn a user-supplied flower reference image into a polished, interactive flower webpage in the Flower repository. Use when a user wants to generate, reinterpret, or refine a flower from a photo or illustration rather than manually edit a fixed preset; preserve the image's visual character while working within the repository's procedural flower engine.
---

# Flower Reference to Web

Create a complete, runnable flower webpage from a flower reference. Treat the procedural flower engine as the source of truth; treat existing Landing and Studio pages as reference implementations, not as the product to reproduce.

## Product contract

Deliver one flower that feels like the reference and is pleasant before the user touches any controls. The result must be a small, focused interactive webpage, not a general-purpose design tool.

The engine is a visual translator, not a botanical reconstruction system. Never promise an exact biological model. For a feature that the engine cannot express, preserve the reference's overall impression and record the approximation in the flower spec.

## Workflow

### 1. Inspect before deciding

1. Inspect the supplied image at full resolution. If no reference image is attached or reachable, ask for it before generating the flower.
2. Read [references/flower-spec.md](references/flower-spec.md), then create a concise `FlowerSpec` in the working notes or the generated project.
3. Read [references/engine-map.md](references/engine-map.md) before choosing values or changing `components/flower/flowerScene.ts`.
4. Inspect the narrowest existing source files needed for the task. Read the relevant guide under `node_modules/next/dist/docs/` before changing Next.js application code.

### 2. Translate the reference

Classify the image by visible structure, never by botanical name alone:

- Choose a structural family and silhouette.
- Describe one shared petal profile, density, centre treatment, openness, palette, and motion.
- Mark each feature as `direct`, `approximate`, or `unsupported`.
- Use `approximate` for distinct stamens, multiple petal species, irregular orchid-like anatomy, or other forms the current one-petal engine cannot model.

Start from the closest existing family only as a seed. Do not expose the old preset picker as the user-facing way to create the flower.

### 3. Build the webpage

1. Reuse or extend the procedural scene. Keep flower structure in scene/config code rather than scattering magic values through page components.
2. Make the generated flower's `FlowerSpec` the single default configuration. It must not depend on a user selecting one of the three legacy presets.
3. Keep only high-value interactions: replay bloom, openness, density or spread, palette mood, and motion. Expose three to five controls unless the user requests more.
4. Prefer a single immersive canvas and a quiet control surface. Do not recreate Studio's tabs, large parameter inventory, instructional sections, or design-tool affordances.
5. Keep existing Landing and Studio routes operational unless the user explicitly asks to replace or remove them.

### 4. Verify the result

1. Run the relevant static checks and build checks.
2. Open the result in a browser when possible. Confirm the flower is visible on load, controls change the intended property, bloom can replay, and the reference's dominant silhouette and colour relationship remain legible.
3. If the output looks unlike the reference, revise the structural family or core parameters before adding more controls.

## Non-negotiable constraints

- Do not use a downloaded 3D flower model or fake the result with a static reference image.
- Do not claim support for a visual feature the engine cannot generate.
- Do not turn a generated page into a full Studio clone.
- Do not add a separate interface for every internal engine parameter.
- Do not erase working demo routes or legacy preset code without an explicit request.
- Do not use an image's species name as sufficient evidence for its geometry; inspect its visible form.

## Handoff

State the generated flower's structural interpretation, the important controls, and any intentional approximations. Link the resulting route and changed source files.
