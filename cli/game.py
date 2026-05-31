#!/usr/bin/env python3
"""
CLI game runner for Conspiracy TCG.

Modes:
  [1] Two-player (both human, shared terminal)
  [2] Single-player (vs AI)

Run with: python -m cli.game
"""

from __future__ import annotations

import random
import sys

from engine.ai import AIPlayer, execute_turn
from engine.game import Game
from engine.models import load_cards


def build_deck(card_pool: list, faction: str, size: int = 20) -> list:
    """
    Build a simple deck from the card pool.
    Takes all cards of the chosen faction, then fills remaining slots
    with copies up to 3 per card.
    """
    faction_cards = [c for c in card_pool if c.faction.value == faction]

    if not faction_cards:
        print(f"ERROR: No cards found for faction '{faction}'")
        sys.exit(1)

    deck: list = []
    while len(deck) < size:
        for card in faction_cards:
            if len(deck) >= size:
                break
            # Max 3 copies per card
            copies = deck.count(card)
            if copies < 3:
                deck.append(card)

    # Trim to exact size
    return deck[:size]


def print_separator():
    print("=" * 50)


def print_player_state(player, hide_hand: bool = False):
    """Print a player's current state."""
    print(f"  Life: {player.life}  |  Energy: {player.energy}/{player.max_energy}")
    print(f"  Deck: {player.deck_size}  |  Hand: {player.hand_size}")
    if player.board:
        print("  Board:")
        for i, c in enumerate(player.board):
            status = []
            if c.is_exhausted:
                status.append("EXHAUSTED")
            if c.is_stealth:
                status.append("STEALTH")
            if c.is_silenced:
                status.append("SILENCED")
            status_str = f" [{', '.join(status)}]" if status else ""
            print(
                f"    [{i}] {c.name}  ATK:{c.current_attack} HP:{c.current_health}{status_str}"
            )
    else:
        print("  Board: (empty)")

    if player.location:
        print(f"  Location: {player.location.name}")

    if not hide_hand:
        if player.hand:
            print("  Hand:")
            for i, card in enumerate(player.hand):
                print(f"    [{i}] {card.name} (cost: {card.cost})")
        else:
            print("  Hand: (empty)")


def display_game_state(game: Game, active_player_idx: int):
    """Display the full game state."""
    print_separator()
    print(f"  TURN {game.turn_number} — {game.active_player.name}'s turn")
    print_separator()

    for i, player in enumerate(game.players):
        print(f"\n>>> {player.name} <<<")
        print_player_state(player, hide_hand=(i != active_player_idx))

    # Show state for inactive player (hidden hand)
    if game.active_player_index != active_player_idx:
        pass  # already printed above

    print()


def get_action(game: Game) -> dict:
    """Prompt the current player for an action."""
    player = game.active_player

    while True:
        print(f"\n{player.name}, choose an action:")
        print("  [p] Play a card")
        print("  [a] Attack")
        print("  [s] Show game state")
        print("  [e] End turn")
        print("  [q] Quit")

        choice = input("> ").strip().lower()

        if choice == "p":
            return _handle_play_card(game)
        elif choice == "a":
            return _handle_attack(game)
        elif choice == "s":
            display_game_state(game, game.active_player_index)
        elif choice == "e":
            return {"action": "end_turn"}
        elif choice == "q":
            print("Thanks for playing!")
            sys.exit(0)
        else:
            print("Invalid choice. Try again.")


def _handle_play_card(game: Game) -> dict:
    """Handle the play card action."""
    player = game.active_player

    if not player.hand:
        print("Your hand is empty!")
        return {"action": "none"}

    print("\nYour hand:")
    for i, card in enumerate(player.hand):
        affordable = "✓" if player.can_play_card(card) else "✗"
        print(f"  [{i}] {card.name} (cost: {card.cost}) [{affordable}]")
    print("  [c] Cancel")

    choice = input("Play which card? > ").strip()
    if choice.lower() == "c":
        return {"action": "none"}

    try:
        idx = int(choice)
        result = game.play_card(idx)
    except ValueError:
        print("Invalid input.")
        return {"action": "none"}

    if result.get("success"):
        print(f"Played {result.get('card', 'card')}!")
    else:
        print(f"Cannot play: {result.get('error', 'unknown error')}")

    return {"action": "play", "result": result}


def _handle_attack(game: Game) -> dict:
    """Handle the attack action."""
    player = game.active_player
    opponent = game.inactive_player

    attackable = player.get_attackable_characters()
    if not attackable:
        print("No characters can attack!")
        return {"action": "none"}

    print("\nYour characters:")
    for i, c in enumerate(player.board):
        can = "⚔" if c.can_attack else "  "
        print(f"  {can}[{i}] {c.name} ATK:{c.current_attack} HP:{c.current_health}")

    print("  [c] Cancel")
    choice = input("Attack with? > ").strip()
    if choice.lower() == "c":
        return {"action": "none"}

    try:
        attacker_idx = int(choice)
    except ValueError:
        print("Invalid input.")
        return {"action": "none"}

    # Target selection
    target_idx: int | None = None  # type: ignore[assignment]
    if opponent.board:
        print(f"\n{opponent.name}'s board:")
        for i, c in enumerate(opponent.board):
            print(f"  [{i}] {c.name} ATK:{c.current_attack} HP:{c.current_health}")

        print("  [p] Attack player directly")
        print("  [c] Cancel")
        target_choice = input("Target? > ").strip()
        if target_choice.lower() == "c":
            return {"action": "none"}
        if target_choice.lower() == "p":
            target_idx = None
        else:
            try:
                target_idx = int(target_choice)
            except ValueError:
                print("Invalid input.")
                return {"action": "none"}

    result = game.attack(attacker_idx, target_idx)

    if result.get("success"):
        print(f"{result['attacker']} attacks {result['target']}!")
        print(f"  Dealt {result['damage_dealt']} damage, took {result['damage_taken']} damage")
        if result.get("killed_target"):
            print(f"  {result['target']} was slain!")
        if result.get("killed_attacker"):
            print(f"  {result['attacker']} died!")
        if result.get("winner"):
            print(f"\n*** {result['winner']} WINS! ***")
    else:
        print(f"Cannot attack: {result.get('error', 'unknown error')}")

    return {"action": "attack", "result": result}


