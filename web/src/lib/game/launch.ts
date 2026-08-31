import { CURATED_DECKS, expandDeck, getEncounter } from "./catalog";
import { startMatch } from "./engine";
import {
  campaignCoachId,
  campaignStepsOf,
  flattenDeckIds,
  matchPlayerDeck,
  resolveCampaignNode,
} from "./campaign";
import type { CampaignBoard, CampaignNode, CampaignRun, DeckList, MatchState } from "./types";

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
    playerName: enc?.player_name ?? opts?.playerName ?? "ARCHIVE_7",
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

function asHeroFaction(raw: string | undefined): DeckList["faction"] {
  if (raw === "templars" || raw === "reptilians" || raw === "illuminati") return raw;
  return "illuminati";
}

function heroicDifficulty(
  base: MatchState["difficulty"] | undefined,
  run: CampaignRun,
): MatchState["difficulty"] {
  const d = base ?? "easy";
  if (run.difficulty !== "heroic") return d;
  if (d === "easy") return "medium";
  return "hard";
}

function heroicTwist(run: CampaignRun, twist: MatchState["twist"]): MatchState["twist"] {
  if (run.difficulty !== "heroic") return twist;
  const extra = 1;
  if (twist) {
    return {
      ...twist,
      label: `${twist.label} · Heroic`,
      description: `${twist.description} Heroic Pressure: extra Health on enemy bodies.`,
      enemyHealthBonus: twist.enemyHealthBonus + extra,
    };
  }
  return {
    id: "heroic_pressure",
    label: "Heroic Pressure",
    description: "Enemy characters enter play with +1 Health.",
    enemyHealthBonus: extra,
  };
}

export function matchFromCampaignNode(
  run: CampaignRun,
  node: CampaignNode,
  playerName: string,
  board: CampaignBoard,
): MatchState {
  const resolved = resolveCampaignNode(run, node, board);
  const payload = matchPlayerDeck(run, resolved);
  const aiFaction = asHeroFaction(resolved.ai?.faction);
  const coach = campaignCoachId(run, resolved);
  const crisis =
    resolved.crisis?.win === "survive_turns"
      ? {
          win: "survive_turns" as const,
          turnsRequired: resolved.crisis.turns,
          label: resolved.crisis.label || resolved.title,
        }
      : null;
  const twistDef = resolved.twist;
  const twist = heroicTwist(
    run,
    twistDef
      ? {
          id: twistDef.id,
          label: twistDef.label,
          description: twistDef.description,
          enemyHealthBonus: twistDef.match_modifiers?.enemy_character_health_bonus ?? 0,
        }
      : null,
  );
  const baseLife = resolved.ai_starting_life;
  const aiLife = (baseLife ?? 30) + (run.difficulty === "heroic" ? 2 : 0);

  return startMatch({
    playerName,
    aiName: resolved.ai?.name ?? "Handler",
    playerFaction: "illuminati",
    aiFaction,
    playerDeck: payload.ids,
    aiDeck: flattenDeckIds(resolved.ai_deck),
    aiLife,
    shuffle: payload.shuffle,
    playerGoesFirst: resolved.player_goes_first !== false,
    difficulty: heroicDifficulty(resolved.ai?.difficulty, run),
    encounterId: `campaign:${run.boardId}:${resolved.id}:${run.phase}`,
    skipMulligan: true,
    campaign: {
      chapterId: run.chapterId,
      boardId: run.boardId,
      nodeId: node.id,
      nodeTitle: resolved.title,
      coach,
      teach: resolved.teach !== false && Boolean(resolved.steps?.length),
      steps: campaignStepsOf(resolved),
      lessonWin: resolved.lesson_win,
      lessonLoss: resolved.lesson_loss,
      twistLabel: twist?.label,
    },
    crisis,
    twist,
  });
}
