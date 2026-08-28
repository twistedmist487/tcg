/**
 * Campaign — Investigation Board (M2 City + M3 HQ reverse / ledger).
 * Run deck, Safe Drop fork, Armory injection, Recruiter / Ops voice.
 * Loaded after app.js
 */
const CAMPAIGN_RUN_KEY = 'conspiracy_campaign_run_v2';
const DEFAULT_TRIM = ['neutral_char_028', 'neutral_spell_022', 'neutral_char_001', 'illuminati_char_009'];
let campaignSummaries = [];
let campaignChapter = null;
let campaignRun = null;
let selectedCampaignNodeId = null;
let storyQueue = [];
let storyQueueIndex = 0;
let storyOnDone = null;
let pendingCampaignNode = null;
let pendingSafehouseNode = null;
let campaignTeachDone = new Set();
let campaignCoachLine = null;

function cardNameById(id) {
  const card = (typeof allCards !== 'undefined' ? allCards : []).find((c) => c.id === id);
  return card ? card.name : id;
}

function expandPresetIds(presetId) {
  const presets = (typeof curatedDecks !== 'undefined' && curatedDecks.presets) || [];
  const preset = presets.find((p) => p.id === presetId);
  if (!preset) return [];
  const ids = [];
  (preset.cards || []).forEach((entry) => {
    const copies = entry.copies || 1;
    for (let i = 0; i < copies; i += 1) ids.push(entry.id);
  });
  return ids;
}

function countCopies(deck, cardId) {
  return (deck || []).filter((id) => id === cardId).length;
}

function trimDeck(deck, size, preferRemove) {
  const out = (deck || []).slice();
  const prefer = preferRemove && preferRemove.length ? preferRemove : DEFAULT_TRIM;
  while (out.length > size) {
    let removed = false;
    for (const cardId of prefer) {
      const idx = out.lastIndexOf(cardId);
      if (idx >= 0) {
        out.splice(idx, 1);
        removed = true;
        break;
      }
    }
    if (!removed) out.pop();
  }
  return out;
}

function addCardToDeck(deck, cardId, copies, preferRemove) {
  const out = (deck || []).slice();
  const n = copies || 1;
  for (let i = 0; i < n; i += 1) {
    if (countCopies(out, cardId) >= 2) break;
    out.push(cardId);
  }
  return trimDeck(out, 30, preferRemove);
}

function pruneCardFromDeck(deck, cardId) {
  const out = (deck || []).slice();
  const idx = out.indexOf(cardId);
  if (idx >= 0) out.splice(idx, 1);
  return out;
}

function applySafehousePickToRun(pick) {
  if (!campaignRun || !pick) return;
  const action = (pick.action || pick.op || '').toLowerCase();
  const trim = pick.trim || DEFAULT_TRIM;
  campaignRun.flags = campaignRun.flags || {};
  if (action === 'add' || action === 'inject') {
    campaignRun.deck = addCardToDeck(campaignRun.deck || [], pick.id, pick.copies || 1, trim);
    campaignRun.flags.last_deck_change = `added:${pick.id}`;
    campaignRun.flags.last_armory_pick = pick.label || pick.id;
    campaignRun.deck_live = true;
  } else if (action === 'prune') {
    campaignRun.deck = pruneCardFromDeck(campaignRun.deck || [], pick.prune_id || pick.id);
    campaignRun.flags.last_deck_change = `pruned:${pick.prune_id || pick.id}`;
    campaignRun.deck_live = true;
  } else if (action === 'skip') {
    campaignRun.flags.skipped_safe_drop = true;
    campaignRun.flags.last_deck_change = 'skipped';
    if (!(campaignRun.ledger || []).includes('file_reckless')) {
      campaignRun.ledger = campaignRun.ledger || [];
      campaignRun.ledger.push('file_reckless');
    }
  }
  if (pick.skip_reverse_node) {
    campaignRun.flags.skip_reverse_node = pick.skip_reverse_node;
  }
}

function seedTeachFront(deck, seedIds) {
  const out = (deck || []).slice();
  const front = [];
  (seedIds || []).forEach((cardId) => {
    const idx = out.indexOf(cardId);
    if (idx >= 0) out.splice(idx, 1);
    front.push(cardId);
  });
  return front.concat(out);
}

function campaignCoachId() {
  if (!campaignRun) return 'recruiter';
  const flags = campaignRun.flags || {};
  if (flags.recruiter_dead || campaignRun.board_id === 'hq') return 'ops';
  return 'recruiter';
}

function campaignCoachName() {
  const id = campaignCoachId();
  if (id === 'ops') return 'Ops';
  if (id === 'silent') return '';
  return 'Recruiter';
}

function nodeCoach(node) {
  if (!node) return campaignCoachId();
  if (node.coach === 'silent') return 'silent';
  if (campaignRun && (campaignRun.flags || {}).recruiter_dead) return 'ops';
  if (node.coach) return node.coach;
  return campaignCoachId();
}

