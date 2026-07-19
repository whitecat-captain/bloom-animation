#!/usr/bin/env python3
"""Print a stable SHA-256 fingerprint for a flower reference file."""

from __future__ import annotations

import argparse
import hashlib
from pathlib import Path


def fingerprint(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description="Fingerprint a flower reference file.")
    parser.add_argument("reference", type=Path)
    args = parser.parse_args()

    reference = args.reference.expanduser().resolve()
    if not reference.is_file():
        raise SystemExit(f"Reference file not found: {reference}")
    print(fingerprint(reference))


if __name__ == "__main__":
    main()
