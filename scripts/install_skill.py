#!/usr/bin/env python3
"""Install the repository's Codex skill from a local clone."""

from __future__ import annotations

import argparse
import os
import shutil
from pathlib import Path


SKILL_NAME = "flower-reference-to-web"


def default_skills_dir() -> Path:
    codex_home = os.environ.get("CODEX_HOME")
    if codex_home:
        return Path(codex_home).expanduser() / "skills"
    return Path.home() / ".codex" / "skills"


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
                "node_modules", ".next", "*.tsbuildinfo", ".DS_Store"
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
    print("Restart Codex, then attach a flower image and invoke $flower-reference-to-web.")


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    source = repo_root / "skills" / SKILL_NAME

    parser = argparse.ArgumentParser(
        description="Install the flower-reference-to-web skill from this clone."
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
        help="Codex skills directory (default: $CODEX_HOME/skills or ~/.codex/skills).",
    )
    args = parser.parse_args()

    skills_dir = args.skills_dir.expanduser().resolve()
    install(source, skills_dir / SKILL_NAME, args.copy)


if __name__ == "__main__":
    main()