function loadCampaignRun() {
  try {
    const raw = localStorage.getItem(CAMPAIGN_RUN_KEY);
    campaignRun = raw ? JSON.parse(raw) : null;
  } catch (e) {
    campaignRun = null;
  }
  if (campaignRun) {
    campaignRun.cleared = campaignRun.cleared || [];
    campaignRun.ledger = campaignRun.ledger || [];
    campaignRun.flags = campaignRun.flags || {};
    campaignRun.reverse_cleared = campaignRun.reverse_cleared || [];
    campaignRun.phase = campaignRun.phase || 'forward';
    campaignRun.armory_picks = campaignRun.armory_picks || [];
    campaignRun.deck = campaignRun.deck || [];
  }
  return campaignRun;
}

function saveCampaignRun() {
  if (!campaignRun) {
    localStorage.removeItem(CAMPAIGN_RUN_KEY);
    return;
  }
  localStorage.setItem(CAMPAIGN_RUN_KEY, JSON.stringify(campaignRun));
}

function abandonCampaignRun() {
  if (!window.confirm('Abandon this investigation run?')) return;
  campaignRun = null;
  saveCampaignRun();
  openCampaignHub();
}

async function openCampaignHub() {
  loadCampaignRun();
  try {
    campaignSummaries = await api('GET', '/api/campaign');
  } catch (e) {
    alert('Campaign data unavailable: ' + e.message);
    return;
  }
  const list = document.getElementById('campaign-chapter-list');
  list.innerHTML = campaignSummaries.map((ch) => `
    <button type="button" class="campaign-chapter-card" onclick="startCampaignChapter('${ch.id}')">
      <h3>${ch.name || ch.id}</h3>
      <p>${ch.description || ''}</p>
      <small>${(ch.faction || '').toUpperCase()} · ${ch.status || 'available'}</small>
    </button>
  `).join('') || '<p class="lede">No chapters found.</p>';
  const cont = document.getElementById('btn-campaign-continue');
  if (cont) cont.hidden = !campaignRun;
  renderCampaignLedgerPanel(true);
  showScreen('screen-campaign');
}

async function continueCampaignRun() {
  loadCampaignRun();
  if (!campaignRun) return openCampaignHub();
  await ensureCampaignChapter(campaignRun.chapter_id);
  renderCampaignMap();
  showScreen('screen-campaign-map');
}

async function ensureCampaignChapter(chapterId) {
  if (campaignChapter && campaignChapter.id === chapterId) return campaignChapter;
  campaignChapter = await api('GET', `/api/campaign/${chapterId}`);
  return campaignChapter;
}

async function ensureStarterDeck(starterId) {
  if (typeof curatedDecks === 'undefined' || !curatedDecks || !curatedDecks.presets) {
    try {
      curatedDecks = await api('GET', '/api/decks');
    } catch (e) {
      curatedDecks = { presets: [] };
    }
  }
  if (typeof allCards === 'undefined' || !allCards || !allCards.length) {
    try {
      allCards = await api('GET', '/api/cards');
    } catch (e) { /* names stay as ids */ }
  }
  let ids = expandPresetIds(starterId);
  if (!ids.length) {
    const city = (campaignChapter.board_data || {}).city;
    const alley = (city && city.nodes || []).find((n) => n.id === 'alley_contact');
    ids = (alley && alley.player_deck) ? alley.player_deck.slice() : [];
  }
  return ids;
}

async function startCampaignChapter(chapterId) {
  await ensureCampaignChapter(chapterId);
  const starterId = campaignChapter.starter_deck_id || 'campaign_illuminati_city_starter';
  const boardId = (campaignChapter.boards && campaignChapter.boards[0]) || 'city';
  const board = (campaignChapter.board_data || {})[boardId];
  if (!board) {
    alert('Board missing for chapter');
    return;
  }
  const starter = await ensureStarterDeck(starterId);
  campaignRun = {
    chapter_id: chapterId,
    board_id: boardId,
    difficulty: 'normal',
    phase: 'forward',
    cleared: [],
    reverse_cleared: [],
    ledger: [],
    flags: {},
    armory_picks: [],
    deck_id: starterId,
    deck: starter.slice(),
    deck_live: false,
    player_name: 'Recruit',
  };
  saveCampaignRun();
  enterBoardStart(board);
}

function enterBoardStart(board) {
  const start = board.start_node || (board.nodes[0] && board.nodes[0].id);
  const startNode = (board.nodes || []).find((n) => n.id === start);
  if (startNode && startNode.type === 'story') {
    playCampaignStory(startNode, () => {
      markCampaignNodeCleared(startNode);
      renderCampaignMap();
      showScreen('screen-campaign-map');
    });
  } else {
    renderCampaignMap();
    showScreen('screen-campaign-map');
  }
}

