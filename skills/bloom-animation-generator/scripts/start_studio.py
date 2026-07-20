#!/usr/bin/env python3
"""Start or reuse the bundled Flower Studio development server."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import signal
import socket
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

from prepare_studio import prepare, studio_dir


def codex_home() -> Path:
    configured = os.environ.get("CODEX_HOME")
    return Path(configured).expanduser() if configured else Path.home() / ".codex"


def runtime_dir() -> Path:
    return codex_home() / "flower-reference-to-web"


def runtime_file() -> Path:
    return runtime_dir() / "studio-runtime.json"


def url_is_ready(url: str) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=1) as response:
            return response.status == 200
    except (OSError, urllib.error.URLError):
        return False


def saved_runtime() -> tuple[int, str] | None:
    target = runtime_file()
    if not target.is_file():
        return None
    try:
        data = json.loads(target.read_text(encoding="utf-8"))
        pid = int(data["pid"])
        url = str(data["url"])
        project = Path(data["project"]).resolve()
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        return None
    return (pid, url) if project == studio_dir().resolve() and url_is_ready(url) else None


def available_port() -> int:
    for port in range(3000, 3021):
        with socket.socket() as candidate:
            try:
                candidate.bind(("127.0.0.1", port))
            except OSError:
                continue
            return port
    raise SystemExit("Flower Studio could not find an available local port.")


def start() -> str:
    existing = saved_runtime()
    if existing is not None:
        print(existing[1])
        return existing[1]

    project = prepare()
    npm = shutil.which("npm")
    if npm is None:
        raise SystemExit("Flower Studio could not start on this computer.")

    port = available_port()
    url = f"http://127.0.0.1:{port}/studio"
    storage = runtime_dir()
    storage.mkdir(parents=True, exist_ok=True)
    log_path = storage / "studio.log"
    with log_path.open("ab") as log:
        process = subprocess.Popen(
            [
                npm,
                "run",
                "dev",
                "--",
                "--hostname",
                "127.0.0.1",
                "--port",
                str(port),
            ],
            cwd=project,
            stdin=subprocess.DEVNULL,
            stdout=log,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )

    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        if url_is_ready(url):
            runtime_file().write_text(
                json.dumps(
                    {"pid": process.pid, "url": url, "project": str(project)},
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )
            print(url)
            return url
        if process.poll() is not None:
            break
        time.sleep(0.5)

    raise SystemExit(f"Flower Studio did not start. Details: {log_path}")


def stop() -> None:
    target = runtime_file()
    try:
        data = json.loads(target.read_text(encoding="utf-8"))
        pid = int(data["pid"])
    except (OSError, KeyError, TypeError, ValueError, json.JSONDecodeError):
        print("Flower Studio is not running.")
        return

    try:
        if hasattr(os, "killpg"):
            os.killpg(pid, signal.SIGTERM)
        else:
            os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    target.unlink(missing_ok=True)
    print("Flower Studio stopped.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Start the bundled Flower Studio.")
    parser.add_argument("--stop", action="store_true")
    args = parser.parse_args()
    if args.stop:
        stop()
    else:
        start()


if __name__ == "__main__":
    main()
