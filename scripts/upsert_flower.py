#!/usr/bin/env python3
"""Add or update one flower in the persistent Flower Studio data store."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
from typing import Any


def codex_home() -> Path:
    configured = os.environ.get("CODEX_HOME")
    return Path(configured).expanduser() if configured else Path.home() / ".codex"


def data_file() -> Path:
    return codex_home() / "flower-reference-to-web" / "flowers.json"


def valid_palette(value: object) -> bool:
    return (
        isinstance(value, list)
        and len(value) == 5
        and all(
            isinstance(stop, list)
            and len(stop) == 3
            and all(isinstance(channel, (int, float)) for channel in stop)
            for stop in value
        )
    )


def validate_flower(value: object) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ValueError("Flower configuration must be a JSON object.")
    if not isinstance(value.get("id"), str) or not value["id"].strip():
        raise ValueError("Flower configuration needs a non-empty id.")
    if not isinstance(value.get("name"), str) or not value["name"].strip():
        raise ValueError("Flower configuration needs a non-empty name.")
    if not isinstance(value.get("params"), dict):
        raise ValueError("Flower configuration needs a params object.")
    if not valid_palette(value.get("palette")):
        raise ValueError("Flower palette must contain five RGB stops.")

    flower = dict(value)
    flower["source"] = "generated"
    return flower


def read_store(target: Path) -> dict[str, Any]:
    if not target.is_file():
        return {"schemaVersion": 1, "flowers": []}
    try:
        stored = json.loads(target.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise ValueError(f"Flower data is not valid JSON: {target}") from error
    if not isinstance(stored, dict) or not isinstance(stored.get("flowers"), list):
        raise ValueError(f"Flower data has an unsupported format: {target}")
    return stored


def same_reference(existing: object, incoming: dict[str, Any]) -> bool:
    if not isinstance(existing, dict):
        return False
    existing_reference = existing.get("reference")
    incoming_reference = incoming.get("reference")
    if isinstance(existing_reference, dict) and isinstance(incoming_reference, dict):
        existing_fingerprint = existing_reference.get("fingerprint")
        incoming_fingerprint = incoming_reference.get("fingerprint")
        if existing_fingerprint and existing_fingerprint == incoming_fingerprint:
            return True
    return existing.get("id") == incoming["id"]


def upsert(source: Path) -> Path:
    flower = validate_flower(json.loads(source.read_text(encoding="utf-8")))
    target = data_file()
    stored = read_store(target)
    flowers = [
        existing
        for existing in stored["flowers"]
        if not same_reference(existing, flower)
    ]
    stored = {"schemaVersion": 1, "flowers": [flower, *flowers]}

    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(".tmp")
    temporary.write_text(json.dumps(stored, indent=2) + "\n", encoding="utf-8")
    temporary.replace(target)
    print("Flower saved to Studio.")
    return target


def main() -> None:
    parser = argparse.ArgumentParser(description="Add or update a Studio flower.")
    parser.add_argument("flower", type=Path, help="FlowerConfig-compatible JSON file")
    args = parser.parse_args()
    try:
        upsert(args.flower.expanduser().resolve())
    except (OSError, json.JSONDecodeError, ValueError) as error:
        raise SystemExit(str(error)) from error


if __name__ == "__main__":
    main()
