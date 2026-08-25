Conspiracy TCG: Strategic AI Card Game Repository
7 sources
·
Aug 21, 2026
These sources collectively explore the historical development and technical architecture of single-player modes in the digital card game Hearthstone. Early content utilized a linear adventure structure based on World of Warcraft lore, but the game eventually transitioned toward roguelike systems such as Dungeon Run and The Dalaran Heist to enhance variety. These newer modes emphasize high replayability and player agency by allowing users to build and refine decks through successive boss encounters. Beyond design analysis, the texts include a technical repository for a conspiracy-themed card game project inspired by these mechanics. This project demonstrates how AI agents and FastAPI servers can be used to simulate strategic gameplay and manage complex card interactions. Together, the materials provide a comprehensive look at how iterative game design and artificial intelligence shape modern digital tabletop experiences.

Saturday, August 22
Can you give me 2 to 3 lore and faction friendly control decks of varying playstyles for each faction I can add to the card list. They should be supplemented mainly by faction specific cards with a few network cards so they feel unique

Drawing on the strategic archetypes of control decks and the specific lore of the three factions, here are two to three control-oriented deck concepts for each faction. These decks focus on reaching the late game by using removal, board stabilization, and faction-unique energy mechanics
.
The Illuminati: Influence & Manipulation
The Illuminati excel at controlling the board through "Influence," effectively turning an opponent’s strength against them or neutralizing threats before they can act
.
"The Shadow Mandate" (Attrition/Fatigue Control)
Playstyle: Focuses on survival and resource depletion. This deck uses heavy removal spells and board-clearing effects to stall until the opponent runs out of cards (deck out)
.
Faction Core: Cards that sap "Influence" or force the opponent to discard.
Network Supplement: Includes Archive cards for card draw to maintain an advantage and Encrypted Link to protect your life total while the opponent's deck thins
.
"Puppet Master’s Gambit" (Mind Control/Late-Game Value)
Playstyle: Uses early-game neutralization to survive until they can play high-cost characters that permanently seize control of enemy units
.
Faction Core: High-cost Influence characters with powerful "Battlecry"-style effects that flip board state
.
Network Supplement: Satellite Uplink cards to scout the opponent's hand, ensuring you use your control spells at the optimal moment
.
The Templars: Defense & Resilience
Templar control relies on "Faith" to build impenetrable walls and sustain through damage, forcing the opponent to exhaust their resources against high-health defenders
.
"The Iron Cathedral" (Taunt & Wall Control)
Playstyle: Employs a steady flow of "Taunt" minions to force unfavorable trades and prevent damage to the player
.
Faction Core: High-health Faith defenders and armor-gain spells (similar to the "Armor Up!" mechanic)
.
Network Supplement: Logistics Hub locations to provide consistent healing or stat buffs to your defenders, making them even harder to remove
.
"Divine Retribution" (Reactive/Board Wipe Control)
Playstyle: A "stalling" deck that invites the opponent to over-extend their board, only to clear it with massive area-of-effect (AoE) spells
.
Faction Core: Spells that deal damage based on the number of enemy characters or restore health to the player when a friendly character is lost.
Network Supplement: Global Surveillance (Network) to identify high-threat targets and Backup Generators to ensure you have enough energy for a turn-10 board clear
.
The Reptilians: Disruption & Stealth
Reptilian control uses "Psionics" to disrupt the opponent's rhythm, utilizing "Stealth" to keep their own win conditions safe until they are ready to strike
.
"Neural Static" (Disruption/Freeze-Style Control)
Playstyle: Similar to a "Freeze" deck, this focuses on disabling enemy characters or increasing their energy costs so they cannot be played efficiently
.
Faction Core: Psionic cards that "Exhaust" or "Silence" enemies, preventing them from attacking or using abilities
.
Network Supplement: Dark Web Nodes to generate random disruption spells, keeping the opponent off-balance and unable to develop a coherent strategy
.
"The Ancient Hive" (Stealth-Combo Control)
Playstyle: Stalls the early game with disruption while hiding powerful late-game finishers in "Stealth"
. Once enough energy is gathered, it unleashes high burst damage to finish the opponent
.
Faction Core: Characters with "Stealth" and high attack values that only reveal themselves for the killing blow.
Network Supplement: Underground Bunker (Network Location) to provide an extra layer of protection for your stealthed units or to lower their casting cost
.
Create a set of new cards that will be the base of a control deck. 2 to 3 for each faction.


Example. Characters/spells/1 location for an illuminati deck that focuses on forcing opponent discards, while copying or adding cards to player deck.


And another that uses characters/spells/1 location that focuses on buffing player field units, or debuffing enemy units.