async function transitionToBoard(boardId, storyNote) {
  await ensureCampaignChapter(campaignRun.chapter_id);
  const board = (campaignChapter.board_data || {})[boardId];
  if (!board) {
    alert('Next board missing: ' + boardId);
    return;
  }
  campaignRun.board_id = boardId;
  campaignRun.phase = 'forward';
  campaignRun.cleared = [];
  campaignRun.reverse_cleared = [];
  saveCampaignRun();
  if (storyNote) {
    playCampaignStory({
      title: board.name || boardId,
      story_panels: [{ text: storyNote }],
    }, () => enterBoardStart(board));
  } else {
    enterBoardStart(board);
  }
}

function currentCampaignBoard() {
  if (!campaignChapter || !campaignRun) return null;
  return (campaignChapter.board_data || {})[campaignRun.board_id] || null;
}

function reverseQueue() {
  const board = currentCampaignBoard();
  let q = (board && board.reverse_order) || [];
  const skip = campaignRun && campaignRun.flags && campaignRun.flags.skip_reverse_node;
  if (skip) q = q.filter((id) => id !== skip);
  return q;
}

function reverseAllClear() {
  const q = reverseQueue();
  return q.length > 0 && q.every((id) => (campaignRun.reverse_cleared || []).includes(id));
}

function isCampaignNodeUnlocked(node) {
  if (!campaignRun || !node) return false;
  const phase = campaignRun.phase || 'forward';

  if (node.boss_requires_reverse_clear) {
    return phase === 'boss' || (phase === 'reverse' && reverseAllClear()) || phase === 'done';
  }

  if (phase === 'reverse') {
    const q = reverseQueue();
    if (!q.includes(node.id)) return false;
    const cleared = campaignRun.reverse_cleared || [];
    if (cleared.includes(node.id)) return true; // replay
    const next = q.find((id) => !cleared.includes(id));
    return node.id === next;
  }

  if (phase === 'boss' || phase === 'done') {
    if (node.boss_requires_reverse_clear) return true;
    return (campaignRun.cleared || []).includes(node.id);
  }

  const req = node.requires || [];
  return req.every((id) => (campaignRun.cleared || []).includes(id));
}

function nodeDisplay(node) {
  const phase = campaignRun && campaignRun.phase;
  if (phase === 'reverse' && node.reverse) {
    return {
      title: node.reverse.title || node.title,
      type: node.reverse.type || 'combat',
      blurb: node.reverse.blurb || node.blurb,
      dialogue: node.reverse.dialogue || node.dialogue,
      coach: node.reverse.coach || 'ops',
    };
  }
  return {
    title: node.title,
    type: node.type,
    blurb: node.blurb,
    dialogue: node.dialogue,
    coach: node.coach,
  };
}

function isNodeClearedDisplay(node) {
  const phase = campaignRun.phase || 'forward';
  if (node.boss_requires_reverse_clear) {
    return !!(campaignRun.flags && campaignRun.flags.illuminati_chapter_complete);
  }
  if (phase === 'reverse' || phase === 'boss' || phase === 'done') {
    if (reverseQueue().includes(node.id) || (campaignRun.flags && campaignRun.flags.skip_reverse_node === node.id)) {
      if (campaignRun.flags && campaignRun.flags.skip_reverse_node === node.id) return true;
      return (campaignRun.reverse_cleared || []).includes(node.id);
    }
  }
  return (campaignRun.cleared || []).includes(node.id);
}

function renderRunKit() {
  const el = document.getElementById('campaign-run-kit');
  if (!el || !campaignRun) return;
  const deck = campaignRun.deck || [];
  const counts = {};
  deck.forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
  const note = campaignRun.flags && campaignRun.flags.last_deck_change
    ? campaignRun.flags.last_deck_change.replace('added:', 'Added ').replace('pruned:', 'Cut ').replace('skipped', 'Kept walking')
    : (campaignRun.deck_live ? 'Kit is live.' : 'Issued kit. The drop makes it yours.');
  const noteEl = document.getElementById('campaign-run-kit-note');
  const listEl = document.getElementById('campaign-run-kit-list');
  if (noteEl) noteEl.textContent = `${deck.length} cards · ${note}`;
  if (listEl) {
    listEl.innerHTML = Object.keys(counts).map((id) => {
      const name = cardNameById(id);
      return `<span class="kit-chip">${name} ×${counts[id]}</span>`;
    }).join('');
  }
}

