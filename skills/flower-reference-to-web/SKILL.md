---
name: flower-reference-to-web
description: Turn a user-supplied flower reference image into a Studio-ready FlowerConfig in the Flower repository. Use when a user wants to generate, reinterpret, refine, preview, or export a flower from a photo or illustration rather than manually edit a fixed preset; preserve the image's visual character while working within the repository's procedural flower engine and full Studio workflow.
---

# Flower Reference to Web

Create or update a complete `FlowerConfig` from a flower reference and load it directly into one reusable Studio project. Treat the procedural engine and Studio as a long-lived flower workspace; do not create a Next.js project for every invocation.

## Product contract

Deliver one flower that feels like the reference and is pleasant before the user touches any controls. It must open inside the full Studio so the user can refine, preview, and export it with the project's existing capabilities.

Reuse one Studio for many flowers. Create a new Studio only when no compatible project exists or when the user explicitly requests an independent project.

The engine is a visual translator, not a botanical reconstruction system. Never promise an exact biological model. For a feature that the engine cannot express, preserve the reference's overall impression and record the approximation in the flower spec.

## Workflow

### 1. Inspect before deciding

1. Inspect the supplied image at full resolution. If no reference image is attached or reachable, ask for it before generating the flower.
2. Read [references/flower-spec.md](references/flower-spec.md), then create a concise `FlowerSpec` in the working notes or the generated project.
3. Read [references/engine-map.md](references/engine-map.md) before choosing values or changing the flower engine.

### 2. Prepare the Studio project

1. Run `python3 scripts/resolve_studio_project.py --start <current-directory> --search-root <workspace-root>` from this skill directory.
2. Reuse the resolved project and register it with `python3 scripts/resolve_studio_project.py --register <project>` so later tasks find it. If multiple projects are reported, ask which one to use before registering anything.
3. If none exists, ask where the user's reusable Flower Studio should live, then run `python3 scripts/create_flower_project.py <destination> --install`. This creates and registers the default Studio.
4. Create another Next.js project only when the user explicitly requests an independent project. Use `--no-register` unless they also want it to become the new default.
5. If Node.js or npm is unavailable, explain that Studio requires Node.js 20.9 or newer. Do not edit the installed template in place.
6. Inspect the narrowest project files needed for the task. Read the relevant guide under `node_modules/next/dist/docs/` before changing Next.js application code.

### 3. Translate the reference

Classify the image by visible structure, never by botanical name alone:

- Choose a structural family and silhouette.
- Describe one shared petal profile, density, centre treatment, openness, palette, and motion.
- Mark each feature as `direct`, `approximate`, or `unsupported`.
- Use `approximate` for distinct stamens, multiple petal species, irregular orchid-like anatomy, or other forms the current one-petal engine cannot model.

Start from the closest existing family only as a seed. Do not expose the old preset picker as the user-facing way to create the flower.

For a tested compact-rosette translation, consult [examples/crimson-rose/flower-spec.md](examples/crimson-rose/flower-spec.md).

### 4. Build the Studio configuration

1. Fingerprint a reachable reference with `python3 scripts/fingerprint_reference.py <reference>`.
2. Search `components/flower/generated/` for the same `reference.fingerprint`, then for the intended stable flower `id`. If either matches, update that existing config instead of creating a duplicate. If identity is ambiguous, ask whether to update or add.
3. Keep each generated flower in its own `components/flower/generated/<flowerName>.ts` file as a typed `FlowerConfig`. Give it a stable kebab-case `id`, a human-readable name, and reference metadata when available.
4. Export every generated flower from `components/flower/generated/index.ts`. Put the flower created or updated in this invocation first so Studio selects it on load; keep all older flowers in the array.
5. Reuse or extend the procedural scene. Do not scatter flower-specific magic values through page components or duplicate a page.
6. Reuse the full Studio design, preview, and export controls. Treat export as a core outcome, not an optional advanced mode.
7. Do not add a simplified result panel between the generated flower and Studio. Keep existing Landing, Studio, and demo routes operational unless the user explicitly asks otherwise.

### 5. Verify the result

1. Run `npx tsc --noEmit`, `npm run lint`, `npm run build`, and `git diff --check` when the project is a Git checkout.
2. Open Studio in a browser when possible. Confirm the generated flower is selected and visible on load, Studio controls change the intended properties, bloom can replay, and export controls remain available.
3. If the output looks unlike the reference, revise the structural family or core parameters before adding more controls.

## Non-negotiable constraints

- Do not use a downloaded 3D flower model or fake the result with a static reference image.
- Do not modify files inside the installed skill. Create or use a separate Studio project.
- Do not create a new Next.js project merely because the Skill was invoked again.
- Do not duplicate a flower when the same reference fingerprint or stable flower ID already exists.
- Do not claim support for a visual feature the engine cannot generate.
- Do not create a separate generated page or reduced result panel when Studio already provides the required interaction and export workflow.
- Do not hide or demote Studio's export capability behind a non-essential intermediate interface.
- Do not erase working demo routes or legacy preset code without an explicit request.
- Do not use an image's species name as sufficient evidence for its geometry; inspect its visible form.

## Handoff

State the generated flower's structural interpretation, the important controls, and any intentional approximations. Link the resulting route and changed source files.
