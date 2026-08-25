"""
Single-player agent team orchestrator CLI.

Does not call LLMs. Prints role briefs, board status, acceptance gates, and
runs local validate/test hooks so Hermes (or a human) can drive specialists.

Usage:
  python -m agents.orchestrator status
  python -m agents.orchestrator roles
  python -m agents.orchestrator plan [--stream qol|journey|...]
  python -m agents.orchestrator brief <role>
  python -m agents.orchestrator run --role frontend --task "Keyboard shortcuts"
  python -m agents.orchestrator set-status keyboard in_progress
  python -m agents.orchestrator checklist
  python -m agents.orchestrator gates
  python -m agents.orchestrator test
  python -m agents.orchestrator validate
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from agents.board import (
    BOARD_PATH,
    PLAN_PATH,
    ROOT,
    iter_items,
    list_roles,
    load_board,
    role_brief,
    save_board,
    set_item_status,
    summarize,
)

STREAM_ALIASES = {
    "qol": "qol_parallel",
    "qol_parallel": "qol_parallel",
    "frontend": "frontend_campaign",
    "frontend_campaign": "frontend_campaign",
    "journey": "design",
    "experience": "design",
    "design": "design",
    "encounters": "campaign_data",
    "encounter": "campaign_data",
    "campaign_data": "campaign_data",
    "campaign": "campaign_data",
    "balance": "engine_hooks",
    "engine": "engine_hooks",
    "engine_hooks": "engine_hooks",
    "content": "content_archetypes",
    "content_archetypes": "content_archetypes",
    "archetypes": "content_archetypes",
    "qa": "qa",
}

ROLE_TO_STREAM = {
    "experience": "design",
    "encounter": "campaign_data",
    "balance": "engine_hooks",
    "content": "content_archetypes",
    "frontend": "frontend_campaign",
    "qa": "qa",
    "orchestrator": "design",
}


def cmd_status(_: argparse.Namespace) -> int:
    board = load_board()
    counts = summarize(board)
    print(f"Initiative: {board.get('initiative')}")
    print(f"North star: {board.get('north_star')}")
    print(f"Board: {BOARD_PATH}")
    print(
        f"Items: {counts['done']} done | {counts['in_progress']} in_progress | "
        f"{counts['pending']} pending | {counts['blocked']} blocked"
    )
    print()
    for stream_id, stream in board.get("workstreams", {}).items():
        owner = stream.get("owner", "?")
        print(f"[{stream.get('status', 'pending')}] {stream_id} (owner={owner})")
        for item in stream.get("items", []):
            pri = f" p{item['priority']}" if "priority" in item else ""
            print(f"  - ({item.get('status')}) {item.get('id')}{pri}: {item.get('title')}")
    notes = board.get("notes") or []
    if notes:
        print("\nNotes:")
        for n in notes:
            print(f"  • {n}")
    brief = ROOT / board.get("notebook_brief_path", "docs/plans/notebook-sp-brief.md")
    if brief.exists():
        text = brief.read_text(encoding="utf-8")
        filled = any(
            line.strip() and not line.strip().startswith("#") and line.strip() != "-"
            for line in text.splitlines()
            if not line.startswith("Source") and not line.startswith("http")
            and "Hermes could not" not in line
            and "Paste the parts" not in line
        )
        # crude: any non-placeholder bullet content under sections
        has_content = any(
            line.startswith("- ") and len(line.strip()) > 2
            for line in text.splitlines()
        )
        print(
            f"\nNotebook brief: {brief} "
            f"({'has bullets' if has_content else 'EMPTY — paste NotebookLM notes'})"
        )
    print(f"\nPlan: {PLAN_PATH}")
    return 0


def cmd_roles(_: argparse.Namespace) -> int:
    for name in list_roles():
        print(name)
    return 0


def cmd_plan(args: argparse.Namespace) -> int:
    board = load_board()
    streams = board.get("workstreams", {})
    if args.stream:
        key = STREAM_ALIASES.get(args.stream.lower(), args.stream.lower())
        if key not in streams:
            print(f"Unknown stream {args.stream!r}. Choose from: {', '.join(streams)}")
            return 1
        selected = {key: streams[key]}
    else:
        selected = streams

    print("# Recommended next slices\n")
    print("Pick ONE. Orchestrator merges; avoid two writers on the same file.\n")
    for stream_id, stream in selected.items():
        pending = [
            i
            for i in stream.get("items", [])
            if i.get("status") not in ("done", "completed")
        ]
        if not pending:
            print(f"## {stream_id}: clear\n")
            continue
        pending.sort(key=lambda i: i.get("priority", 99))
        nxt = pending[0]
        print(f"## {stream_id} → assign `{stream.get('owner')}`")
        print(f"- Next: `{nxt.get('id')}` — {nxt.get('title')}")
        print(f"- Status: {nxt.get('status')}")
        print(f"- Brief: python -m agents.orchestrator brief {stream.get('owner')}")
        print()
    print("Acceptance gates: python -m agents.orchestrator gates")
    return 0


def cmd_brief(args: argparse.Namespace) -> int:
    try:
        text = role_brief(args.role)
    except FileNotFoundError as exc:
        print(exc)
        return 1
    print(text)
    stream = ROLE_TO_STREAM.get(args.role)
    if stream:
        board = load_board()
        ws = board.get("workstreams", {}).get(stream, {})
        print("\n---\n## Open board items for this role\n")
        for item in ws.get("items", []):
            if item.get("status") in ("done", "completed"):
                continue
            print(f"- [{item.get('status')}] {item.get('id')}: {item.get('title')}")
    return 0


def cmd_run(args: argparse.Namespace) -> int:
    """Print a self-contained mission packet for a specialist (or Hermes child)."""
    try:
        brief = role_brief(args.role)
    except FileNotFoundError as exc:
        print(exc)
        return 1

    board = load_board()
    print("=" * 72)
    print("SP AGENT MISSION PACKET")
    print("=" * 72)
    print(f"Role: {args.role}")
    print(f"Task: {args.task}")
    print(f"Repo: {ROOT}")
    print(f"Constraints: {', '.join(board.get('hard_constraints', []))}")
    print()
    print(brief)
    print()
    print("---")
    print("## Orchestrator instructions")
    print(f"1. Complete only: {args.task}")
    print("2. Do not expand into multiplayer or unrelated refactors.")
    print("3. Touch the minimum files; match AGENTS.md conventions.")
    print("4. Run relevant tests; report files changed + how to verify.")
    print("5. If blocked, stop with a concrete question — do not invent scope.")
    if args.mark:
        item = set_item_status(board, args.mark, "in_progress")
        if item:
            save_board(board)
            print(f"\nBoard: marked `{args.mark}` in_progress")
        else:
            print(f"\nWarning: board item id {args.mark!r} not found", file=sys.stderr)
    print("=" * 72)
    return 0


def cmd_set_status(args: argparse.Namespace) -> int:
    board = load_board()
    item = set_item_status(board, args.item_id, args.status)
    if not item:
        print(f"Unknown item id {args.item_id!r}")
        print("Known ids:")
        for _, _, it in iter_items(board):
            print(f"  {it.get('id')}")
        return 1
    save_board(board)
    print(f"Updated {args.item_id} → {args.status}")
    return 0


def cmd_checklist(_: argparse.Namespace) -> int:
    board = load_board()
    total = 0
    done = 0
    for stream_id, _, item in iter_items(board):
        total += 1
        status = item.get("status")
        mark = "x" if status in ("done", "completed") else " "
        if mark == "x":
            done += 1
        print(f"- [{mark}] ({stream_id}/{item.get('id')}) {item.get('title')}")
    print(f"\n{done}/{total} complete")
    return 0


def cmd_gates(_: argparse.Namespace) -> int:
    print(
        """Acceptance gates (every slice)