function renderCampaignMap() {
  const board = currentCampaignBoard();
  if (!board || !campaignRun) return;
  const phase = campaignRun.phase || 'forward';
  let title = board.name || 'Investigation';
  let hint = board.map_hint || '';
  if (phase === 'reverse') {
    title += ' — Breach';
    hint = 'Fight back through the halls. Righteous Fortitude is active. Your kit is the one you built.';
  } else if (phase === 'boss') {
    title += ' — Exit';
    hint = 'The Grandmaster holds the entrance. Ops is on the radio.';
  } else if (phase === 'done') {
    title += ' — Secure';
    hint = 'Chapter complete. Review the ledger or abandon to restart.';
  }
  document.getElementById('campaign-board-title').textContent = title;
  document.getElementById('campaign-board-hint').textContent = hint;
  const map = document.getElementById('campaign-map');
  map.innerHTML = '';
  map.classList.toggle('phase-reverse', phase === 'reverse');
  map.classList.toggle('board-hq', campaignRun.board_id === 'hq');
  map.classList.toggle('board-city', campaignRun.board_id === 'city');

  (board.nodes || []).forEach((node) => {
    const disp = nodeDisplay(node);
    const cleared = isNodeClearedDisplay(node);
    const unlocked = isCampaignNodeUnlocked(node);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.nodeId = node.id;
    const inReversePath = reverseQueue().includes(node.id);
    const skipped = campaignRun.flags && campaignRun.flags.skip_reverse_node === node.id && phase !== 'forward';
    btn.className = 'campaign-node'
      + (cleared || skipped ? ' cleared' : '')
      + (!unlocked && !cleared && !skipped ? ' locked' : '')
      + (unlocked && !cleared ? ' available' : '')
      + (selectedCampaignNodeId === node.id ? ' selected' : '')
      + (phase === 'reverse' && inReversePath ? ' reverse-node' : '')
      + (skipped ? ' skipped-node' : '');
    btn.style.left = `${((node.map && node.map.x != null) ? node.map.x : 0.5) * 100}%`;
    btn.style.top = `${((node.map && node.map.y != null) ? node.map.y : 0.5) * 100}%`;
    btn.disabled = !unlocked && !cleared && !skipped;
    const typeLabel = skipped
      ? 'elevator'
      : (phase === 'reverse' && inReversePath && !cleared ? 'breach' : (disp.type || 'node'));
    btn.innerHTML = `<span class="node-type">${typeLabel}</span>${disp.title || node.id}`;
    btn.onclick = () => selectCampaignNode(node.id);
    map.appendChild(btn);
  });
  renderCampaignLedgerPanel(false);
  renderRunKit();
}

function selectCampaignNode(nodeId) {
  const board = currentCampaignBoard();
  const node = (board.nodes || []).find((n) => n.id === nodeId);
  if (!node) return;
  selectedCampaignNodeId = nodeId;
  renderCampaignMap();
  const disp = nodeDisplay(node);
  const detail = document.getElementById('campaign-node-detail');
  detail.hidden = false;
  document.getElementById('campaign-node-title').textContent = disp.title || node.id;
  document.getElementById('campaign-node-blurb').textContent = disp.blurb || '';
  const coach = nodeCoach({ ...node, coach: disp.coach });
  let line = '';
  if (coach === 'silent') {
    line = 'Radio dead.';
  } else if (disp.dialogue && disp.dialogue[0]) {
    const speaker = disp.dialogue[0].speaker || (coach === 'ops' ? 'Ops' : 'Recruiter');
    line = `${speaker}: ${disp.dialogue[0].text || ''}`;
  }
  document.getElementById('campaign-node-dialogue').textContent = line;
  const go = document.getElementById('btn-campaign-node-go');
  const skipped = campaignRun.flags && campaignRun.flags.skip_reverse_node === node.id
    && (campaignRun.phase === 'reverse' || campaignRun.phase === 'boss' || campaignRun.phase === 'done');
  const cleared = isNodeClearedDisplay(node);
  go.textContent = skipped ? 'Skipped' : (cleared ? 'Replay' : 'Enter');
  go.disabled = skipped || (!isCampaignNodeUnlocked(node) && !cleared);
}

function clearCampaignNodeSelection() {
  selectedCampaignNodeId = null;
  const detail = document.getElementById('campaign-node-detail');
  if (detail) detail.hidden = true;
  renderCampaignMap();
}

function storyPanelsForNode(node) {
  if (!node) return [];
  const flags = (campaignRun && campaignRun.flags) || {};
  if (flags.skipped_safe_drop && node.story_panels_reckless && node.story_panels_reckless.length) {
    return node.story_panels_reckless.slice();
  }
  return (node.story_panels || node.story_panels_on_enter || []).slice();
}

function playCampaignStory(node, onDone) {
  storyQueue = storyPanelsForNode(node);
  if (!storyQueue.length) {
    if (onDone) onDone();
    return;
  }
  storyQueueIndex = 0;
  storyOnDone = onDone;
  document.getElementById('story-title').textContent = node.title || 'Briefing';
  document.getElementById('story-panel-text').textContent = storyQueue[0].text || '';
  document.getElementById('btn-story-next').textContent =
    storyQueue.length > 1 ? 'Next' : 'Continue';
  showScreen('screen-story');
}

