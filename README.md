# Flower Reference to Web

Turn a flower photo into a procedural, editable, and exportable 3D bloom.

Upload a reference image, ask the Skill to recreate it, and continue in the bundled Flower Studio. The Studio, flower engine, controls, and exporter are already included in this repository; each new flower is saved as data instead of creating another Next.js project.

![Flower Studio demo](./skills/flower-reference-to-web/assets/studio-template/public/bloom-animation-generator-demo.gif)

## Install

The simplest way is to paste this into a Codex conversation:

```text
Install the flower-reference-to-web skill from
https://github.com/whitecat-captain/bloom-animation/tree/main/skills/flower-reference-to-web
```

Codex will handle the installation. If the Skill does not appear immediately, start a new Codex task.

To keep a local copy of the repository instead, use:

```bash
git clone https://github.com/whitecat-captain/bloom-animation.git
cd bloom-animation
python3 scripts/install_skill.py
```

This links the Skill from the repository into the shared Agent Skills folder, so pulling future repository updates also updates the installed Skill.

## Use

Attach a flower image and ask:

```text
Use $flower-reference-to-web to recreate this flower and open it in Flower Studio.
```

The Skill inspects the visible structure, palette, and opening state; translates them into the existing procedural flower system; saves the flower; and opens the bundled Studio for refinement and export.

On first use, it may spend a little longer preparing Flower Studio. There is no destination folder to choose, no new web project to create, and no separate dependency setup to complete. Later flowers reuse the same Studio and remain available alongside earlier results.

The engine is a visual translator rather than a botanical reconstruction system. Details such as complex stamens, multiple petal species, droplets, or strongly asymmetric anatomy may be approximated while preserving the flower's overall character.

## What is included

```text
skills/flower-reference-to-web/
├── SKILL.md                  # Workflow and visual constraints
├── agents/openai.yaml        # Codex presentation metadata
├── references/               # FlowerSpec and engine capability maps
├── scripts/                  # Flower storage and Studio runtime helpers
├── examples/                 # Tested reference translations
└── assets/studio-template/   # Reusable Studio, flower engine, and exporter
```

The bundled Next.js application is the reusable runtime and demo—not an application template copied for every result. Generated flowers are stored separately from the Skill, so updating the repository does not erase them.

## Compatibility

The Skill uses the open `SKILL.md` Agent Skills format, but the complete workflow is currently designed and tested as a local experience.

| Environment | Current support |
| --- | --- |
| Codex app, CLI, and IDE extension | Supported and tested. |
| Cursor editor and CLI | The Skill format and shared installation location are compatible; the full flower workflow still needs a dedicated end-to-end test. |
| Claude Code | The Skill content is compatible, but Claude Code uses its own Skill folder and invocation style. Install it into `~/.claude/skills` and invoke it with `/flower-reference-to-web`. |
| Codex Cloud and other cloud agents | They can inspect and run the repository, but the current result flow expects a local browser and persistent local flower library. It is not yet the same one-click interactive experience. |

`agents/openai.yaml` only adds Codex-specific presentation metadata. Other compatible agents can ignore it and use the same `SKILL.md`, scripts, references, and Studio assets.

## Run Flower Studio directly

The Skill normally prepares and opens Studio automatically. To run the included demo yourself:

```bash
npm install --prefix skills/flower-reference-to-web/assets/studio-template
npm run dev --prefix skills/flower-reference-to-web/assets/studio-template
```

Then open `http://localhost:3000/studio`.

An existing hosted demo is available at [bloom-animation-mu.vercel.app](https://bloom-animation-mu.vercel.app). For a new Vercel project, set the Root Directory to `skills/flower-reference-to-web/assets/studio-template`.

## Update or remove

For a linked local installation, update with:

```bash
git pull
```

To remove it, delete only the installed Skill link from `~/.agents/skills/flower-reference-to-web`. This does not delete the repository or previously generated flowers. You can also ask Codex to update or uninstall the Skill for you.

## Acknowledgments

The procedural bloom approach was originally learned from [Danny Laursen's Flower Bloom tutorial series](https://www.youtube.com/watch?v=aUajIqvl6H4&list=PLOGJpcoBCf0MhmgDJKTY9SMJJDWrhYLIu).
