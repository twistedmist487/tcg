"""Campaign data loading and run-deck helpers for Conspiracy TCG."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from engine.decks import MAX_COPIES, MAX_DECK_SIZE, expand_deck_entries, load_presets

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
CAMPAIGN_DIR = DATA_DIR / "campaign"

DEFAULT_TRIM = (
    "neutral_char_028",
    "neutral_spell_022",
    "neutral_char_001",
    "illuminati_char_009",
)


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


def starter_deck_ids(starter_deck_id: str) -> list[str]:
    """Expand a named preset into a flat 30-card id list."""
    for preset in load_presets():
        if preset.get("id") == starter_deck_id:
            return expand_deck_entries(preset.get("cards") or [])
    raise KeyError(f"Unknown starter deck: {starter_deck_id}")


def count_copies(deck: list[str], card_id: str) -> int:
    """How many copies of card_id are in the run deck."""
    return sum(1 for item in deck if item == card_id)


def trim_deck(
    deck: list[str],
    size: int = MAX_DECK_SIZE,
    prefer_remove: list[str] | tuple[str, ...] | None = None,
) -> list[str]:
    """Trim a deck down to ``size``, preferring listed ids (last copy first)."""
    out = list(deck)
    prefer = list(prefer_remove) if prefer_remove is not None else list(DEFAULT_TRIM)
    while len(out) > size:
        removed = False
        for card_id in prefer:
            if card_id in out:
                idx = len(out) - 1 - out[::-1].index(card_id)
                out.pop(idx)
                removed = True
                break
        if not removed:
            out.pop()
    return out


def add_card(
    deck: list[str],
    card_id: str,
    copies: int = 1,
    prefer_remove: list[str] | tuple[str, ...] | None = None,
) -> list[str]:
    """Add up to ``copies`` of card_id (max 2), then trim back to 30."""
    out = list(deck)
    for _ in range(max(0, copies)):
        if count_copies(out, card_id) >= MAX_COPIES:
            break
        out.append(card_id)
    return trim_deck(out, MAX_DECK_SIZE, prefer_remove)


def prune_card(deck: list[str], card_id: str) -> list[str]:
    """Remove one copy of card_id if present. May drop below 30."""
    out = list(deck)
    if card_id in out:
        out.remove(card_id)
    return out


def apply_safehouse_pick(deck: list[str], pick: dict[str, Any]) -> tuple[list[str], dict[str, Any]]:
    """Apply a Safe Drop / Armory pick to the run deck.

    Pick actions:
      add / inject — add copies, trim to 30
      prune — remove one copy of prune_id
      skip — no deck change

    Returns (new_deck, flag_updates).
    """
    action = (pick.get("action") or pick.get("op") or "").lower()
    flags: dict[str, Any] = {}
    trim = pick.get("trim") or list(DEFAULT_TRIM)
    label = pick.get("label") or pick.get("id") or "unknown"

    if action in ("add", "inject"):
        card_id = pick.get("id")
        if not card_id:
            raise ValueError("add/inject pick requires id")
        copies = int(pick.get("copies") or 1)
        deck = add_card(deck, card_id, copies, trim)
        flags["last_deck_change"] = f"added:{card_id}"
        flags["last_armory_pick"] = label
    elif action == "prune":
        card_id = pick.get("prune_id") or pick.get("id")
        if not card_id:
            raise ValueError("prune pick requires prune_id or id")
        deck = prune_card(deck, card_id)
        flags["last_deck_change"] = f"pruned:{card_id}"
    elif action == "skip":
        flags["skipped_safe_drop"] = True
        flags["last_deck_change"] = "skipped"
    else:
        raise ValueError(f"Unknown safehouse action: {action!r}")

    if pick.get("skip_reverse_node"):
        flags["skip_reverse_node"] = pick["skip_reverse_node"]

    return deck, flags


def seed_teach_front(deck: list[str], seed_ids: list[str]) -> list[str]:
    """Move (or loan) teach cards to the front of a match copy. Does not persist loans."""
    out = list(deck)
    front: list[str] = []
    for card_id in seed_ids:
        if card_id in out:
            out.remove(card_id)
        front.append(card_id)
    return front + out


def teach_seed_ids(node: dict[str, Any]) -> list[str]:
    """Card ids that should open the hand for a run_teach node."""
    seeds = list(node.get("teach_seed_ids") or [])
    if seeds:
        return seeds
    for step in node.get("steps") or []:
        req = step.get("require") or ""
        if req.startswith("play_named:"):
            # Names are resolved by the client; engine tests pass explicit ids.
            continue
    return seeds


def player_deck_mode(node: dict[str, Any], phase: str = "forward") -> str:
    """scripted | run | run_teach for this node/phase."""
    source = node
    if phase in ("reverse", "boss") and node.get("reverse") and phase != "boss":
        source = {**node, **node["reverse"]}
    mode = source.get("player_deck_mode")
    if mode:
        return str(mode)
    if source.get("player_deck"):
        return "scripted"
    return "run"


def reverse_queue(board: dict[str, Any], flags: dict[str, Any] | None = None) -> list[str]:
    """Board reverse_order with optional skipped node removed."""
    order = list(board.get("reverse_order") or [])
    skip = (flags or {}).get("skip_reverse_node")
    if skip:
        order = [node_id for node_id in order if node_id != skip]
    return order


def campaign_coach(flags: dict[str, Any] | None, board_id: str | None = None) -> str:
    """Who speaks: recruiter (city), silent (escape), ops (HQ / after death)."""
    flags = flags or {}
    if flags.get("recruiter_dead") or board_id == "hq":
        return "ops"
    return "recruiter"
