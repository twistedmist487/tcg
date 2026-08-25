/**
 * Campaign — Investigation Board (M2 City + M3 HQ reverse / ledger).
 * Loaded after app.js
 */
const CAMPAIGN_RUN_KEY = 'conspiracy_campaign_run_v1';
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

async function startCampaignChapter(chapterId) {
  await ensureCampaignChapter(chapterId);
  const starterId = campaignChapter.starter_deck_id || 'campaign_illuminati_city_starter';
  const boardId = (campaignChapter.boards && campaignChapter.boards[0]) || 'city';
  const board = (campaignChapter.board_data || {})[boardId];
  if (!board) {
    alert('Board missing for chapter');
    return;
  }
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
  return (board && board.reverse_order) || [];
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
    // next uncleared in reverse order
    const next = q.find((id) => !cleared.includes(id));
    return node.id === next;
  }

  if (phase === 'boss' || phase === 'done') {
    if (node.boss_requires_reverse_clear) return true;
    // allow revisiting forward nodes as cleared
    return (campaignRun.cleared || []).includes(node.id);
  }

  // forward
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
    };
  }
  return {
    title: node.title,
    type: node.type,
    blurb: node.blurb,
    dialogue: node.dialogue,
  };
}

function isNodeClearedDisplay(node) {
  const phase = campaignRun.phase || 'forward';
  if (node.boss_requires_reverse_clear) {
    return !!(campaignRun.flags && campaignRun.flags.illuminati_chapter_complete);
  }
  if (phase === 'reverse' || phase === 'boss' || phase === 'done') {
    if (reverseQueue().includes(node.id)) {
      return (campaignRun.reverse_cleared || []).includes(node.id);
    }
  }
  return (campaignRun.cleared || []).includes(node.id);
}

