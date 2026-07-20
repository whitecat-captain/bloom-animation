#!/usr/bin/env python3
"""Install the repository's Agent Skill from a local clone."""

from __future__ import annotations

import argparse
import shutil
from pathlib import Path


SKILL_NAME = "bloom-animation-generator"


def default_skills_dir() -> Path:
    return Path.home() / ".agents" / "skills"


def install(source: Path, destination: Path, copy: bool) -> None:
    if not (source / "SKILL.md").is_file():
        raise SystemExit(f"Skill source not found: {source}")

    destination.parent.mkdir(parents=True, exist_ok=True)

    if destination.is_symlink() and destination.resolve() == source.resolve():
        print(f"Already installed: {destination} -> {source}")
        return

    if destination.exists() or destination.is_symlink():
        raise SystemExit(
            f"Installation destination already exists: {destination}\n"
            "Move or remove it first if you want to replace that installation."
        )

    if copy:
        shutil.copytree(
            source,
            destination,
            ignore=shutil.ignore_patterns(
                ".git",
                ".claude",
                "node_modules",
                ".next",
                ".flower-studio-dependencies",
                "hyperframes-video",
                "*.tsbuildinfo",
                ".DS_Store",
            ),
        )
        method = "Copied"
    else:
        try:
            destination.symlink_to(source.resolve(), target_is_directory=True)
        except OSError as error:
            raise SystemExit(
                f"Could not create the skill link: {error}\n"
                "Run this command again with --copy on systems where symlinks are unavailable."
            ) from error
        method = "Linked"

    print(f"{method} {SKILL_NAME} to {destination}")
    print("Start a new agent task, attach a flower image, and invoke bloom-animation-generator.")


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    source = repo_root

    parser = argparse.ArgumentParser(
        description="Install the bloom-animation-generator Agent Skill from this clone."
    )
    parser.add_argument(
        "--copy",
        action="store_true",
        help="Copy the skill instead of linking it (updates then require reinstalling).",
    )
    parser.add_argument(
        "--skills-dir",
        type=Path,
        default=default_skills_dir(),
        help="Agent Skills directory (default: ~/.agents/skills).",
    )
    args = parser.parse_args()

    skills_dir = args.skills_dir.expanduser().resolve()
    install(source, skills_dir / SKILL_NAME, args.copy)


if __name__ == "__main__":
    main()