function advanceStoryPanel() {
  storyQueueIndex += 1;
  if (storyQueueIndex >= storyQueue.length) {
    const done = storyOnDone;
    storyOnDone = null;
    storyQueue = [];
    if (done) done();
    return;
  }
  document.getElementById('story-panel-text').textContent = storyQueue[storyQueueIndex].text || '';
  document.getElementById('btn-story-next').textContent =
    storyQueueIndex >= storyQueue.length - 1 ? 'Continue' : 'Next';
}

function markCampaignNodeCleared(node) {
  if (!campaignRun || !node) return;
  const phase = campaignRun.phase || 'forward';
  const rewards = node.rewards || {};

  if (phase === 'reverse' && reverseQueue().includes(node.id)) {
    if (!campaignRun.reverse_cleared.includes(node.id)) {
      campaignRun.reverse_cleared.push(node.id);
    }
    if (reverseAllClear()) {
      campaignRun.phase = 'boss';
    }
  } else if (!node.boss_requires_reverse_clear) {
    if (!campaignRun.cleared.includes(node.id)) campaignRun.cleared.push(node.id);
  }

  (rewards.ledger_ids || []).forEach((id) => {
    if (!campaignRun.ledger.includes(id)) campaignRun.ledger.push(id);
  });
  Object.assign(campaignRun.flags || {}, rewards.flags || {});

  if (node.triggers_reverse) {
    campaignRun.phase = 'reverse';
    campaignRun.reverse_cleared = campaignRun.reverse_cleared || [];
    const skip = campaignRun.flags.skip_reverse_node;
    if (skip && !campaignRun.reverse_cleared.includes(skip)) {
      campaignRun.reverse_cleared.push(skip);
      if (!campaignRun.ledger.includes('file_elevator')) {
        campaignRun.ledger.push('file_elevator');
      }
    }
    if (reverseAllClear()) campaignRun.phase = 'boss';
  }

  if (rewards.flags && rewards.flags.illuminati_chapter_complete) {
    campaignRun.phase = 'done';
  }

  saveCampaignRun();

  if (rewards.next_board && rewards.next_board !== campaignRun.board_id) {
    const next = rewards.next_board;
    const note = (campaignRun.flags && campaignRun.flags.skipped_safe_drop)
      ? 'You reach the Lodge beneath the city. Ops is already on the radio. Reckless on the street, they say.'
      : 'You reach the Lodge beneath the city. The Recruiter\'s badge is already in a burn bag. Ops takes the channel.';
    setTimeout(() => {
      transitionToBoard(next, note);
    }, 50);
  }
}

function resolveMatchConfig(node) {
  const phase = campaignRun.phase || 'forward';
  if ((phase === 'reverse' || phase === 'boss') && node.reverse && reverseQueue().includes(node.id)) {
    return { ...node, ...node.reverse, id: node.id, rewards: node.rewards, steps: node.reverse.steps || node.steps };
  }
  return node;
}

function matchPlayerDeck(raw, resolved) {
  const mode = resolved.player_deck_mode || raw.player_deck_mode || 'scripted';
  if (mode === 'scripted' && resolved.player_deck && resolved.player_deck.length) {
    return { player_deck: resolved.player_deck, shuffle: resolved.shuffle !== false };
  }
  let deck = (campaignRun.deck || []).slice();
  if (!deck.length) deck = expandPresetIds(campaignRun.deck_id || 'campaign_illuminati_city_starter');
  if (mode === 'run_teach') {
    const seeds = resolved.teach_seed_ids || raw.teach_seed_ids || [];
    deck = seedTeachFront(deck, seeds);
    return { player_deck: deck, shuffle: false };
  }
  return { player_deck: deck, shuffle: resolved.shuffle !== false };
}

function setCoachRadio(node, resolved) {
  const coach = nodeCoach(resolved || node);
  campaignCoachLine = null;
  const el = document.getElementById('match-banner-coach');
  if (coach === 'silent') {
    campaignCoachLine = { speaker: '', text: 'Radio dead. Survive.' };
  } else {
    const dialogue = (resolved && resolved.dialogue) || node.dialogue || [];
    if (dialogue[0]) {
      campaignCoachLine = {
        speaker: dialogue[0].speaker || (coach === 'ops' ? 'Ops' : 'Recruiter'),
        text: dialogue[0].text || '',
      };
    }
  }
  if (el) {
    if (campaignCoachLine) {
      el.textContent = campaignCoachLine.speaker
        ? `${campaignCoachLine.speaker}: ${campaignCoachLine.text}`
        : campaignCoachLine.text;
    } else el.textContent = '';
  }
}

