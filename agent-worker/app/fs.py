from __future__ import annotations
import json
from pathlib import Path
from uuid import UUID

from .config import settings


def user_dir(user_id: UUID) -> Path:
    d = Path(settings.USERS_DATAS_DIR) / str(user_id)
    d.mkdir(parents=True, exist_ok=True)
    (d / "outputs").mkdir(exist_ok=True)
    return d


def economic_run_dir(user_id: UUID, run_id: str) -> Path:
    d = user_dir(user_id) / "economic_runs" / run_id
    (d / "inputs").mkdir(parents=True, exist_ok=True)
    (d / "logs").mkdir(parents=True, exist_ok=True)
    (d / "outputs").mkdir(parents=True, exist_ok=True)
    return d


def skill_dir() -> Path:
    return Path(settings.SKILL_DIR)


def read_text(path: Path) -> str:
    if not path.exists():
        return ""
    return path.read_text(encoding="utf-8")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def read_json(path: Path) -> dict:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: dict) -> None:
    write_text(path, json.dumps(data, indent=2, ensure_ascii=False))


def user_profile_blob(user_id: UUID) -> str:
    d = user_dir(user_id)
    parts = []
    for name in ("FACTS.md", "BULLET_LIBRARY.md", "preset.md"):
        content = read_text(d / name)
        if content:
            parts.append(f"# {name}\n\n{content}")
    return "\n\n---\n\n".join(parts)


def append_chat_log(user_id: UUID, role: str, content: str) -> None:
    path = user_dir(user_id) / "chat_log.md"
    with path.open("a", encoding="utf-8") as f:
        f.write(f"\n\n## {role}\n\n{content}\n")