function renderCampaignMap() {
  const board = currentCampaignBoard();
  if (!board || !campaignRun) return;
  const phase = campaignRun.phase || 'forward';
  let title = board.name || 'Investigation';
  let hint = board.map_hint || '';
  if (phase === 'reverse') {
    title += ' — Breach';
    hint = 'Fight back through the halls. Righteous Fortitude is active on Templar nodes.';
  } else if (phase === 'boss') {
    title += ' — Exit';
    hint = 'The Grandmaster holds the entrance.';
  } else if (phase === 'done') {
    title += ' — Secure';
    hint = 'Chapter complete. Review the ledger or abandon to restart.';
  }
  document.getElementById('campaign-board-title').textContent = title;
  document.getElementById('campaign-board-hint').textContent = hint;
  const map = document.getElementById('campaign-map');
  map.innerHTML = '';
  map.classList.toggle('phase-reverse', phase === 'reverse');

  (board.nodes || []).forEach((node) => {
    // Hide pure forward-only story gates during reverse? keep visible.
    const disp = nodeDisplay(node);
    const cleared = isNodeClearedDisplay(node);
    const unlocked = isCampaignNodeUnlocked(node);
    // During reverse, skip nodes not in reverse path except boss
    if (phase === 'reverse' && !reverseQueue().includes(node.id) && !node.boss_requires_reverse_clear && node.type === 'story') {
      // keep breach story visible as cleared
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.nodeId = node.id;
    const inReversePath = reverseQueue().includes(node.id);
    btn.className = 'campaign-node'
      + (cleared ? ' cleared' : '')
      + (!unlocked && !cleared ? ' locked' : '')
      + (unlocked && !cleared ? ' available' : '')
      + (selectedCampaignNodeId === node.id ? ' selected' : '')
      + (phase === 'reverse' && inReversePath ? ' reverse-node' : '');
    btn.style.left = `${((node.map && node.map.x != null) ? node.map.x : 0.5) * 100}%`;
    btn.style.top = `${((node.map && node.map.y != null) ? node.map.y : 0.5) * 100}%`;
    btn.disabled = !unlocked && !cleared;
    const typeLabel = phase === 'reverse' && inReversePath && !cleared ? 'breach' : (disp.type || 'node');
    btn.innerHTML = `<span class="node-type">${typeLabel}</span>${disp.title || node.id}`;
    btn.onclick = () => selectCampaignNode(node.id);
    map.appendChild(btn);
  });
  renderCampaignLedgerPanel(false);
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
  const line = (disp.dialogue && disp.dialogue[0])
    ? `${disp.dialogue[0].speaker || ''}: ${disp.dialogue[0].text || ''}`
    : '';
  document.getElementById('campaign-node-dialogue').textContent = line;
  const go = document.getElementById('btn-campaign-node-go');
  const cleared = isNodeClearedDisplay(node);
  go.textContent = cleared ? 'Replay' : 'Enter';
  go.disabled = !isCampaignNodeUnlocked(node) && !cleared;
}

function clearCampaignNodeSelection() {
  selectedCampaignNodeId = null;
  const detail = document.getElementById('campaign-node-detail');
  if (detail) detail.hidden = true;
  renderCampaignMap();
}

function playCampaignStory(node, onDone) {
  storyQueue = (node.story_panels || node.story_panels_on_enter || []).slice();
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
  }

  if (rewards.flags && rewards.flags.illuminati_chapter_complete) {
    campaignRun.phase = 'done';
  }

  saveCampaignRun();

  // Board handoff (City → HQ)
  if (rewards.next_board && rewards.next_board !== campaignRun.board_id) {
    const next = rewards.next_board;
    setTimeout(() => {
      transitionToBoard(
        next,
        'You reach the Lodge beneath the city. Training continues — until it doesn\'t.'
      );
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

async function activateSelectedCampaignNode() {
  const board = currentCampaignBoard();
  if (!board || !selectedCampaignNodeId) return;
  const raw = (board.nodes || []).find((n) => n.id === selectedCampaignNodeId);
  if (!raw) return;
  const node = resolveMatchConfig(raw);
  pendingCampaignNode = raw;

  if (raw.type === 'story' || node.type === 'story') {
    playCampaignStory(node, () => {
      markCampaignNodeCleared(raw);
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
    if (aiFaction === 'neutral' || aiFaction === 'network') aiFaction = 'reptilians';
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

    const payload = {
      player_name: (campaignRun && campaignRun.player_name) || 'Recruit',
      player_faction: (campaignChapter && campaignChapter.faction) || 'illuminati',
      ai_faction: aiFaction,
      ai_name: ai.name || 'Opponent',
      difficulty: ai.difficulty || 'easy',
      mode: 'campaign',
      first_player: node.player_goes_first === false ? 1 : 0,
      shuffle: node.shuffle !== false,
      campaign: {
        chapter_id: campaignRun.chapter_id,
        board_id: campaignRun.board_id,
        node_id: raw.id,
        node_title: node.title || raw.title,
        phase: campaignRun.phase,
        teach: !!node.teach,
      },
      match_options: matchOptions,
    };
    if (node.player_deck && node.player_deck.length) payload.player_deck = node.player_deck;
    else payload.player_deck_id = campaignRun.deck_id || campaignChapter.starter_deck_id;
    if (node.ai_deck && node.ai_deck.length) payload.ai_deck = node.ai_deck;

    await beginMatch(payload, { skipMulligan: true });
    if (node.steps && node.steps.length) {
      encounter = { id: raw.id, name: node.title, steps: node.steps, teach: true };
      resetCampaignTeach();
      if (typeof renderTutorialHint === 'function') renderTutorialHint();
      if (typeof render === 'function') render();
    } else {
      encounter = null;
    }
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
    campaignRun.armory_picks = campaignRun.armory_picks || [];
    campaignRun.armory_picks.push({
      id: pick.id,
      label: pick.label,
      node: node.id,
      board: campaignRun.board_id,
    });
    if (!campaignRun.ledger.includes('file_armory_pick')) {
      // dynamic ledger line
      campaignRun.ledger.push('file_armory_pick');
    }
    campaignRun.flags = campaignRun.flags || {};
    campaignRun.flags.last_armory_pick = pick.label || pick.id;
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
  // dynamic pick
  cat.file_armory_pick = {
    title: 'File: Armory Selection',
    text: campaignRun && campaignRun.flags && campaignRun.flags.last_armory_pick
      ? `You took: ${campaignRun.flags.last_armory_pick}.`
      : 'You claimed a black-budget tool.',
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
  let show = false;
  if (state.twist && state.twist.label) {
    twistEl.textContent = `Twist: ${state.twist.label}${state.twist.description ? ' — ' + state.twist.description : ''}`;
    show = true;
  } else twistEl.textContent = '';
  if (state.crisis) {
    crisisEl.textContent = `${state.crisis.label || 'Survive'}: ${state.crisis.turns_completed || 0} / ${state.crisis.turns_required || '?'} turns`;
    show = true;
  } else crisisEl.textContent = '';
  banner.hidden = !show;
}

function returnToCampaignMap() {
  if (sessionId) {
    api('DELETE', `/api/game/${sessionId}`).catch(() => {});
  }
  sessionId = null;
  state = null;
  pendingCampaignNode = null;
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
