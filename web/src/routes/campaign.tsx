import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { BookOpen, Eye, Lock, Radio, Shield, Skull, UserRound, Shirt } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TerminalFrame } from "@/components/shell/TerminalFrame";
import { NavButtons, PageHeader } from "@/components/nav/NavButtons";
import { CardFace } from "@/components/cards/CardFace";
import {
  CAMPAIGN_CHAPTERS,
  boardArt,
  boardHint,
  boardKicker,
  getBoard,
  getNode,
  kitSummary,
  ledgerFile,
  mapLinks,
  newCampaignRun,
  nodeKindLabel,
  nodeStatus,
  resolveCampaignNode,
  storyArtFor,
  storyPanelsFor,
} from "@/lib/game/campaign";
import { matchFromCampaignNode } from "@/lib/game/launch";
import { getCard } from "@/lib/game/catalog";
import { callsignOf, cosmeticSrc, STARTER_LOADOUT } from "@/lib/game/cosmetics";
import { useArchive } from "@/lib/store";
import { cn } from "@/lib/utils";
import type { CampaignNode, CampaignRun, SafehousePick, StoryPanel } from "@/lib/game/types";

export const Route = createFileRoute("/campaign")({ component: CampaignPage });

function CampaignPage() {
  const archive = useArchive();
  const run = archive.campaignRun;
  if (!run) return <CampaignHub />;
  return <InvestigationBoard run={run} />;
}

