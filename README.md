# Flower Reference to Web

Turn a flower photo into a procedural, editable, and exportable 3D bloom.

This repository is an installable Codex skill. Give it a flower reference image and it will create a runnable Flower Studio project, translate the image into a typed `FlowerConfig`, load the result in Studio, and verify that the flower can be refined and exported.

![Flower Studio demo](./skills/flower-reference-to-web/assets/studio-template/public/bloom-animation-generator-demo.gif)

## Requirements

- Git and Python 3 for installing from a clone
- Codex for running the Skill
- Node.js 20.9 or newer only when creating or running a Studio project

You do not need to install the Next.js dependencies just to install the Skill.

## What is installed where

| Item | Location | When it is created |
| --- | --- | --- |
| Repository source | Wherever you clone it | Once |
| Installed Skill | `~/.codex/skills/flower-reference-to-web` | Once |
| Default Studio pointer | `~/.codex/flower-reference-to-web/studio-project.json` | On first use |
| Generated Studio project | A destination chosen with the user | Once per project |
| Next.js dependencies | `node_modules` inside that generated project | During first generation |

The installed Skill and generated Studio projects are separate. Updating or uninstalling the Skill does not remove a user's generated flowers.

## Install from a local clone

```bash
git clone https://github.com/whitecat-captain/bloom-animation.git
cd bloom-animation
python3 scripts/install_skill.py
```

The installer links the Skill into `~/.codex/skills/flower-reference-to-web`. Linking is recommended because a later `git pull` also updates the installed Skill.

Restart Codex after installation so it discovers the Skill.

If your system does not allow symbolic links, install a copy instead:

```bash
python3 scripts/install_skill.py --copy
```

A copied installation does not update with `git pull`; run the installer again after moving or removing the old copy.

If `CODEX_HOME` is configured, the installer uses `$CODEX_HOME/skills` instead of `~/.codex/skills`. A custom location can also be supplied with `--skills-dir`.

## Install without cloning

Ask Codex:

```text
Install the flower-reference-to-web skill from
https://github.com/whitecat-captain/bloom-animation/tree/main/skills/flower-reference-to-web
```

Or use the bundled Codex skill installer:

```bash
python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo whitecat-captain/bloom-animation \
  --path skills/flower-reference-to-web
```

This downloads the Skill into the Codex skills directory. Pulling the repository later will not update this kind of installation.

## Use

Attach a flower photo and ask:

```text
Use $flower-reference-to-web to turn this flower into an interactive Studio project.
```

The skill will:

1. Inspect the visible flower structure, palette, and opening state.
2. Record a concise `FlowerSpec`, including intentional approximations.
3. Find and reuse the user's registered Flower Studio.
4. Create the Studio and install its dependencies only on first use.
5. Add a new typed `FlowerConfig`, or update the existing one for the same reference.
6. Keep earlier flowers available and load the latest flower by default.
7. Run checks and open Studio for refinement, preview, and export.

Calling the Skill again does not normally create another Next.js project. One Studio can hold many generated flowers. A separate project is created only when the user explicitly asks for one.

Generated flowers live one-per-file in `components/flower/generated/`. Reusing the same reference updates its existing configuration; a genuinely new flower is added to the shared registry and appears alongside earlier flowers in Studio.

The engine is a visual translator rather than a botanical reconstruction system. Complex stamens, multiple petal species, droplets, and strongly asymmetric anatomy may be approximated instead of reproduced literally.

## Repository structure

```text
skills/flower-reference-to-web/
├── SKILL.md                  # Agent workflow and constraints
├── agents/openai.yaml        # Skill UI metadata
├── references/               # FlowerSpec and engine capability maps
├── scripts/                  # Deterministic project creation
├── examples/                 # Tested reference translations
└── assets/studio-template/   # Reusable Next.js Studio, engine, and exporter
```

The Next.js code is bundled as a Skill asset. It is not the repository's primary interface.

## Run the bundled Studio demo

The demo is optional and its dependencies stay inside the bundled Studio template:

```bash
npm install --prefix skills/flower-reference-to-web/assets/studio-template
npm run dev --prefix skills/flower-reference-to-web/assets/studio-template
```

Open `http://localhost:3000/studio`.

👉 Existing hosted demo: [bloom-animation-mu.vercel.app](https://bloom-animation-mu.vercel.app)

For a new Vercel project, set the Root Directory to `skills/flower-reference-to-web/assets/studio-template`.

## Update or uninstall

For the recommended linked installation:

```bash
git pull
```

To uninstall, remove only the installed Skill entry:

```bash
unlink ~/.codex/skills/flower-reference-to-web
```

This does not delete the cloned repository or any Studio projects previously generated from it.

For a copied installation, move the installed directory out of the skills folder instead:

```bash
mv ~/.codex/skills/flower-reference-to-web ~/.codex/flower-reference-to-web-backup
```

## Common setup issues

- **Codex cannot find the Skill:** restart Codex and begin a new task after installation.
- **The installation destination already exists:** the installer intentionally refuses to overwrite it. Move the old entry, then run the installer again.
- **Node.js/npm is missing or too old:** install Node.js 20.9 or newer, then run `npm install` inside the generated Studio. The Skill itself remains installed.
- **A copied Skill did not update after `git pull`:** copied installations are independent. Move the old installed copy and rerun `python3 scripts/install_skill.py --copy`.
- **The default Studio was moved or deleted:** open the moved Studio in the current Codex workspace, or ask Codex to register its new path. A stale pointer never deletes or overwrites a project.

## Acknowledgments

The procedural bloom approach was originally learned from [Danny Laursen's Flower Bloom tutorial series](https://www.youtube.com/watch?v=aUajIqvl6H4&list=PLOGJpcoBCf0MhmgDJKTY9SMJJDWrhYLIu).
