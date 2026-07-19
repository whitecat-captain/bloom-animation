#!/usr/bin/env python3
"""Resolve or register the reusable Flower Studio project."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from studio_project_state import (
    discover_projects,
    nearest_project,
    register_project,
    registered_project,
)


def resolve(start: Path, search_root: Path | None) -> int:
    nearest = nearest_project(start)
    if nearest is not None:
        print(nearest)
        return 0

    if search_root is not None:
        discovered = discover_projects(search_root)
        if len(discovered) == 1:
            print(discovered[0])
            return 0
        if len(discovered) > 1:
            print("Multiple Flower Studio projects found:", file=sys.stderr)
            for project in discovered:
                print(project, file=sys.stderr)
            return 2

    saved = registered_project()
    if saved is not None:
        print(saved)
        return 0

    print("No reusable Flower Studio project is registered.", file=sys.stderr)
    return 1


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Find the reusable Flower Studio project or register one."
    )
    parser.add_argument("--start", type=Path, default=Path.cwd())
    parser.add_argument("--search-root", type=Path)
    parser.add_argument(
        "--register",
        type=Path,
        help="Set an existing compatible project as the reusable default.",
    )
    args = parser.parse_args()

    if args.register is not None:
        try:
            project = register_project(args.register)
        except ValueError as error:
            raise SystemExit(str(error)) from error
        print(project)
        return

    raise SystemExit(resolve(args.start, args.search_root))


if __name__ == "__main__":
    main()
