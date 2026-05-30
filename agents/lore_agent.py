import os

from agents.base_agent import BaseAgent


class LoreAgent(BaseAgent):
    def __init__(self, data_directory="data/", docs_directory="docs/"):
        super().__init__("LoreAgent", data_directory)
        self.docs_directory = docs_directory
        self.lore_data = self._load_lore_data()

    def _load_lore_data(self):
        """Loads lore data from factions.md."""
        lore_path = os.path.join(self.docs_directory, "factions.md")
        lore_content = {}
        if os.path.exists(lore_path):
            with open(lore_path) as f:
                current_faction = None
                for line in f:
                    line = line.strip()
                    if line.startswith("## "):
                        current_faction = line[3:].strip().lower().replace(" ", "_")
                        lore_content[current_faction] = {"lore": "", "philosophy": "", "key_mechanics": []}
                    elif current_faction:
                        if line.startswith("*   **Lore:**"):
                            lore_content[current_faction]["lore"] = line.split(":", 1)[1].strip()
                        elif line.startswith("*   **Philosophy:**"):
                            lore_content[current_faction]["philosophy"] = line.split(":", 1)[1].strip()
                        elif line.startswith("*   **Key Mechanics:**"):
                            # Read subsequent lines until next section or end of file
                            mechanics = []
                            next_line = f.readline().strip()
                            while next_line and not next_line.startswith("*   **"):
                                if next_line.startswith("*   "):
                                    mechanics.append(next_line[4:].strip())
                                next_line = f.readline().strip()
                            lore_content[current_faction]["key_mechanics"] = mechanics
        return lore_content

    def generate_lore_for_card(self, card_name, faction_name):
        """Generates lore for a card based on its faction."""
        faction_key = faction_name.lower().replace(" ", "_")
        faction_lore = self.lore_data.get(faction_key, {})

        base_lore = faction_lore.get("lore", "A mysterious entity.")
        philosophy = faction_lore.get("philosophy", "Unknown motives.")
        mechanics = faction_lore.get("key_mechanics", ["Unknown abilities."])

        # Simple template-based lore generation
        generated_lore = f"The {card_name} is a figure shrouded in secrecy, operating under the philosophy of '{philosophy}'. "
        generated_lore += f"Its very existence is tied to the {faction_name}'s goal of {base_lore.lower()}. "
        generated_lore += f"Known for its {mechanics[0].lower()}, it plays a crucial role in the grand scheme."

        return generated_lore

    def suggest_new_lore_element(self, faction_name):
        """Suggests a new lore element for a faction."""
        faction_key = faction_name.lower().replace(" ", "_")
        faction_lore = self.lore_data.get(faction_key, {})

        # Placeholder for more sophisticated lore generation
        return f"A new hidden chapter in the history of the {faction_name}, revealing their involvement in a forgotten historical event."

    def run(self):
        """Main execution loop for the LoreAgent."""
        print(f"[{self.name}] Running...")
        # Example: Generate lore for a new card concept
        new_card_name = "Enigmatic Oracle"
        new_card_faction = "Illuminati"
        generated_lore = self.generate_lore_for_card(new_card_name, new_card_faction)
        print(f"[{self.name}] Generated lore for '{new_card_name}': {generated_lore}")

        # Suggest new lore element
        suggested_lore = self.suggest_new_lore_element("Templars")
        print(f"[{self.name}] Suggested new lore for Templars: {suggested_lore}")
        print(f"[{self.name}] Lore processing complete.")

if __name__ == "__main__":
    lore_agent = LoreAgent()
    lore_agent.run()
