from __future__ import annotations
from functools import lru_cache
from pathlib import Path

from . import fs


@lru_cache(maxsize=1)
def skill_md() -> str:
    path = fs.skill_dir() / "SKILL.md"
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def reference(name: str) -> str:
    path = fs.skill_dir() / "references" / name
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def list_references() -> list[str]:
    ref_dir = fs.skill_dir() / "references"
    if not ref_dir.exists():
        return []
    return sorted(p.name for p in ref_dir.iterdir() if p.is_file())
