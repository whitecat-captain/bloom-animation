---
name: bloom-animation-generator
description: Turn a user-supplied flower photo or illustration into an editable, previewable, and exportable bloom animation in the reusable Flower Studio bundled with this Skill. Use when a user wants to generate, interpret, refine, preview, or export an animated flower from a visual reference rather than manually edit a fixed preset; automatically prepare and start Studio without asking the user about project folders, Next.js, npm, or source-code setup.
---

# Bloom Animation Generator

Create or update a complete `FlowerConfig` from a flower reference and load it into the Studio bundled with this Skill. Run that Studio in place; never copy its application source for a generated flower.

## Product contract

Deliver one flower that feels like the reference and is pleasant before the user touches any controls. It must open inside the full Studio so the user can refine, preview, and export it with the project's existing capabilities.

Reuse one bundled Studio for every flower. Persist user flowers as data outside the installed Skill so Skill updates do not erase them.

## Interaction contract

Treat the user as a designer, not a developer. On the normal path:

- Do not ask where to create Studio. There is no separate Studio project to create.
- Do not ask the user to run commands or install dependencies.
- Do not expose Next.js, npm, source paths, `FlowerConfig`, or project-directory decisions.
- Describe first-run work as “Preparing your Flower Studio.” It may take longer once; continue without requesting confirmation.
- Open the finished Studio and lead with the visual result. Keep technical implementation details out of the handoff unless the user asks.

If setup genuinely fails, explain the problem in plain language and offer one concrete next action. Show terminal commands only when the user asks for technical steps.

The engine is a visual translator, not a botanical reconstruction system. Never promise an exact biological model. For a feature that the engine cannot express, preserve the reference's overall impression and record the approximation in the flower spec.

## Workflow

### 1. Inspect before deciding

1. Inspect the supplied image at full resolution. If no reference image is attached or reachable, ask for it before generating the flower.
2. Read [references/flower-spec.md](references/flower-spec.md), then create a concise `FlowerSpec` in the working notes.
3. Read [references/engine-map.md](references/engine-map.md) before choosing values or changing the flower engine.

### 2. Prepare the bundled Studio

1. Run `python3 scripts/prepare_studio.py` from this skill directory. This prepares the bundled Studio in place and does not copy its source.
2. Continue automatically during first-run preparation. Do not ask for a destination or describe the internal dependency setup.
3. If preparation fails, explain only that Flower Studio could not finish preparing on this computer and offer to help fix it. Do not lead with package-manager terminology.
4. Do not change Studio application source during normal flower generation. Only change it when the user explicitly asks to develop the engine or interface.

### 3. Translate the reference

Classify the image by visible structure, never by botanical name alone:

- Choose a structural family and silhouette.
- Describe one shared petal profile, density, centre treatment, openness, palette, and motion.
- Mark each feature as `direct`, `approximate`, or `unsupported`.
- Use `approximate` for distinct stamens, multiple petal species, irregular orchid-like anatomy, or other forms the current one-petal engine cannot model.

Start from the closest existing family only as a seed. Do not expose the old preset picker as the user-facing way to create the flower.

### 4. Build the Studio configuration

1. Fingerprint a reachable reference with `python3 scripts/fingerprint_reference.py <reference>`.
2. Build one JSON object compatible with the `FlowerConfig` shape in `studio/components/flower/flowerConfig.ts`. Give it a stable kebab-case `id`, a human-readable name, `source: "generated"`, reference metadata, params, palette, and optional camera.
3. Write that object to a temporary JSON file, then run `python3 scripts/upsert_flower.py <temporary-json>`. The script updates the same fingerprint or stable ID and otherwise prepends a new flower in the persistent data store.
4. Do not create TypeScript files, modify the built-in preset registry, or copy application code for a user flower. User flowers must remain external data.
5. Reuse the full Studio design, preview, and export controls. Treat export as a core outcome, not an optional advanced mode.
6. Do not add a simplified result panel between the generated flower and Studio.

### 5. Verify the result

1. Run `python3 scripts/start_studio.py` and use the returned local Studio URL. Reuse an already running Studio automatically.
2. Open Studio in a browser. Confirm the saved flower is selected and visible on load, Studio controls change the intended properties, bloom can replay, and export controls remain available.
3. If the output looks unlike the reference, revise the JSON configuration and run `upsert_flower.py` again before adding more controls.

## Non-negotiable constraints

- Do not use a downloaded 3D flower model or fake the result with a static reference image.
- Do not copy the bundled Studio or create another Next.js project.
- Do not store user-generated flowers in installed Skill source files.
- Do not duplicate a flower when the same reference fingerprint or stable flower ID already exists.
- Do not claim support for a visual feature the engine cannot generate.
- Do not create a separate generated page or reduced result panel when Studio already provides the required interaction and export workflow.
- Do not hide or demote Studio's export capability behind a non-essential intermediate interface.
- Do not erase working demo routes or legacy preset code without an explicit request.
- Do not use an image's species name as sufficient evidence for its geometry; inspect its visible form.

## Handoff

Lead with the opened flower. State its structural interpretation, important controls, and intentional approximations. Do not mention data paths or implementation files unless the user asks.
