import { CURATED_DECKS, expandDeck, getEncounter } from "./catalog";
import { startMatch } from "./engine";
import type { DeckList, MatchState } from "./types";

export function matchFromEncounter(
  encounterId: string,
  playerDeck: DeckList,
  opts?: { difficulty?: MatchState["difficulty"]; playerName?: string },
): MatchState {
  const enc = getEncounter(encounterId);
  const curatedAi =
    CURATED_DECKS.find((d) => d.faction === (enc?.ai_faction ?? "reptilians")) ?? CURATED_DECKS[1]!;
  const playerIds = enc?.player_deck ?? expandDeck(playerDeck.cards);
  const aiIds = enc?.ai_deck ?? expandDeck(curatedAi.cards);

  return startMatch({
    playerName: opts?.playerName ?? enc?.player_name ?? "ARCHIVE_7",
    aiName: enc?.ai_name ?? "Handler",
    playerFaction: enc?.player_faction ?? playerDeck.faction,
    aiFaction: enc?.ai_faction ?? curatedAi.faction,
    playerDeck: playerIds,
    aiDeck: aiIds,
    aiLife: enc?.ai_starting_life,
    shuffle: enc?.shuffle,
    playerGoesFirst: enc?.player_goes_first,
    difficulty: opts?.difficulty ?? enc?.difficulty ?? "medium",
    encounterId,
  });
}

export function matchFromSkirmish(opts: {
  playerDeck: DeckList;
  opponentFaction: DeckList["faction"];
  difficulty: MatchState["difficulty"];
  playerName: string;
}): MatchState {
  const opp = CURATED_DECKS.find((d) => d.faction === opts.opponentFaction) ?? CURATED_DECKS[0]!;
  return startMatch({
    playerName: opts.playerName,
    aiName: opp.name,
    playerFaction: opts.playerDeck.faction,
    aiFaction: opp.faction,
    playerDeck: expandDeck(opts.playerDeck.cards),
    aiDeck: expandDeck(opp.cards),
    shuffle: true,
    playerGoesFirst: true,
    difficulty: opts.difficulty,
    encounterId: "skirmish",
  });
}
