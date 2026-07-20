#!/usr/bin/env python3
"""Prepare the bundled Studio runtime without copying its source code."""

from __future__ import annotations

import hashlib
import re
import shutil
import subprocess
from pathlib import Path


def studio_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "studio"


def dependency_fingerprint(project: Path) -> str:
    return hashlib.sha256((project / "package-lock.json").read_bytes()).hexdigest()


def require_node() -> tuple[str, str]:
    node = shutil.which("node")
    npm = shutil.which("npm")
    if node is None or npm is None:
        raise SystemExit("Flower Studio could not finish preparing on this computer.")

    version_output = subprocess.check_output([node, "--version"], text=True).strip()
    version_match = re.fullmatch(r"v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?", version_output)
    if version_match is None or tuple(map(int, version_match.groups())) < (20, 9, 0):
        raise SystemExit("Flower Studio could not finish preparing on this computer.")
    return node, npm


def prepare() -> Path:
    project = studio_dir()
    if not (project / "package.json").is_file():
        raise SystemExit("The bundled Flower Studio is incomplete.")

    _, npm = require_node()
    expected = dependency_fingerprint(project)
    stamp = project / ".flower-studio-dependencies"
    current = stamp.read_text(encoding="utf-8").strip() if stamp.is_file() else ""
    if (project / "node_modules" / "next").is_dir() and current == expected:
        print("Flower Studio is ready.")
        return project

    print("Preparing Flower Studio for first use...", flush=True)
    subprocess.run([npm, "install"], cwd=project, check=True)
    stamp.write_text(expected + "\n", encoding="utf-8")
    print("Flower Studio is ready.")
    return project


if __name__ == "__main__":
    prepare()