Based on the established lore of the three factions and the fundamental principles of control decks—which focus on early-game removal, Taunts, and powerful late-game finishers—here are new card sets designed to form the base of these archetypes
.
The Illuminati: "The Memory Thief" Archetype
This set focuses on Influence energy to manipulate the opponent's resources through forced discards and deck-thinning, while building your own card advantage
.
Grand Archivist (Character)
Cost: 5 Energy | Stats: 4/6
Effect: Battlecry: Your opponent discards a random card. Add a copy of that card to your deck.
Cognitive Breach (Spell)
Cost: 3 Energy
Effect: Look at 3 cards in your opponent's deck. Choose one to add to your hand and discard the others.
The Memory Vault (Location)
Cost: 4 Energy
Effect: Whenever your opponent discards a card, add a "Fragmented Thought" (1-cost spell: Draw a card) to your hand.
The Templars: "The Shield of Order" Archetype
Templar control utilizes Faith energy to stabilize the board through Taunts and stat manipulation, turning the field into an impenetrable fortress
.
Guardian of the Seal (Character)
Cost: 4 Energy | Stats: 3/8
Effect: Taunt. Any enemy character that attacks this unit is Silenced and has its Attack reduced by 2 permanently
.
Righteous Decree (Spell)
Cost: 6 Energy
Effect: Give all friendly characters +2/+2. Give all enemy characters -2/-2 for this turn.
Sanctuary of Light (Location)
Cost: 5 Energy
Effect: At the end of your turn, restore 3 Health to your Hero. If you are at full Health, give a random friendly character +2 Health and Taunt.
The Reptilians: "Neural Stasis" Archetype
Reptilian control relies on Psionics to disrupt the opponent's rhythm and use Stealth to protect high-value targets until the late game
.
Psionic Slaver (Character)
Cost: 7 Energy | Stats: 5/5
Effect: Stealth. When this unit attacks a character, that character becomes Exhausted for two turns instead of taking damage
.
Neural Shutdown (Spell)
Cost: 4 Energy
Effect: Exhaust all enemy characters. They do not refresh at the start of the opponent's next turn
.
The Cloaking Hive (Location)
Cost: 3 Energy
Effect: Your characters with Stealth have +2 Attack. The first character you play each turn gains Stealth until your next turn
.
Network Supplements (Neutral Control Tools)
These cards are faction-agnostic and provide the essential "removal" and "stalling" required for any control deck to survive the early game
.
Satellite Jammer (Character)
Cost: 3 Energy | Stats: 2/4
Effect: Your opponent's next spell costs (2) more energy
.
Emergency Broadcast (Spell)
Cost: 2 Energy
Effect: Deal 2 damage to all characters. If any character is destroyed, draw a card
.
Global Surveillance (Location)
Cost: 2 Energy
Effect: You can see the top card of both players' decks. Once per turn, you may spend 1 energy to move the top card of your deck to the bottom.
What are some singleplayer systems and ideas you would suggest to add to the single player experience. Playing against AI is fun. But maybe a story narrative and zones the player works through where the opponents employ bettee tactics and cards. That way instead of a bloated tutorial with all of the mechanics, they can organically be introduced.