async function activateSelectedCampaignNode() {
  const board = currentCampaignBoard();
  if (!board || !selectedCampaignNodeId) return;
  const raw = (board.nodes || []).find((n) => n.id === selectedCampaignNodeId);
  if (!raw) return;
  const node = resolveMatchConfig(raw);
  pendingCampaignNode = raw;

  if (campaignRun.flags && campaignRun.flags.skip_reverse_node === raw.id
      && (campaignRun.phase === 'reverse' || campaignRun.phase === 'boss')) {
    return;
  }

  if (raw.type === 'story' || node.type === 'story') {
    playCampaignStory(node, () => {
      markCampaignNodeCleared(raw);
      if (raw.triggers_reverse && campaignRun.flags && campaignRun.flags.skip_reverse_node) {
        const skipId = campaignRun.flags.skip_reverse_node;
        const skipNode = (board.nodes || []).find((n) => n.id === skipId);
        const blurb = (skipNode && skipNode.reverse && skipNode.reverse.skip_blurb)
          || 'Service elevator. That hall stays behind you.';
        playCampaignStory({ title: 'Back stair', story_panels: [{ text: blurb }] }, () => {
          renderCampaignMap();
          showScreen('screen-campaign-map');
        });
        return;
      }
      renderCampaignMap();
      showScreen('screen-campaign-map');
    });
    return;
  }

  if (raw.type === 'safehouse') {
    openSafehouse(raw);
    return;
  }

  const startMatch = async () => {
    const ai = node.ai || {};
    let aiFaction = ai.faction || 'templars';
    if (aiFaction === 'neutral' || aiFaction === 'network') aiFaction = 'illuminati';
    const matchOptions = {
      lesson_win: node.lesson_win || raw.lesson_win,
      lesson_loss: node.lesson_loss || raw.lesson_loss,
    };
    if (node.ai_starting_life != null) matchOptions.ai_starting_life = node.ai_starting_life;
    if (node.player_starting_life != null) matchOptions.player_starting_life = node.player_starting_life;
    if (node.crisis && node.crisis.win === 'survive_turns') {
      matchOptions.win_condition = 'survive_turns';
      matchOptions.survive_turns = node.crisis.turns || 5;
      matchOptions.survive_defender = (campaignRun && campaignRun.player_name) || 'Recruit';
      matchOptions.crisis_label = node.crisis.label || node.title;
    }
    if (node.twist && node.twist.match_modifiers) {
      matchOptions.match_modifiers = {
        ...(matchOptions.match_modifiers || {}),
        ...node.twist.match_modifiers,
      };
      matchOptions.twist_label = node.twist.label;
      matchOptions.twist_description = node.twist.description;
    }

    const deckPayload = matchPlayerDeck(raw, node);
    const payload = {
      player_name: (campaignRun && campaignRun.player_name) || 'Recruit',
      player_faction: (campaignChapter && campaignChapter.faction) || 'illuminati',
      ai_faction: aiFaction,
      ai_name: ai.name || 'Opponent',
      difficulty: ai.difficulty || 'easy',
      mode: 'campaign',
      first_player: node.player_goes_first === false ? 1 : 0,
      shuffle: deckPayload.shuffle,
      campaign: {
        chapter_id: campaignRun.chapter_id,
        board_id: campaignRun.board_id,
        node_id: raw.id,
        node_title: node.title || raw.title,
        phase: campaignRun.phase,
        teach: !!node.teach,
        coach: nodeCoach(node),
      },
      match_options: matchOptions,
      player_deck: deckPayload.player_deck,
    };
    if (node.ai_deck && node.ai_deck.length) payload.ai_deck = node.ai_deck;

    await beginMatch(payload, { skipMulligan: true });
    setCoachRadio(raw, node);
    let steps = node.steps && node.steps.length ? node.steps.slice() : null;
    if (steps && (node.player_deck_mode === 'run_teach' || raw.player_deck_mode === 'run_teach')) {
      const seeds = node.teach_seed_ids || raw.teach_seed_ids || [];
      const kit = campaignRun.deck || [];
      steps = steps.map((step) => {
        const req = step.require || '';
        if (!req.startsWith('play_named:')) return step;
        const want = req.slice('play_named:'.length);
        const seedId = seeds[0];
        const seedName = seedId ? cardNameById(seedId) : want;
        if (want !== seedName && !kit.some((id) => cardNameById(id) === want) && !seeds.length) {
          return { ...step, require: 'free' };
        }
        return step;
      });
    }
    if (steps && steps.length && node.teach !== false) {
      encounter = { id: raw.id, name: node.title, steps, teach: true };
      resetCampaignTeach();
      if (typeof renderTutorialHint === 'function') renderTutorialHint();
      if (typeof render === 'function') render();
    } else {
      encounter = null;
    }
    if (typeof updateMatchBanner === 'function') updateMatchBanner();
  };

  if (node.story_panels_on_enter && node.story_panels_on_enter.length) {
    playCampaignStory({ title: node.title, story_panels: node.story_panels_on_enter }, startMatch);
  } else {
    await startMatch();
  }
}

