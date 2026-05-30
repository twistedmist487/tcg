import json
import os
from agents.base_agent import BaseAgent

class RulesAgent(BaseAgent):
    def __init__(self, data_directory="data/", rules_docs_directory="docs/"):
        super().__init__("RulesAgent", data_directory)
        self.rules_docs_directory = rules_docs_directory
        self.rules_data = self._load_rules_data()

    def _load_rules_data(self):
        """Loads core rules data from rules_draft.md."""
        rules_path = os.path.join(self.rules_docs_directory, "rules_draft.md")
        rules_content = {}
        if os.path.exists(rules_path):
            with open(rules_path, 'r') as f:
                current_section = None
                for line in f:
                    line = line.strip()
                    if line.startswith("## "):
                        current_section = line[3:].strip().lower().replace(" ", "_")
                        rules_content[current_section] = []
                    elif current_section:
                        rules_content[current_section].append(line)
        return rules_content

    def evaluate_card_balance(self, card):
        """Evaluates the balance of a card based on its stats and cost."""
        balance_report = {"is_balanced": True, "comments": []}

        if card.get("type") == "Character":
            cost = card.get("cost", 0)
            attack = card.get("attack", 0)
            health = card.get("health", 0)
            total_stats = attack + health

            # Simple heuristic: Total stats should be roughly cost + 1
            if total_stats < cost:
                balance_report["is_balanced"] = False
                balance_report["comments"].append(f"Undercosted: Total stats ({total_stats}) are less than cost ({cost}).")
            elif total_stats > cost + 2: # Allow some flexibility for powerful abilities
                balance_report["is_balanced"] = False
                balance_report["comments"].append(f"Overcosted: Total stats ({total_stats}) are significantly higher than cost ({cost}).")
            
            # Check for very high attack or health for cost
            if attack > cost + 1:
                balance_report["comments"].append(f"High Attack ({attack}) for cost ({cost}).")
            if health > cost + 2:
                balance_report["comments"].append(f"High Health ({health}) for cost ({cost}).")

        elif card.get("type") == "Spell":
            cost = card.get("cost", 0)
            effect = card.get("effect", "")
            # Simple heuristic: Direct damage spells should have cost roughly equal to damage
            if "Deal" in effect and "damage" in effect:
                try:
                    damage_str = effect.split("Deal ")[1].split(" damage")[0]
                    damage = int(damage_str)
                    if damage > cost + 1:
                        balance_report["is_balanced"] = False
                        balance_report["comments"].append(f"High damage ({damage}) for cost ({cost}).")
                    elif damage < cost - 1:
                        balance_report["is_balanced"] = False
                        balance_report["comments"].append(f"Low damage ({damage}) for cost ({cost}).")
                except (ValueError, IndexError):
                    balance_report["comments"].append("Could not parse damage from spell effect.")

        elif card.get("type") == "Location":
            cost = card.get("cost", 0)
            effect = card.get("effect", "")
            # Locitions are harder to balance generally, but high impact effects should have higher cost
            if "gain +" in effect or "heal" in effect:
                if cost < 3:
                    balance_report["comments"].append(f"Potentially low cost ({cost}) for a persistent effect.")

        if not balance_report["comments"]:
            balance_report["comments"].append("Appears balanced based on simple heuristics.")

        return balance_report

    def suggest_card_adjustment(self, card):
        """Suggests adjustments to a card if it's deemed unbalanced."""
        balance_report = self.evaluate_card_balance(card)
        suggestions = []

        if not balance_report["is_balanced"]:
            if card.get("type") == "Character":
                cost = card.get("cost", 0)
                attack = card.get("attack", 0)
                health = card.get("health", 0)
                total_stats = attack + health

                if total_stats < cost:
                    suggestions.append(f"Consider increasing Attack or Health to bring total stats closer to {cost + 1}.")
                elif total_stats > cost + 2:
                    suggestions.append(f"Consider reducing Attack or Health to bring total stats closer to {cost + 1}.")
                
                if "High Attack" in " ".join(balance_report["comments"]):
                    suggestions.append(f"Consider reducing Attack by 1.")
                if "High Health" in " ".join(balance_report["comments"]):
                    suggestions.append(f"Consider reducing Health by 1.")

            elif card.get("type") == "Spell":
                if "High damage" in " ".join(balance_report["comments"]):
                    suggestions.append(f"Consider reducing damage or increasing cost.")
                elif "Low damage" in " ".join(balance_report["comments"]):
                    suggestions.append(f"Consider increasing damage or decreasing cost.")

            elif card.get("type") == "Location":
                if "Potentially low cost" in " ".join(balance_report["comments"]):
                    suggestions.append(f"Consider increasing cost by 1 or 2.")

        return suggestions

    def run(self):
        """Main execution loop for the RulesAgent."""
        print(f"[{self.name}] Running...")
        # Example: Evaluate balance of all current cards
        for card in self.cards_data:
            print(f"\n[{self.name}] Evaluating balance for: {card['name']}")
            balance_report = self.evaluate_card_balance(card)
            print(f"  Balanced: {balance_report['is_balanced']}")
            print(f"  Comments: {', '.join(balance_report['comments'])}")
            if not balance_report["is_balanced"]:
                suggestions = self.suggest_card_adjustment(card)
                if suggestions:
                    print(f"  Suggestions: {'; '.join(suggestions)}")
        print(f"[{self.name}] Balance evaluation complete.")

if __name__ == "__main__":
    rules_agent = RulesAgent()
    rules_agent.run()