1. Scope: no multiplayer, accounts, or WebSockets.
2. Engine purity: engine/ stays UI-free.
3. Data: make validate if cards/encounters/decks changed.
4. Tests: make test green; new logic has tests.
5. Play: human or browser script hits the happy path once.
6. Docs: update roadmap / board status when surface area changes.

Commands:
  python -m agents.orchestrator validate
  python -m agents.orchestrator test
"""
    )
    return 0


def _run_make(target: str) -> int:
    # Prefer make; fall back to documented commands if make missing.
    try:
        proc = subprocess.run(
            ["make", target],
            cwd=ROOT,
            check=False,
        )
        return proc.returncode
    except FileNotFoundError:
        if target == "test":
            cmd = [sys.executable, "-m", "pytest", "tests/", "-q"]
        elif target == "validate":
            cmd = [sys.executable, "tools/validate_cards.py"]
        else:
            print(f"make not found and no fallback for {target}")
            return 1
        proc = subprocess.run(cmd, cwd=ROOT, check=False)
        return proc.returncode


def cmd_test(_: argparse.Namespace) -> int:
    return _run_make("test")


def cmd_validate(_: argparse.Namespace) -> int:
    return _run_make("validate")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="python -m agents.orchestrator",
        description="Conspiracy TCG single-player agent team orchestrator",
    )
    sub = p.add_subparsers(dest="command", required=True)

    sub.add_parser("status", help="Show board and north star").set_defaults(
        func=cmd_status
    )
    sub.add_parser("roles", help="List role briefs").set_defaults(func=cmd_roles)
    sub.add_parser("checklist", help="Markdown checklist of all items").set_defaults(
        func=cmd_checklist
    )
    sub.add_parser("gates", help="Print acceptance gates").set_defaults(func=cmd_gates)
    sub.add_parser("test", help="Run test suite").set_defaults(func=cmd_test)
    sub.add_parser("validate", help="Validate card data").set_defaults(
        func=cmd_validate
    )

    plan = sub.add_parser("plan", help="Suggest next slice(s)")
    plan.add_argument(
        "--stream",
        help="Limit to one workstream (qol, journey, encounters, balance, content, qa)",
    )
    plan.set_defaults(func=cmd_plan)

    brief = sub.add_parser("brief", help="Print a role markdown brief + open items")
    brief.add_argument("role", help="Role id (frontend, experience, ...)")
    brief.set_defaults(func=cmd_brief)

    run = sub.add_parser(
        "run",
        help="Emit a mission packet for a specialist / Hermes child",
    )
    run.add_argument("--role", required=True, help="Specialist role id")
    run.add_argument("--task", required=True, help="Single concrete task")
    run.add_argument(
        "--mark",
        help="Optional board item id to set in_progress",
    )
    run.set_defaults(func=cmd_run)

    st = sub.add_parser("set-status", help="Update a board item status")
    st.add_argument("item_id")
    st.add_argument(
        "status",
        choices=["pending", "in_progress", "done", "blocked", "completed"],
    )
    st.set_defaults(func=cmd_set_status)

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())