/* --- Safehouse pick-one --- */
function openSafehouse(node) {
  pendingSafehouseNode = node;
  const sh = node.safehouse || {};
  const picks = sh.pick_one_of || [];
  if (!picks.length) {
    markCampaignNodeCleared(node);
    window.alert(sh.text || node.blurb || 'Safe house visit complete.');
    renderCampaignMap();
    showScreen('screen-campaign-map');
    return;
  }
  document.getElementById('safehouse-title').textContent = node.title || 'Safehouse';
  document.getElementById('safehouse-text').textContent = sh.text || node.blurb || 'Choose one.';
  const box = document.getElementById('safehouse-choices');
  box.innerHTML = picks.map((p, i) => `
    <button type="button" class="campaign-chapter-card" onclick="confirmSafehousePick(${i})">
      <h3>${p.label || p.id}</h3>
      <p>${p.blurb || ''}</p>
    </button>
  `).join('');
  showScreen('screen-safehouse');
}

function confirmSafehousePick(index) {
  const node = pendingSafehouseNode;
  if (!node) return;
  const picks = (node.safehouse && node.safehouse.pick_one_of) || [];
  const pick = picks[index];
  if (pick) {
    applySafehousePickToRun(pick);
    campaignRun.armory_picks = campaignRun.armory_picks || [];
    campaignRun.armory_picks.push({
      id: pick.id,
      label: pick.label,
      action: pick.action,
      node: node.id,
      board: campaignRun.board_id,
    });
    if (pick.action === 'inject' || pick.action === 'add') {
      if (!campaignRun.ledger.includes('file_armory_pick') && node.id === 'hq_armory') {
        campaignRun.ledger.push('file_armory_pick');
      }
    }
  }
  markCampaignNodeCleared(node);
  pendingSafehouseNode = null;
  renderCampaignMap();
  showScreen('screen-campaign-map');
}

/* --- Ledger --- */
function ledgerCatalog() {
  const boards = (campaignChapter && campaignChapter.board_data) || {};
  const cat = {};
  Object.values(boards).forEach((b) => {
    Object.assign(cat, b.ledger || {});
  });
  cat.file_armory_pick = {
    title: 'File: Armory Selection',
    text: campaignRun && campaignRun.flags && campaignRun.flags.last_armory_pick
      ? `Sleeved into the kit: ${campaignRun.flags.last_armory_pick}.`
      : 'You claimed a black-budget tool.',
  };
  cat.file_elevator = {
    title: 'File: Service Elevator',
    text: 'Puppet Master knew a back stair. Soft Exile was never contested.',
  };
  return cat;
}

function renderCampaignLedgerPanel(onHub) {
  const el = document.getElementById(onHub ? 'campaign-ledger-hub' : 'campaign-ledger-map');
  if (!el) return;
  loadCampaignRun();
  if (!campaignRun || !(campaignRun.ledger || []).length) {
    el.innerHTML = '<p class="lede">Investigation Ledger empty.</p>';
    return;
  }
  const cat = ledgerCatalog();
  el.innerHTML = `<h3>Investigation Ledger</h3><ul class="ledger-list">${
    campaignRun.ledger.map((id) => {
      const e = cat[id] || { title: id, text: '' };
      return `<li><strong>${e.title || id}</strong><span>${e.text || ''}</span></li>`;
    }).join('')
  }</ul>`;
}

function updateMatchBanner() {
  const banner = document.getElementById('match-banner');
  if (!banner || !state) {
    if (banner) banner.hidden = true;
    return;
  }
  const twistEl = document.getElementById('match-banner-twist');
  const crisisEl = document.getElementById('match-banner-crisis');
  const coachEl = document.getElementById('match-banner-coach');
  let show = false;
  if (state.twist && state.twist.label) {
    twistEl.textContent = `Twist: ${state.twist.label}${state.twist.description ? ' — ' + state.twist.description : ''}`;
    show = true;
  } else if (twistEl) twistEl.textContent = '';
  if (state.crisis) {
    crisisEl.textContent = `${state.crisis.label || 'Survive'}: ${state.crisis.turns_completed || 0} / ${state.crisis.turns_required || '?'} turns`;
    show = true;
  } else if (crisisEl) crisisEl.textContent = '';
  if (coachEl) {
    if (campaignCoachLine) {
      coachEl.textContent = campaignCoachLine.speaker
        ? `${campaignCoachLine.speaker}: ${campaignCoachLine.text}`
        : campaignCoachLine.text;
      show = true;
    } else coachEl.textContent = '';
  }
  banner.hidden = !show;
}

