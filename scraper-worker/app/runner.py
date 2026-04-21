"""
Sandboxed execution of a user's scraper.py.
Returns a list of offer dicts parsed from the subprocess stdout (JSON).
Logs stdout+stderr to users_datas/<uid>/scraper.log.
"""
from __future__ import annotations

import ast
import json
import os
import subprocess
import sys
from pathlib import Path
from uuid import UUID

import structlog

from .config import settings
from .fs import scraper_path, scraper_log_path, user_dir

log = structlog.get_logger()

# Primitives forbidden in scraper AST before execution
_FORBIDDEN_CALLS = {"exec", "eval", "compile", "__import__", "open", "subprocess"}
_FORBIDDEN_ATTRS = {"socket", "popen", "system", "getenv"}


class ScraperError(Exception):
    pass


def _ast_lint(source: str) -> None:
    try:
        tree = ast.parse(source)
    except SyntaxError as e:
        raise ScraperError(f"syntax error: {e}") from e

    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            func = node.func
            name = ""
            if isinstance(func, ast.Name):
                name = func.id
            elif isinstance(func, ast.Attribute):
                name = func.attr
            if name in _FORBIDDEN_CALLS:
                raise ScraperError(f"forbidden call: {name}()")
        if isinstance(node, ast.Attribute) and node.attr in _FORBIDDEN_ATTRS:
            raise ScraperError(f"forbidden attribute: .{node.attr}")


def run_scraper(user_id: UUID, *, demo: bool = False, limit: int = 0) -> list[dict]:
    uid = str(user_id)
    spath = scraper_path(user_id)
    if not spath.exists():
        raise ScraperError(f"scraper.py not found for user {uid}")

    source = spath.read_text(encoding="utf-8")
    _ast_lint(source)

    args = [sys.executable, str(spath)]
    if demo:
        args += ["--demo"]
    if limit:
        args += ["--limit", str(limit)]

    env = {
        "PATH": os.environ.get("PATH", ""),
        "HOME": "/tmp",
        "SCRAPER_DATA_DIR": str(user_dir(user_id)),
        "PLAYWRIGHT_BROWSERS_PATH": os.environ.get("PLAYWRIGHT_BROWSERS_PATH", ""),
    }

    log_path = scraper_log_path(user_id)

    try:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=settings.SCRAPER_TIMEOUT_SECONDS,
            cwd=str(user_dir(user_id)),
            env=env,
        )
    except subprocess.TimeoutExpired as e:
        raise ScraperError(f"scraper timed out after {settings.SCRAPER_TIMEOUT_SECONDS}s") from e

    with open(log_path, "a", encoding="utf-8") as lf:
        if result.stdout:
            lf.write(result.stdout)
        if result.stderr:
            lf.write(result.stderr)

    if result.returncode != 0:
        raise ScraperError(f"scraper exited {result.returncode}: {result.stderr[:500]}")

    stdout = result.stdout.strip()
    if not stdout:
        log.warning("scraper_empty_output", user_id=uid)
        return []

    # Extract JSON from last line that looks like a JSON array
    for line in reversed(stdout.splitlines()):
        line = line.strip()
        if line.startswith("["):
            try:
                return json.loads(line)
            except json.JSONDecodeError:
                continue

    log.warning("scraper_no_json_found", user_id=uid, stdout_tail=stdout[-300:])
    return []