To enhance the single-player experience of your TCG and move away from a "bloated tutorial," you can implement a narrative-driven "Global Conspiracy Map" where mechanics are introduced organically through themed zones. This structure leverages the game's existing 240-card pool and faction-specific energy systems (Influence, Faith, and Psionics)
.
1. Zone-Based Narrative Progression
Instead of a single tutorial, the story can be divided into three primary zones, each focusing on a specific faction's lore and mechanics.
Zone 1: The Inner Circle (Illuminati Focus)
Theme: Political infiltration and shadow government.
Narrative: You are an agent uncovering a data leak. You start with basic Network cards to learn the core "Play & Attack" loop
.
Organic Learning: Early opponents play "Aggro" decks to teach you about board trades
. Middle-zone bosses introduce the "Influence" energy and the "Memory Thief" archetype, forcing you to deal with discards and card-copying tactics
.
Zone 2: The Sacred Reliquary (Templar Focus)
Theme: Ancient ruins and high-tech defense.
Narrative: The investigation leads to a hidden Templar vault.
Organic Learning: You are introduced to "Faith" energy. Opponents use "Control" decks featuring high-health Taunts and healing spells
. This teaches you how to navigate a "stalling" opponent who uses area-of-effect (AoE) board clears like Emergency Broadcast to reach their late-game finishers
.
Zone 3: The Hive Mind (Reptilian Focus)
Theme: Extra-dimensional threats and neural manipulation.
Narrative: You confront the true architects of the conspiracy.
Organic Learning: This zone introduces the most complex mechanics: "Psionics" and Stealth
. Opponents use "Disruption" tactics—Exhausting your units or Silencing their abilities—forcing you to adapt your strategy beyond simple combat
.
2. Tactical AI Scaling System
As the player moves through these zones, the AI's "intelligence" should scale to simulate better tactics. You can utilize the tiers already present in your project's roadmap:
Zone 1 AI (Basic): Focuses on "playing on curve," simply spending energy on the highest-cost character available
.
Zone 2 AI (Medium): Begins to understand "Trading"—it will target your high-attack/low-health units specifically to maintain board control
.
Zone 3 AI (Hard): Employs the 2-ply look-ahead system from your "Phase 9" roadmap, calculating the player's potential next turn to decide whether to attack "Face" or wait for a combo
.
3. The "Investigation Ledger" Reward System
To maintain engagement, replace standard tutorial pop-ups with an Investigation Ledger (integrated into the "Dossier" UI)
.
Unlockable Entries: Instead of being told how Stealth works, a "Classified File" unlocks after your first encounter with a Reptilian unit, explaining the mechanic and rewarding you with a copy of a Stealth card to add to your deck.
Deck Evolution: Players start with a weak "Starter Deck" of Network cards. As they defeat bosses in each zone, they "salvage" faction-specific cards, allowing their deck to evolve from a basic midrange deck into a specialized Control or Combo deck by the final zone
.
4. "Crisis" Challenge Encounters
Within each zone, add specialized "Showcase Matchups" (similar to your existing encounters.json) that have unique rules
:
The Blackout: Both players start with 10 Energy, but their decks are randomized. This forces players to understand high-cost "Big Minion" control tactics immediately
.
Neural Static: Players cannot use spells for the first three turns, emphasizing the importance of early-game character placement and Taunt protection
.
Im looking to plan out a single player experience for my conspiracy theory tcg for each faction with multiple difficulties and rewards (currency/cards/booster packs/achievements. I plan to implement the currency and pack system at a later date. Looking for ideas and suggestions for how to do this while incorporating a storyline and encounters tailored to each faction that introduce gameplay elements and mechanics as the player progresses node by node through zones/maps with a boss encounter at the end of each that is tailored to the zone/story

To create a compelling single-player experience for your Conspiracy TCG, you can adopt a narrative-driven roguelike progression similar to the "Dungeon Run" and "Dalaran Heist" models from the sources
. This structure allows you to introduce mechanics organically through node-based maps while providing significant replayability through different factions and difficulty settings.
1. Faction-Specific Narrative Campaigns
Each faction should have a distinct "Chapter" or "Wing" with a unique Twist—a global rule that alters gameplay for every encounter in that zone
.
The Illuminati: "The Boardroom Shadow"
Storyline: Infiltrate a global banking summit to leak classified data.
Gameplay Intro: Focuses on Influence energy and resource manipulation (discards/copying) [Source Conversation].
Zone Twist: "Liquid Assets" — Every time a card is discarded, that player gains 1 temporary Energy next turn
.
Final Boss: The Grand Archivist, who uses a deck that grows stronger every time the player draws a card [Source Conversation].
The Templars: "The Vault of Faith"
Storyline: Defend an ancient reliquary from a high-tech heist.
Gameplay Intro: Introduces Faith energy, Taunt mechanics, and healing [Source Conversation].
Zone Twist: "Hallowed Ground" — The first character played each turn gains +2 Health
.
Final Boss: Guardian of the Seal, who starts with 50 Health and Armor but cannot attack until his "Seal" is broken [Source Conversation].
The Reptilians: "The Psionic Hive"
Storyline: Destabilize the human world from an extra-dimensional hive.
Gameplay Intro: Teaches Psionics, Stealth, and Exhaustion [Source Conversation].
Zone Twist: "Static Air" — Every third spell played by either player is Silenced
.
Final Boss: The Psionic Slaver, who can take control of your highest-attack unit for one turn [Source Conversation].
2. Node-Based Progression System
As the player moves through a "map" (Investigation Board), they encounter different types of nodes
:
Combat Nodes: Standard battles against AI that scale in difficulty (using your 2-ply look-ahead AI for later stages)
.
The Safe House (Tavern Encounter): A non-combat node where players meet a contact (similar to Bartender Bob) to prune their deck, increase character stats, or discover new cards using gold/currency earned during the run
.
Crisis Encounters: Non-traditional battles, such as a "Temple Escape" where the player must survive 10 turns against a countdown instead of defeating a hero
.
3. Difficulty & Replayability Layers
To ensure the mode stays fresh, you can implement three distinct difficulty settings
:
Normal Mode: Focuses on the story. Players start with a 10-card faction-themed deck and add "buckets" of 3 cards after each win
.
Heroic Mode: Significantly harder AI with more health and better cards
. Completing this provides prestige rewards like Unique Card Backs
.
Anomaly Mode: Adds a random, run-wide modifier (e.g., "All characters have Stealth," or "Every spell casts twice") to keep veterans engaged
.
4. Rewards & Meta-Progression
Meta-progression encourages players to keep playing even after a "bad run"
.
Unlockables: Defeating a certain number of bosses can unlock alternate Hero Powers or new starting decks for that faction
.
Currency/Packs: Provide booster packs for first-time wing completions (e.g., 3 packs per wing)
.
Achievements: Award a Golden Classic Pack or a "Shadow Cloak" style card for completing all faction storylines on Heroic
.
Dossier Entries: Completing zones unlocks lore entries in the player’s "Investigation Ledger," providing a sense of world-building and narrative closure [Source Conversation].
Sunday, August 23
Okay for an example im thinking of for the Illuminati.


Short cutscene like a comic book moving panel to panel, (Player is approached by a member and informed they have been watched and selected to join the organization)


First board is a city that will be their initiation. Acts as a tutorial where the recruiter guides player through basic gameplay with a pre-made deck and regular combat nodes across the city. Last node (boss fight) introduces Templars after win, they kill Recruiter, attempt to capture player and fail, they escape.


Second board is Illuminati HQ. This will be player training with story elements.
Introduce 2 to 3 mechanics. Taunt and 2 others. As player reaches last node, cutscene plays, templars are attacking HQ. Previous nodes reactivate with Templar units and a zone twist that slightly buffs Templars but doesn't make them overpowered. Player works backwards through nodes to entrance where first node is now boss Templar.

This structure for the Illuminati campaign effectively blends narrative cutscenes with organic mechanical progression, moving from a guided introduction to a high-stakes tactical challenge. Below is a detailed plan for these two boards, drawing on the design principles of successful single-player TCG adventures.
Board 1: The City Initiation (Tutorial & Ambush)
Narrative Intro: A series of moving comic book panels [Source Query]. The recruiter explains that the organization has been monitoring the player's potential for "Influence."
Gameplay Structure:
Pre-made Deck: The player starts with a basic Network deck to learn core loops: energy growth, playing characters, and the "Attack" phase
.
Recruiter Guidance: Much like Kel'Thuzad or Dr. Boom in other adventures, the Recruiter "chimes in" with dialogue during battles to explain why a trade was good or how to spend energy efficiently
.
Combat Nodes: Simple AI opponents (Tier 1 AI) focused on standard combat [Source Conversation].
The Boss Node: "The Traitor's Toll"
The Twist: Just as the player wins the final initiation match, a cutscene triggers. Templar Inquisitors ambush the meeting.
Lore Impact: The Recruiter is killed, and the player must use a special "Escape" mechanic—similar to the Temple Escape encounter in League of Explorers—where the goal is survival for 5 turns rather than defeating a hero
.
Board 2: Illuminati HQ (Training & Siege)
Narrative: The player is brought into the HQ for "Refined Training."
Mechanics Introduction: This board introduces 2 to 3 key mechanics across its first few nodes:
Taunt: Learning to use defensive units to protect the Hero
.
Influence (Faction Energy): Introducing the Illuminati’s specific energy for card manipulation and resource control
.
The "Memory Thief" Mechanics: Spells and characters that focus on Forcing Discards and Copying cards from the opponent's deck to build an advantage [Source Conversation].
The Mid-Board Twist: "Breach at the Sanctum"
Scenario: Upon reaching the final node, the Templars launch a full-scale assault on the HQ.
Reverse Progression: Previously cleared nodes "reactivate" with Templar enemies. The player must work backwards through the map to reach the entrance [Source Query].
Zone Twist: "Righteous Fortitude": Every encounter during the backtrack phase features a global rule (Twist) that slightly buffs the Templars. For example: "Templar characters start the game with +1 Health" or "Friendly characters gain +1 Attack if you have Faith energy" [43, Source Conversation].
Final Boss: Templar Grandmaster
Tactics: The Grandmaster uses high-health Faith defenders and board-clears like "Divine Retribution" to punish the player for over-extending [Source Conversation].
Reward: Successfully defending the HQ unlocks the first Illuminati Booster Pack and a permanent upgrade to the player’s starting deck
.
Why This Works for Players
Narrative Agency: Moving the player through a story where they are an active participant (escaping capture, defending a base) provides the "hook" needed for long-term engagement
.
Progression and Tracking: As the player works through these zones, they unlock more hero powers and starting decks, which prevents the "bad run" feeling of losing all progress upon defeat
.
Thematic Cohesion: The Templar "Zone Twist" during the HQ siege reinforces their faction lore of Defense and Resilience without making the game feel unfair to a new player [28, Source Conversation].