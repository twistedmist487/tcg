import json
import os

class BaseAgent:
    def __init__(self, name, data_directory="data/"):
        self.name = name
        self.data_directory = data_directory
        self.cards_data = []
        self.factions_data = {}
        self.locations_data = []
        self._load_data()

    def _load_data(self):
        """Loads all necessary data from the data directory."""
        cards_path = os.path.join(self.data_directory, "cards.json")
        factions_path = os.path.join(self.data_directory, "factions.json")
        locations_path = os.path.join(self.data_directory, "locations.json")

        if os.path.exists(cards_path):
            with open(cards_path, 'r') as f:
                self.cards_data = json.load(f)
        
        if os.path.exists(factions_path):
            with open(factions_path, 'r') as f:
                self.factions_data = json.load(f)
        
        if os.path.exists(locations_path):
            with open(locations_path, 'r') as f:
                self.locations_data = json.load(f)

    def _save_data(self, filename, data):
        """Saves data to a JSON file in the data directory."""
        filepath = os.path.join(self.data_directory, filename)
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"[{self.name}] Saved data to {filepath}")

    def save_cards(self):
        """Saves the current state of cards_data to cards.json."""
        self._save_data("cards.json", self.cards_data)

    def save_factions(self):
        """Saves the current state of factions_data to factions.json."""
        self._save_data("factions.json", self.factions_data)

    def save_locations(self):
        """Saves the current state of locations_data to locations.json."""
        self._save_data("locations.json", self.locations_data)

    def get_cards_by_faction(self, faction_name):
        """Returns a list of cards belonging to a specific faction."""
        return [card for card in self.cards_data if card.get("faction") == faction_name]

    def get_card_by_id(self, card_id):
        """Returns a card by its ID."""
        for card in self.cards_data:
            if card.get("id") == card_id:
                return card
        return None

    def add_card(self, card):
        """Adds a new card to the collection."""
        if not card.get("id"):
            raise ValueError("Card must have an ID.")
        if self.get_card_by_id(card["id"]):
            raise ValueError(f"Card with ID {card['id']} already exists.")
        self.cards_data.append(card)
        print(f"[{self.name}] Added new card: {card['name']}")

    def update_card(self, card_id, updates):
        """Updates an existing card."""
        for i, card in enumerate(self.cards_data):
            if card.get("id") == card_id:
                self.cards_data[i].update(updates)
                print(f"[{self.name}] Updated card: {card_id}")
                return
        print(f"[{self.name}] Card with ID {card_id} not found for update.")

    def remove_card(self, card_id):
        """Removes a card from the collection."""
        initial_count = len(self.cards_data)
        self.cards_data = [card for card in self.cards_data if card.get("id") != card_id]
        if len(self.cards_data) < initial_count:
            print(f"[{self.name}] Removed card: {card_id}")
        else:
            print(f"[{self.name}] Card with ID {card_id} not found for removal.")

    def generate_lore_for_card(self, card_name, faction_name):
        """Placeholder for lore generation. To be overridden by specific agents."""
        return f"A mysterious {card_name} from the {faction_name} faction."

    def evaluate_card_balance(self, card):
        """Placeholder for balance evaluation. To be overridden by specific agents."""
        return {"is_balanced": True, "comments": "No specific balance rules applied yet."}

    def run(self):
        """Main execution loop for the agent. To be overridden by specific agents."""
        print(f"[{self.name}] Running...")
        # Example: Load data, perform actions, save data
        pass