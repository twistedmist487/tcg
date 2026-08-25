"""Load/save the single-player agent team board."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
BOARD_PATH = ROOT / "docs" / "plans" / "sp-agent-board.json"
ROLES_DIR = Path(__file__).resolve().parent / "roles"
PLAN_PATH = ROOT / "docs" / "plans" / "phase9-sp-agent-team.md"


def load_board(path: Path | None = None) -> dict[str, Any]:
    """Load the SP agent board JSON."""
    target = path or BOARD_PATH
    with target.open(encoding="utf-8") as f:
        return json.load(f)


def save_board(board: dict[str, Any], path: Path | None = None) -> Path:
    """Persist board JSON with stable formatting."""
    target = path or BOARD_PATH
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", encoding="utf-8") as f:
        json.dump(board, f, indent=2)
        f.write("\n")
    return target


def iter_items(board: dict[str, Any]):
    """Yield (stream_id, stream, item) for every checklist item."""
    for stream_id, stream in board.get("workstreams", {}).items():
        for item in stream.get("items", []):
            yield stream_id, stream, item


def summarize(board: dict[str, Any]) -> dict[str, int]:
    """Count item statuses across all workstreams."""
    counts = {"pending": 0, "in_progress": 0, "done": 0, "blocked": 0, "other": 0}
    for _, _, item in iter_items(board):
        status = (item.get("status") or "pending").lower()
        if status in ("done", "completed"):
            counts["done"] += 1
        elif status in counts:
            counts[status] += 1
        else:
            counts["other"] += 1
    return counts


def set_item_status(
    board: dict[str, Any], item_id: str, status: str
) -> dict[str, Any] | None:
    """Update one item by id. Returns the item or None if missing."""
    for _, stream, item in iter_items(board):
        if item.get("id") == item_id:
            item["status"] = status
            # Refresh stream status heuristically
            statuses = {i.get("status") for i in stream.get("items", [])}
            if statuses and statuses <= {"done", "completed"}:
                stream["status"] = "done"
            elif "in_progress" in statuses:
                stream["status"] = "in_progress"
            elif "blocked" in statuses:
                stream["status"] = "blocked"
            else:
                stream["status"] = "pending"
            return item
    return None


def role_brief(role: str) -> str:
    """Return markdown brief for a role name."""
    path = ROLES_DIR / f"{role}.md"
    if not path.exists():
        known = sorted(p.stem for p in ROLES_DIR.glob("*.md"))
        raise FileNotFoundError(
            f"Unknown role {role!r}. Known roles: {', '.join(known)}"
        )
    return path.read_text(encoding="utf-8")


def list_roles() -> list[str]:
    """Role ids from agents/roles/*.md."""
    return sorted(p.stem for p in ROLES_DIR.glob("*.md"))