function CampaignHub() {
  const archive = useArchive();
  const nav = useNavigate();
  const [diffPick, setDiffPick] = useState<"normal" | "heroic" | null>(null);
  const diff = diffPick ?? (archive.heroicCleared ? "heroic" : "normal");
  const loadout = archive.cosmeticsLoadout ?? STARTER_LOADOUT;
  const sleeve = cosmeticSrc(loadout.cardBack, "/cards/backs/illuminati-back.jpg");
  const callsign = callsignOf(archive.handle, loadout.title);

  return (
    <TerminalFrame>
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="panel rounded-lg p-3">
            <NavButtons active="missions" />
          </div>
        </aside>
        <section className="panel relative min-h-0 flex-1 overflow-auto rounded-lg">
          <img
            src="/ui/campaign/hq-board.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-void via-void/80 to-void/40" />
          <div className="relative z-10 p-4 sm:p-6">
            <PageHeader
              kicker="// SHADOW WAR"
              title="Investigation"
              action={
                <button
                  type="button"
                  className="metal-btn min-h-11 rounded-md px-3 font-mono text-[10px] tracking-[0.16em]"
                  onClick={() => void nav({ to: "/locker" })}
                >
                  LOCKER
                </button>
              }
            />
            <p className="max-w-xl font-mono text-[12px] leading-relaxed text-muted">
              Walk a chapter. Salvage the kit. Field cards land in Collection. Sleeves and plates unlock in the
              Locker. First Contact stays optional.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] tracking-[0.18em] text-muted">DIFFICULTY</span>
              {(["normal", "heroic"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDiffPick(d)}
                  className={cn(
                    "min-h-11 rounded-md px-3 font-mono text-[10px] tracking-[0.16em]",
                    diff === d ? "metal-btn-live text-phosphor" : "metal-btn",
                  )}
                >
                  {d === "heroic" ? "HEROIC" : "NORMAL"}
                </button>
              ))}
              {diff === "heroic" && (
                <span className="font-mono text-[10px] text-watch">
                  AI steps up. +2 enemy life. Enemy bodies enter with extra Health.
                </span>
              )}
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {CAMPAIGN_CHAPTERS.map((ch) => {
                const sealed = ch.status === "sealed";
                const live = Boolean(archive.campaignRun) && archive.campaignRun?.chapterId === ch.id;
                const done = ch.id === "illuminati" && archive.chapterCleared;
                const city = ch.id === "illuminati" && archive.cityCleared && !archive.chapterCleared;
                return (
                  <button
                    key={ch.id}
                    type="button"
                    disabled={sealed}
                    onClick={() => {
                      if (sealed) return;
                      if (!live) archive.setCampaignRun(newCampaignRun(ch.id, diff));
                    }}
                    className={cn(
                      "relative overflow-hidden rounded-lg p-0 text-left",
                      sealed ? "metal-btn opacity-70" : "metal-btn-live",
                    )}
                  >
                    <img src={ch.art ?? "/ui/campaign/hq-board.jpg"} alt="" className="h-36 w-full object-cover" />
                    <div className="p-4">
                      <div className="flex items-center justify-between gap-2 font-mono text-[10px] tracking-[0.2em] text-phosphor">
                        <span>{ch.faction.toUpperCase()}</span>
                        {sealed ? (
                          <span className="flex items-center gap-1 text-muted">
                            <Lock className="size-3" /> SEALED
                          </span>
                        ) : live ? (
                          <span className="text-watch">LIVE</span>
                        ) : done ? (
                          <span>ON FILE</span>
                        ) : (
                          <span>OPEN</span>
                        )}
                      </div>
                      <div className="mt-1 font-ui text-2xl font-semibold text-ink">{ch.name}</div>
                      <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted">{ch.description}</p>
                      <div className="mt-3 font-mono text-[10px] tracking-[0.16em] text-watch">
                        {sealed
                          ? "NEXT WING"
                          : live
                            ? archive.campaignRun?.boardId === "hq"
                              ? "RESUME LODGE"
                              : "RESUME CITY BOARD"
                            : done
                              ? diff === "heroic"
                                ? "RUN HEROIC"
                                : "RUN AGAIN"
                              : city
                                ? "CITY ON FILE · NEW RUN"
                                : diff === "heroic"
                                  ? "BEGIN HEROIC"
                                  : "BEGIN INITIATION"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => void nav({ to: "/locker" })}
              className="metal-btn mt-6 flex w-full items-center gap-4 rounded-lg p-4 text-left"
            >
              <img
                src={sleeve}
                alt=""
                className="h-16 w-12 rounded-sm object-cover outline outline-1 outline-edge"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-gold">
                  <Shirt className="size-3.5" /> LOCKER
                </div>
                <div className="font-ui text-lg font-semibold text-ink">{callsign}</div>
                <p className="font-mono text-[11px] text-muted">
                  {archive.cosmeticsUnlocked?.length ?? 0} sleeves and plates on file. Equip before you walk in.
                </p>
              </div>
            </button>
          </div>
        </section>
      </div>
    </TerminalFrame>
  );
}

function InvestigationBoard({ run }: { run: CampaignRun }) {
  const archive = useArchive();
  const nav = useNavigate();
  const board = getBoard(run.chapterId, run.boardId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [story, setStory] = useState<{ node: CampaignNode; panels: StoryPanel[]; after?: "match" | "clear" } | null>(null);
  const [safe, setSafe] = useState<CampaignNode | null>(null);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const kit = useMemo(() => kitSummary(run.deck), [run.deck]);

  useEffect(() => {
    if (!board) return;
    if (run.boardId !== "hq" || run.phase !== "forward") return;
    if (run.cleared.includes(board.start_node)) return;
    const start = getNode(board, board.start_node);
    if (start?.type === "story") {
      setStory({ node: start, panels: storyPanelsFor(run, start), after: "clear" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run.boardId, run.phase, board?.start_node]);

  if (!board) {
    return (
      <TerminalFrame>
        <p className="p-6 font-mono text-sm text-muted">Board missing.</p>
      </TerminalFrame>
    );
  }

  const selectedRaw = selectedId ? getNode(board, selectedId) : undefined;
  const selected = selectedRaw ? resolveCampaignNode(run, selectedRaw, board) : undefined;
  const links = mapLinks(board, run);
  const reverse = run.phase === "reverse" || run.phase === "boss";

  const launchNode = (raw: CampaignNode) => {
    const status = nodeStatus(run, raw, board);
    if (status === "locked") return;
    archive.setCampaignRun({ ...run, currentNodeId: raw.id });
    const node = resolveCampaignNode(run, raw, board);

    if (raw.type === "story" || node.type === "story") {
      setStory({ node, panels: storyPanelsFor(run, node), after: "clear" });
      return;
    }
    if (raw.type === "safehouse") {
      if (status === "cleared") return;
      setSafe(raw);
      return;
    }
    if (node.story_panels_on_enter?.length) {
      setStory({ node, panels: node.story_panels_on_enter, after: "match" });
      return;
    }
    startFight(raw);
  };

  const startFight = (raw: CampaignNode) => {
    const name = callsignOf(archive.handle, archive.cosmeticsLoadout?.title ?? "title-archive");
    const match = matchFromCampaignNode(run, raw, name, board);
    archive.setMatch(match);
    void nav({ to: "/match" });
  };

  return (
    <TerminalFrame>
      <div className="relative flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="panel rounded-lg p-3">
            <NavButtons active="missions" />
          </div>
        </aside>
        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
          <div className="panel rounded-lg p-3 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-mono text-[10px] tracking-[0.22em] text-phosphor">{boardKicker(run, board)}</div>
                <h1 className="font-display text-2xl tracking-wide text-ink sm:text-3xl">
                  {board.name}
                  {run.phase === "reverse" ? " — Breach" : run.phase === "boss" ? " — Exit" : run.phase === "done" ? " — Secure" : ""}
                </h1>
                <p className="mt-1 font-mono text-[11px] text-muted">{boardHint(run, board)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="metal-btn min-h-11 rounded-md px-3 font-mono text-[10px] tracking-[0.16em] text-ink"
                  onClick={() => void nav({ to: "/locker" })}
                >
                  LOCKER
                </button>
                <button
                  type="button"
                  className="metal-btn min-h-11 rounded-md px-3 font-mono text-[10px] tracking-[0.16em] text-ink"
                  onClick={() => setLedgerOpen(true)}
                >
                  LEDGER · {run.ledger.length}
                </button>
                <button
                  type="button"
                  className="metal-btn min-h-11 rounded-md px-3 font-mono text-[10px] tracking-[0.16em] text-threat"
                  onClick={() => archive.setCampaignRun(null)}
                >
                  ABANDON
                </button>
              </div>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div
              className={cn(
                "campaign-map panel relative min-h-[280px] overflow-hidden rounded-lg sm:min-h-[360px]",
                reverse && "campaign-map-reverse",
              )}
            >
              <img
                src={boardArt(board.id)}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                className={cn(
                  "absolute inset-0",
                  reverse ? "bg-gradient-to-t from-void/80 via-threat/10 to-void/40" : "bg-gradient-to-t from-void/70 via-transparent to-void/30",
                )}
              />
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
                {links.map(({ from, to }) => {
                  const a = nodeStatus(run, from, board);
                  const b = nodeStatus(run, to, board);
                  const lit = a === "cleared";
                  return (
                    <line
                      key={`${from.id}-${to.id}`}
                      x1={from.map.x * 100}
                      y1={from.map.y * 100}
                      x2={to.map.x * 100}
                      y2={to.map.y * 100}
                      stroke={reverse ? (lit ? "rgba(226,61,61,0.7)" : "rgba(200,168,78,0.35)") : lit ? "rgba(124,255,154,0.65)" : "rgba(122,132,120,0.35)"}
                      strokeWidth={b === "locked" ? 0.4 : 0.7}
                      strokeDasharray={lit ? "0" : "1.6 1.4"}
                    />
                  );
                })}
              </svg>
              {board.nodes.map((node) => {
                const st = nodeStatus(run, node, board);
                const live = selectedId === node.id;
                const shown = resolveCampaignNode(run, node, board);
                return (
                  <button
                    key={node.id}
                    type="button"
                    disabled={st === "locked"}
                    onClick={() => setSelectedId(node.id)}
                    onDoubleClick={() => launchNode(node)}
                    style={{ left: `${node.map.x * 100}%`, top: `${node.map.y * 100}%` }}
                    className={cn(
                      "campaign-node absolute flex min-h-11 min-w-11 -translate-x-1/2 -translate-y-1/2 flex-col items-center",
                      st === "locked" && "opacity-45",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-9 items-center justify-center rounded-full border-2 bg-void/80",
                        st === "cleared" && "border-phosphor text-phosphor",
                        st === "open" && (reverse ? "border-threat text-threat campaign-node-pulse" : "border-watch text-watch campaign-node-pulse"),
                        st === "locked" && "border-muted text-muted",
                        live && "ring-2 ring-phosphor/70",
                      )}
                    >
                      <NodeGlyph node={shown} />
                    </span>
                    <span className="mt-1 max-w-28 text-center rounded-sm bg-void/85 px-1.5 py-0.5 font-mono text-[9px] leading-tight tracking-wide text-paper">
                      {shown.title}
                    </span>
                  </button>
                );
              })}
            </div>

            <aside className="panel flex min-h-0 flex-col overflow-hidden rounded-lg">
              {selected && selectedRaw ? (
                <SelectedNode
                  node={selected}
                  status={nodeStatus(run, selectedRaw, board)}
                  onEnter={() => launchNode(selectedRaw)}
                />
              ) : (
                <div className="p-4">
                  <div className="font-mono text-[10px] tracking-[0.2em] text-phosphor">SELECT A NODE</div>
                  <p className="mt-2 font-mono text-[12px] leading-relaxed text-muted">
                    Open contacts glow. Cleared nodes stay on file. Double-tap a pin or use Enter.
                  </p>
                </div>
              )}
              <div className="min-h-0 flex-1 overflow-auto border-t border-edge p-4">
                <div className="font-mono text-[10px] tracking-[0.2em] text-gold">
                  RUN KIT · {run.deck.length}
                  {run.deckLive ? " · LIVE" : " · SCRIPTED"}
                </div>
                <ul className="mt-2 space-y-1 font-mono text-[11px] text-ink">
                  {kit.map((row) => (
                    <li key={row.id} className="flex justify-between gap-2">
                      <span className="truncate">{row.name}</span>
                      <span className="text-muted">×{row.copies}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </section>
      </div>

      {story && (
        <StoryOverlay
          node={story.node}
          panels={story.panels}
          onDone={() => {
            const current = story;
            setStory(null);
            if (current.after === "clear") {
              const skipId = typeof run.flags.skip_reverse_node === "string" ? run.flags.skip_reverse_node : "";
              const skipNode = skipId && current.node.triggers_reverse ? getNode(board, skipId) : undefined;
              const blurb = skipNode?.reverse?.skip_blurb;
              archive.completeCampaignNode(current.node.id);
              if (blurb && skipNode) {
                window.setTimeout(() => setStory({ node: skipNode, panels: [{ text: blurb }] }), 0);
              }
            }
            if (current.after === "match") startFight(current.node);
          }}
        />
      )}
      {safe && (
        <SafehouseOverlay
          node={safe}
          onPick={(pick) => {
            archive.applyCampaignSafehouse(safe.id, pick);
            setSafe(null);
            setSelectedId(safe.id);
          }}
          onClose={() => setSafe(null)}
        />
      )}
      {ledgerOpen && (
        <LedgerOverlay run={run} onClose={() => setLedgerOpen(false)} />
      )}
      {run.phase === "city_complete" && !story && !safe && (
        <CityCompleteBanner onEnter={() => archive.enterCampaignHq()} />
      )}
      {run.phase === "done" && !story && !safe && <ChapterCompleteBanner />}
    </TerminalFrame>
  );
}

function NodeGlyph({ node }: { node: CampaignNode }) {
  if (node.type === "story") return <Eye className="size-4" />;
  if (node.type === "safehouse") return <Shield className="size-4" />;
  if (node.type === "crisis") return <Skull className="size-4" />;
  if (node.type === "boss") return <Radio className="size-4" />;
  return <UserRound className="size-4" />;
}

function SelectedNode({
  node,
  status,
  onEnter,
}: {
  node: CampaignNode;
  status: "cleared" | "open" | "locked";
  onEnter: () => void;
}) {
  return (
    <div className="p-4">
      <img src={storyArtFor(node)} alt="" className="mb-3 h-28 w-full rounded-md object-cover" />
      <div className="font-mono text-[10px] tracking-[0.2em] text-phosphor">{nodeKindLabel(node)}</div>
      <h2 className="font-ui text-xl font-semibold text-ink">{node.title}</h2>
      <p className="mt-1 font-mono text-[12px] leading-relaxed text-muted">{node.blurb}</p>
      {node.ai && (
        <p className="mt-2 font-mono text-[10px] tracking-[0.14em] text-watch">
          VS {node.ai.name} · {node.ai_starting_life ?? 30} LIFE
        </p>
      )}
      {node.twist && (
        <p className="mt-2 font-mono text-[10px] tracking-[0.12em] text-threat">
          TWIST · {node.twist.label}
        </p>
      )}
      <button
        type="button"
        disabled={status === "locked" || (status === "cleared" && node.type === "safehouse")}
        onClick={onEnter}
        className={cn(
          "mt-4 min-h-11 w-full rounded-md font-ui tracking-[0.16em]",
          status === "locked" ? "metal-btn opacity-50" : "metal-btn-live text-phosphor",
        )}
      >
        {status === "locked"
          ? "SEALED"
          : status === "cleared"
            ? node.type === "safehouse"
              ? "DROP LOGGED"
              : node.type === "story"
                ? "REREAD"
                : "REFIGHT"
            : "ENTER"}
      </button>
    </div>
  );
}

function StoryOverlay({
  node,
  panels,
  onDone,
}: {
  node: CampaignNode;
  panels: StoryPanel[];
  onDone: () => void;
}) {
  const [i, setI] = useState(0);
  const panel = panels[i] ?? { text: node.blurb };
  const last = i >= panels.length - 1;
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-void/85 p-4">
      <article className="panel relative max-h-[90dvh] w-full max-w-xl overflow-auto rounded-lg">
        <img src={storyArtFor(node)} alt="" className="h-44 w-full object-cover sm:h-56" />
        <div className="p-5">
          <div className="font-mono text-[10px] tracking-[0.2em] text-phosphor">{node.title}</div>
          <p className="mt-3 font-mono text-[14px] leading-relaxed text-ink">{panel.text}</p>
          <button
            type="button"
            className="metal-btn-live mt-5 min-h-11 w-full rounded-md font-ui tracking-[0.16em] text-phosphor"
            onClick={() => (last ? onDone() : setI((n) => n + 1))}
          >
            {last ? "CONTINUE" : "NEXT"}
          </button>
        </div>
      </article>
    </div>
  );
}

function SafehouseOverlay({
  node,
  onPick,
  onClose,
}: {
  node: CampaignNode;
  onPick: (pick: SafehousePick) => void;
  onClose: () => void;
}) {
  const picks = node.safehouse?.pick_one_of ?? [];
  const armory = node.id === "hq_armory";
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-void/85 p-4">
      <article className="panel max-h-[90dvh] w-full max-w-2xl overflow-auto rounded-lg">
        <img src={storyArtFor(node)} alt="" className="h-40 w-full object-cover" />
        <div className="p-5">
          <div className="font-mono text-[10px] tracking-[0.2em] text-phosphor">
            {armory ? "BLACK BUDGET" : "SAFE DROP"}
          </div>
          <h2 className="mt-1 font-ui text-2xl font-semibold text-ink">{node.title}</h2>
          <p className="mt-2 font-mono text-[13px] leading-relaxed text-muted">{node.safehouse?.text}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {picks.map((pick) => {
              const card = pick.action === "add" || pick.action === "inject" ? getCard(pick.id) : null;
              return (
                <button
                  key={pick.id}
                  type="button"
                  onClick={() => onPick(pick)}
                  className="metal-btn flex flex-col rounded-lg p-3 text-left hover:brightness-110"
                >
                  {card && (
                    <div className="mb-2 w-full">
                      <CardFace card={card} compact />
                    </div>
                  )}
                  <span className="font-ui text-lg font-semibold text-ink">{pick.label}</span>
                  <span className="mt-1 font-mono text-[11px] leading-relaxed text-muted">{pick.blurb}</span>
                </button>
              );
            })}
          </div>
          <button type="button" className="mt-4 font-mono text-[11px] text-muted" onClick={onClose}>
            Back to board
          </button>
        </div>
      </article>
    </div>
  );
}

function LedgerOverlay({ run, onClose }: { run: CampaignRun; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-void/85 p-4">
      <article className="panel max-h-[90dvh] w-full max-w-lg overflow-auto rounded-lg p-5">
        <div className="flex items-center justify-between">
          <div className="font-mono text-[10px] tracking-[0.2em] text-phosphor">LEDGER</div>
          <button type="button" className="metal-btn min-h-11 rounded-md px-3 font-mono text-[10px]" onClick={onClose}>
            CLOSE
          </button>
        </div>
        {run.ledger.length === 0 ? (
          <p className="mt-4 font-mono text-sm text-muted">No files yet. Walk the city.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {run.ledger.map((id) => {
              const file = ledgerFile(id, run);
              return (
                <li key={id} className="rounded-md border border-edge bg-void/40 p-3">
                  <div className="flex items-center gap-2 font-ui text-sm font-semibold text-ink">
                    <BookOpen className="size-4 text-phosphor" />
                    {file?.title ?? id}
                  </div>
                  <p className="mt-1 font-mono text-[12px] leading-relaxed text-muted">{file?.text}</p>
                </li>
              );
            })}
          </ul>
        )}
      </article>
    </div>
  );
}

function CityCompleteBanner({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="absolute bottom-4 left-1/2 z-20 w-[min(520px,92%)] -translate-x-1/2 rounded-md bg-void/90 p-3 outline outline-1 outline-phosphor/40">
      <div className="font-mono text-[10px] tracking-[0.2em] text-phosphor">CITY CLEARED</div>
      <p className="mt-1 font-mono text-[12px] leading-relaxed text-ink">
        You escaped. Callsign INITIATE is on file. The Lodge is dark. Ops is already on the radio.
      </p>
      <button
        type="button"
        className="metal-btn-live mt-3 min-h-11 w-full rounded-md font-ui tracking-[0.16em] text-phosphor"
        onClick={onEnter}
      >
        ENTER THE LODGE
      </button>
    </div>
  );
}

function ChapterCompleteBanner() {
  const archive = useArchive();
  const nav = useNavigate();
  const heroic = archive.campaignRun?.difficulty === "heroic";
  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-void/55 p-4 sm:items-center">
      <div className="w-full max-w-lg rounded-md bg-void/95 p-4 outline outline-1 outline-phosphor/40">
        <div className="font-mono text-[10px] tracking-[0.2em] text-phosphor">
          INNER CIRCLE — CLOSED{heroic ? " · HEROIC" : ""}
        </div>
        <p className="mt-2 font-mono text-[13px] leading-relaxed text-ink">
          HQ holds. Field cards are in Collection. Sleeves and plates unlocked in the Locker.
          {heroic
            ? " Grandmaster Foil is yours."
            : " Run Heroic for the gold foil and Righteous Gold felt."}{" "}
          Other wings remain sealed.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            className="metal-btn-live min-h-11 rounded-md font-ui tracking-[0.16em] text-phosphor"
            onClick={() => void nav({ to: "/locker" })}
          >
            OPEN LOCKER
          </button>
          <button
            type="button"
            className="metal-btn min-h-11 rounded-md font-ui tracking-[0.16em]"
            onClick={() => archive.setCampaignRun(newCampaignRun("illuminati", heroic ? "normal" : "heroic"))}
          >
            {heroic ? "RUN NORMAL" : "RUN HEROIC"}
          </button>
          <button
            type="button"
            className="metal-btn min-h-11 rounded-md font-ui tracking-[0.16em] sm:col-span-2"
            onClick={() => archive.setCampaignRun(null)}
          >
            RETURN TO ARCHIVE
          </button>
        </div>
      </div>
    </div>
  );
}
