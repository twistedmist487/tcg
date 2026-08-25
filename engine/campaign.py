"""Campaign data loading for Conspiracy TCG single-player chapters."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CAMPAIGN_DIR = DATA_DIR / "campaign"


def load_campaign_index(path: str | Path | None = None) -> dict[str, Any]:
    """Load campaign index.json."""
    target = Path(path) if path else CAMPAIGN_DIR / "index.json"
    with target.open(encoding="utf-8") as handle:
        return json.load(handle)


def load_chapter(chapter_id: str, base: str | Path | None = None) -> dict[str, Any]:
    """Load a chapter folder (chapter.json + boards)."""
    root = Path(base) if base else CAMPAIGN_DIR
    chapter_path = root / chapter_id / "chapter.json"
    with chapter_path.open(encoding="utf-8") as handle:
        chapter = json.load(handle)
    boards: dict[str, Any] = {}
    for board_id in chapter.get("boards", []):
        board_file = root / chapter_id / f"board_{board_id}.json"
        if not board_file.exists():
            board_file = root / chapter_id / f"{board_id}.json"
        with board_file.open(encoding="utf-8") as handle:
            boards[board_id] = json.load(handle)
    chapter["board_data"] = boards
    return chapter


def get_node(chapter: dict[str, Any], board_id: str, node_id: str) -> dict[str, Any]:
    """Return one node from a loaded chapter."""
    boards = chapter.get("board_data") or {}
    board = boards.get(board_id)
    if not board:
        raise KeyError(f"Unknown board: {board_id}")
    for node in board.get("nodes", []):
        if node.get("id") == node_id:
            return node
    raise KeyError(f"Unknown node: {node_id}")


def list_campaign_summaries() -> list[dict[str, Any]]:
    """Lightweight chapter list for the API/menu."""
    index = load_campaign_index()
    out = []
    for entry in index.get("chapters", []):
        out.append(
            {
                "id": entry["id"],
                "name": entry.get("name"),
                "description": entry.get("description"),
                "faction": entry.get("faction"),
                "status": entry.get("status", "available"),
            }
        )
    return out