def main():
    """Main game loop."""
    print("=" * 50)
    print("  CONSPIRACY TCG")
    print("=" * 50)

    # Choose game mode
    print("\nGame Mode:")
    print("  [1] Two Players (shared terminal)")
    print("  [2] Single Player (vs AI)")
    while True:
        mode = input("\nChoose mode [1/2]: ").strip()
        if mode in ("1", "2"):
            break
        print("Invalid choice. Enter 1 or 2.")

    two_player = mode == "1"

    # Load card pool
    cards = load_cards("data/cards.json")
    factions = ["illuminati", "templars", "reptilians"]

    if two_player:
        # Human vs Human
        print("\nFactions:")
        print("  [1] Illuminati (Influence)")
        print("  [2] Templars (Faith)")
        print("  [3] Reptilians (Psionics)")

        p1_name = input("\nPlayer 1 name: ").strip() or "Player 1"
        p1_faction = _choose_faction("Player 1")
        p2_name = input("Player 2 name: ").strip() or "Player 2"
        p2_faction = _choose_faction("Player 2")

        deck1 = build_deck(cards, p1_faction)
        deck2 = build_deck(cards, p2_faction)

        print(f"\n{p1_name} plays {p1_faction.title()} ({len(deck1)} cards)")
        print(f"{p2_name} plays {p2_faction.title()} ({len(deck2)} cards)")

        game = Game.setup(deck1, deck2, p1_name, p2_name)
        ai_player = None

    else:
        # Human vs AI
        print("\nYour faction:")
        print("  [1] Illuminati (Influence)")
        print("  [2] Templars (Faith)")
        print("  [3] Reptilians (Psionics)")

        human_name = input("\nYour name: ").strip() or "Human"
        human_faction = _choose_faction(human_name)

        # AI picks a random other faction
        ai_factions = [f for f in factions if f != human_faction]
        ai_faction = random.choice(ai_factions)
        ai_name = random.choice(["Overmind", "Admiral Vex", "Agent Smith", "The Architect"])

        # Human is player 1, AI is player 2
        deck1 = build_deck(cards, human_faction)
        deck2 = build_deck(cards, ai_faction)

        ai_player = AIPlayer(name=ai_name, faction=ai_faction, aggression=0.6)

        print(f"\n{human_name} plays {human_faction.title()} ({len(deck1)} cards)")
        print(f"{ai_name} plays {ai_faction.title()} ({len(deck2)} cards)")

        game = Game.setup(deck1, deck2, human_name, ai_name)

    print(f"\n{game.active_player.name} goes first!")
    input("Press Enter to start...")

    # Main game loop
    while not game.is_over:
        # Start turn
        turn_info = game.start_turn()
        print(f"\n{'*' * 50}")
        print(f"  {game.active_player.name}'s turn — Energy: {turn_info['energy']}")
        if turn_info["drew"]:
            print(f"  Drew: {turn_info['drew']}")
        print(f"{'*' * 50}")

        display_game_state(game, game.active_player_index)

        # Check if it's the AI's turn
        is_ai_turn = (ai_player is not None and
                      game.active_player.name == ai_player.name)

        if is_ai_turn:
            # AI turn
            input("\nPress Enter to see AI's move...")
            action_results = execute_turn(game, ai_player)
            for action_result in action_results:
                ar = action_result.get("result", {})
                if action_result["action"] == "play" and ar.get("success"):
                    print(f"  AI plays: {ar.get('card', '?')}")
                elif action_result["action"] == "attack" and ar.get("success"):
                    print(f"  AI attacks: {ar['attacker']} -> {ar['target']}")
                    print(f"    Dealt {ar['damage_dealt']}, took {ar['damage_taken']}")
                    if ar.get("killed_target"):
                        print(f"    {ar['target']} was slain!")
                    if ar.get("killed_attacker"):
                        print(f"    {ar['attacker']} died!")
                elif action_result["action"] == "end_turn":
                    print(f"  AI ends turn.")
        else:
            # Human turn
            while True:
                if game.is_over:
                    break

                action = get_action(game)

                if action["action"] == "end_turn":
                    game.end_turn()
                    break

                # Show updated state after playing a card or attacking
                if action["action"] in ("play", "attack"):
                    display_game_state(game, game.active_player_index)

    # Game over
    if game.winner:
        print(f"\n{'=' * 50}")
        print(f"  {game.winner} WINS!")
        print(f"{'=' * 50}")

    print(f"\nTotal turns: {game.turn_number}")
    print(f"Total actions: {len(game.history)}")
    print("Thanks for playing!")


def _choose_faction(player_name: str) -> str:
    """Prompt for faction selection."""
    while True:
        choice = input(f"{player_name} — choose faction [1/2/3]: ").strip()
        if choice == "1":
            return "illuminati"
        elif choice == "2":
            return "templars"
        elif choice == "3":
            return "reptilians"
        else:
            print("Invalid choice. Enter 1, 2, or 3.")


if __name__ == "__main__":
    main()