function returnToCampaignMap() {
  if (sessionId) {
    api('DELETE', `/api/game/${sessionId}`).catch(() => {});
  }
  sessionId = null;
  state = null;
  pendingCampaignNode = null;
  campaignCoachLine = null;
  document.getElementById('game-over').hidden = true;
  loadCampaignRun();
  ensureCampaignChapter(campaignRun.chapter_id).then(() => {
    renderCampaignMap();
    showScreen('screen-campaign-map');
  });
}

function onCampaignMatchFinished(recap) {
  const btn = document.getElementById('btn-campaign-return');
  if (btn) btn.hidden = gameMode !== 'campaign';
  if (gameMode !== 'campaign' || !pendingCampaignNode || !campaignRun) return;
  const youWon = !!(recap && (recap.you_won || recap.winner === myPlayerName));
  if (youWon) markCampaignNodeCleared(pendingCampaignNode);
}

function resetCampaignTeach() {
  campaignTeachDone = new Set();
  if (typeof dismissedHints !== 'undefined' && dismissedHints && dismissedHints.clear) {
    dismissedHints.clear();
  }
}

function campaignActiveTeachStep() {
  if (gameMode !== 'campaign' || !encounter || !encounter.steps || !encounter.steps.length) {
    return null;
  }
  for (const step of encounter.steps) {
    if ((step.require || 'free') === 'free') return step;
    if (!campaignTeachDone.has(step.id)) return step;
  }
  return encounter.steps[encounter.steps.length - 1];
}

function noteCampaignTeach(kind, detail) {
  if (gameMode !== 'campaign' || !encounter || !encounter.steps) return;
  const step = campaignActiveTeachStep();
  if (!step || (step.require || 'free') === 'free') return;
  const req = step.require || '';
  let met = false;
  if (kind === 'play' && req.startsWith('play_named:')) {
    met = detail === req.slice('play_named:'.length);
  } else if (kind === 'end_turn' && req === 'end_turn') met = true;
  else if (kind === 'attack' && req === 'attack') met = true;
  else if (kind === 'attack_taunt' && req === 'attack_taunt') met = true;
  if (met) {
    campaignTeachDone.add(step.id);
    if (typeof renderTutorialHint === 'function') renderTutorialHint();
    if (typeof render === 'function') render();
  }
}

function currentCampaignTeachStep() {
  return campaignActiveTeachStep();
}

(function patchCampaignHooks() {
  const prevIsGuided = window.isGuidedMode;
  window.isGuidedMode = function patchedIsGuidedMode() {
    if (gameMode === 'campaign' && encounter && encounter.steps && encounter.steps.length) return true;
    return typeof prevIsGuided === 'function' ? prevIsGuided() : false;
  };

  const prevStep = window.currentTutorialStep;
  window.currentTutorialStep = function patchedCurrentTutorialStep() {
    if (gameMode === 'campaign' && encounter && encounter.steps && encounter.steps.length) {
      return currentCampaignTeachStep();
    }
    return typeof prevStep === 'function' ? prevStep() : null;
  };

  const prevRender = window.render;
  if (typeof prevRender === 'function') {
    window.render = function patchedRender() {
      prevRender.apply(this, arguments);
      try { updateMatchBanner(); } catch (e) { /* ignore */ }
    };
  }
  const prevRecap = window.renderRecap;
  if (typeof prevRecap === 'function') {
    window.renderRecap = function patchedRenderRecap(recap) {
      prevRecap.apply(this, arguments);
      try { onCampaignMatchFinished(recap); } catch (e) { /* ignore */ }
    };
  }

  const wrap = (name, after) => {
    const prev = window[name];
    if (typeof prev !== 'function') return;
    window[name] = async function wrapped() {
      const beforeHand = state && typeof getMyPlayer === 'function' && getMyPlayer()
        ? (getMyPlayer().hand || []).map((c) => c.name)
        : [];
      const result = await prev.apply(this, arguments);
      try { after(beforeHand); } catch (e) { /* ignore */ }
      return result;
    };
  };

  wrap('submitEndTurn', () => noteCampaignTeach('end_turn'));
  wrap('submitPlay', (beforeHand) => {
    const me = typeof getMyPlayer === 'function' ? getMyPlayer() : null;
    if (!me) return;
    const afterNames = (me.hand || []).map((c) => c.name);
    const boardNames = (me.board || []).map((c) => c.name);
    for (const n of beforeHand) {
      if (beforeHand.filter((x) => x === n).length > afterNames.filter((x) => x === n).length) {
        noteCampaignTeach('play', n);
      }
    }
    const step = campaignActiveTeachStep();
    if (step && (step.require || '').startsWith('play_named:')) {
      const want = step.require.slice('play_named:'.length);
      if (boardNames.includes(want)) noteCampaignTeach('play', want);
    }
  });
  wrap('submitAttack', () => {
    const step = campaignActiveTeachStep();
    if (step && step.require === 'attack_taunt') noteCampaignTeach('attack_taunt');
    else noteCampaignTeach('attack');
  });
})();
