"""Shared discovery and registration helpers for Flower Studio projects."""

from __future__ import annotations

import json
import os
from pathlib import Path


MARKER_NAME = ".flower-studio.json"
GENERATED_REGISTRY = Path("components/flower/generated/index.ts")
LEGACY_CONFIG = Path("components/flower/flowerConfig.ts")
SKIP_DIRECTORIES = {".git", ".next", "node_modules"}


def codex_home() -> Path:
    configured = os.environ.get("CODEX_HOME")
    return Path(configured).expanduser() if configured else Path.home() / ".codex"


def state_file() -> Path:
    return codex_home() / "flower-reference-to-web" / "studio-project.json"


def marker_data(project: Path) -> dict[str, object] | None:
    marker = project / MARKER_NAME
    if not marker.is_file():
        return None
    try:
        data = json.loads(marker.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def is_compatible(project: Path) -> bool:
    project = project.expanduser().resolve()
    marker = marker_data(project)
    if marker is not None:
        return (
            marker.get("product") == "flower-reference-to-web"
            and marker.get("template") is not True
        )
    return (project / GENERATED_REGISTRY).is_file() or (project / LEGACY_CONFIG).is_file()


def mark_project(project: Path) -> None:
    marker = {
        "product": "flower-reference-to-web",
        "schemaVersion": 1,
        "template": False,
    }
    (project / MARKER_NAME).write_text(
        json.dumps(marker, indent=2) + "\n", encoding="utf-8"
    )


def register_project(project: Path) -> Path:
    project = project.expanduser().resolve()
    if not is_compatible(project):
        raise ValueError(f"Not a compatible Flower Studio project: {project}")

    target = state_file()
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(".tmp")
    temporary.write_text(
        json.dumps({"defaultProject": str(project)}, indent=2) + "\n",
        encoding="utf-8",
    )
    temporary.replace(target)
    return project


def registered_project() -> Path | None:
    target = state_file()
    if not target.is_file():
        return None
    try:
        data = json.loads(target.read_text(encoding="utf-8"))
        project = Path(data["defaultProject"]).expanduser().resolve()
    except (OSError, KeyError, TypeError, json.JSONDecodeError):
        return None
    return project if is_compatible(project) else None


def nearest_project(start: Path) -> Path | None:
    current = start.expanduser().resolve()
    if current.is_file():
        current = current.parent
    for candidate in (current, *current.parents):
        if is_compatible(candidate):
            return candidate
    return None


def discover_projects(root: Path) -> list[Path]:
    root = root.expanduser().resolve()
    if not root.is_dir():
        return []

    discovered: list[Path] = []
    for current, directories, files in os.walk(root):
        directories[:] = [
            name for name in directories if name not in SKIP_DIRECTORIES
        ]
        if MARKER_NAME not in files:
            continue
        candidate = Path(current)
        if is_compatible(candidate):
            discovered.append(candidate.resolve())
            directories[:] = []
    return sorted(set(discovered))
