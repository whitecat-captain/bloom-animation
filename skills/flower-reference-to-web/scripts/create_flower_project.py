#!/usr/bin/env python3
"""Create an editable Flower Studio project from the bundled template."""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
from pathlib import Path

from studio_project_state import mark_project, register_project


def install_dependencies(destination: Path) -> None:
    node = shutil.which("node")
    npm = shutil.which("npm")
    if node is None or npm is None:
        raise SystemExit(
            "Node.js and npm were not found. Install Node.js 20.9 or newer, then run npm install "
            f"inside {destination}."
        )

    version_output = subprocess.check_output([node, "--version"], text=True).strip()
    version_match = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?", version_output)
    if version_match is None or tuple(map(int, version_match.groups())) < (20, 9, 0):
        raise SystemExit(
            f"Studio requires Node.js 20.9 or newer; found {version_output}. "
            f"Upgrade Node.js, then run npm install inside {destination}."
        )

    print("Installing Studio dependencies...", flush=True)
    subprocess.run([npm, "install"], cwd=destination, check=True)


def create_project(
    destination: Path, install: bool = False, register: bool = True
) -> None:
    skill_dir = Path(__file__).resolve().parent.parent
    template_dir = skill_dir / "assets" / "studio-template"

    if not template_dir.is_dir():
        raise SystemExit(f"Studio template not found: {template_dir}")

    if destination.exists() and any(destination.iterdir()):
        raise SystemExit(f"Destination is not empty: {destination}")

    destination.mkdir(parents=True, exist_ok=True)
    shutil.copytree(
        template_dir,
        destination,
        dirs_exist_ok=True,
        ignore=shutil.ignore_patterns(
            "node_modules", ".next", "*.tsbuildinfo", ".DS_Store"
        ),
    )
    mark_project(destination)

    print(f"Created Flower Studio at {destination}", flush=True)
    if register:
        register_project(destination)
        print(f"Registered as the reusable Studio: {destination}")

    if install:
        install_dependencies(destination)
        print(f"Ready. Next: cd {destination} && npm run dev")
    else:
        print(f"Next: cd {destination} && npm install && npm run dev")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create a Flower Studio project from the skill template."
    )
    parser.add_argument(
        "destination",
        nargs="?",
        default="flower-studio",
        type=Path,
        help="New project directory (default: ./flower-studio)",
    )
    parser.add_argument(
        "--install",
        action="store_true",
        help="Install the copied Studio project's npm dependencies.",
    )
    parser.add_argument(
        "--no-register",
        action="store_true",
        help="Create an independent project without changing the reusable default.",
    )
    args = parser.parse_args()
    create_project(
        args.destination.resolve(),
        install=args.install,
        register=not args.no_register,
    )


if __name__ == "__main__":
    main()
