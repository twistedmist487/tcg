/**
 * Conspiracy TCG — single-player web client.
 */

const API = '';
const FACTIONS = [
  { id: 'illuminati', name: 'Illuminati', energy: 'Influence', icon: '☠' },
  { id: 'templars', name: 'Templars', energy: 'Faith', icon: '✡' },
  { id: 'reptilians', name: 'Reptilians', energy: 'Psionics', icon: '▲' },
];
const DECK_STORAGE_KEY = 'conspiracy_decks_v1';
const BOARD_SLOTS = 7;

const KEYWORD_GLOSSARY = [
  { name: 'Taunt', example: 'Squire', text: 'Enemies must attack a Taunt character first.' },
  { name: 'Stealth', example: 'Shape-Shifter Infiltrator', text: 'Cannot be targeted until it attacks. You may hit face instead.' },
  { name: 'Silence', example: 'Media Blackout', text: 'Strips abilities, Taunt, and Stealth from a character or location.' },
  { name: 'Exhausted', example: 'Squire', text: 'Cannot attack. New characters enter exhausted unless they have Charge or Rush.' },
  { name: 'Charge', example: 'Zealot', text: 'Can attack anyone, including the hero, the turn it is played.' },
  { name: 'Rush', example: 'Raptor Swarm', text: 'Can attack characters the turn it is played, but not the hero.' },
  { name: 'Shielding', example: 'Templar walls', text: 'Ignores the next instance of damage, then pops.' },
  { name: 'Enraged', example: 'Second Strike', text: 'Can attack twice each turn. Persistent.' },
  { name: 'Assault', example: 'Hired Gun', text: 'Triggers when the character is played from hand (not when summoned).' },
  { name: 'Deathrattle', example: 'Hatchling Brood', text: 'Triggers when the character dies. Hatchling Brood summons a 2/1 Raptor.' },
  { name: 'Discovery', example: 'Open Channel', text: 'Choose 1 of 3 random cards from your faction plus the Network.' },
  { name: 'Drain', example: 'Leech Contact', text: 'Combat damage this deals heals its controller.' },
  { name: 'Venom', example: 'Toxin Needle', text: 'Any damage this deals to a character is lethal. Blocked by Ward or Shielding.' },
  { name: 'Recur', example: 'Sleeper Cell', text: 'The first time it dies, it returns at 1 Health. Deathrattle still fires.' },
  { name: 'Stasis', example: 'Black Ice', text: 'Cannot attack until the end of its controller’s next turn.' },
  { name: 'Amplify', example: 'Signal Booster', text: 'Your spells deal +1 damage per Amplify character you control.' },
  { name: 'Recycle', example: 'Burn Bag', text: 'Pay 1 energy: shuffle this from hand into your deck and draw.' },
  { name: 'Chain', example: 'Second Strike', text: 'Extra effect if you already played a card this turn.' },
  { name: 'Split', example: 'Forked Brief', text: 'Choose one printed option when you play it.' },
  { name: 'Echo', example: 'Carbon Copy', text: 'After you play this, add a copy to your hand that vanishes at end of turn.' },
  { name: 'Excess', example: 'Overpen', text: 'Extra effect if this deals more attack than the defender’s current Health.' },
  { name: 'Retaliate', example: 'Tripwire', text: 'Once: when this takes damage and survives.' },
  { name: 'Flash', example: 'Dead Drop Memo', text: 'Resolves immediately when drawn.' },
  { name: 'Manifest', example: 'Walk-In', text: 'Enters the board when drawn (no Assault).' },
  { name: 'Opening', example: 'Contingency', text: 'Fires once on your first turn start, from hand or deck.' },
  { name: 'Ward', example: 'Quiet Vest / Safe House', text: 'Ignore all damage until end of turn. Does not pop.' },
];

let state = null;
let sessionId = null;
let selectedCardIndex = null;
let selectedAttackerIndex = null;
let attackMode = false;
let myPlayerName = 'Player';
let gameMode = 'standard';
let encounter = null;
let allCards = [];
let encounters = [];
let curatedDecks = {};
let builderFaction = 'templars';
let builderList = [];
let setup = {
  playerFaction: 'templars',
  aiFaction: 'reptilians',
  difficulty: 'easy',
};
let mulliganSelected = new Set();
let dismissedHints = new Set();
let pendingSpellTarget = false;
let pendingTargetSide = 'enemy';
let pendingSplitIndex = null;
let tutorialProgress = {
  playedCharacter: false,
  attacked: false,
  attackedTaunt: false,
  playedSpell: false,
  playedLocation: false,
  playedCharge: false,
  sawDeathrattle: false,
  recycled: false,
  splitPlayed: false,
  playedDrain: false,
  drainAttacked: false,
  playedWard: false,
};

function resetTutorialProgress() {
  tutorialProgress = {
    playedCharacter: false,
    attacked: false,
    attackedTaunt: false,
    playedSpell: false,
    playedLocation: false,
    playedCharge: false,
    sawDeathrattle: false,
    recycled: false,
    splitPlayed: false,
    playedDrain: false,
    drainAttacked: false,
    playedWard: false,
  };
}

function isGuidedMode() {
  return !!(encounter && encounter.steps && encounter.steps.length
    && (gameMode === 'tutorial' || gameMode === 'lab'));
}

function isSkipMulliganMode(mode, encounterId) {
  return mode === 'tutorial' || mode === 'lab'
    || encounterId === 'tutorial' || encounterId === 'keyword_lab';
}

async function api(method, path, body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== null) opts.body = JSON.stringify(body);
  const resp = await fetch(API + path, opts);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    const detail = err.detail;
    throw new Error(typeof detail === 'string' ? detail : (err.detail && JSON.stringify(err.detail)) || `HTTP ${resp.status}`);
  }
  return resp.json();
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach((el) => {
    el.hidden = el.id !== id;
  });
  document.body.classList.toggle('in-match', id === 'screen-game');
}

function returnToMenu(force = false) {
  if (!force && sessionId && state && !state.is_over) {
    if (!window.confirm('Leave this match and return to the menu?')) return;
  }
  state = null;
  sessionId = null;
  encounter = null;
  gameMode = 'standard';
  selectedCardIndex = null;
  selectedAttackerIndex = null;
  attackMode = false;
  pendingSpellTarget = false;
  pendingTargetSide = 'enemy';
  dismissedHints = new Set();
  resetTutorialProgress();
  document.getElementById('game-over').hidden = true;
  document.getElementById('log').innerHTML = '';
  pinnedInspectCard = null;
  showDossier(null);
  showScreen('screen-menu');
}

function renderFactionButtons(containerId, selected, onPick) {
  const root = document.getElementById(containerId);
  root.innerHTML = FACTIONS.map((f) => `
    <div class="faction-btn ${f.id} ${selected === f.id ? 'selected' : ''}" data-faction="${f.id}">
      <span class="icon">${f.icon}</span>
      <span class="name">${f.name}</span>
      <span class="energy-type">${f.energy}</span>
    </div>
  `).join('');
  root.querySelectorAll('.faction-btn').forEach((btn) => {
    btn.addEventListener('click', () => onPick(btn.dataset.faction));
  });
}

function selectDifficulty(el) {
  document.querySelectorAll('[data-difficulty]').forEach((b) => b.classList.remove('selected'));
  el.classList.add('selected');
  setup.difficulty = el.dataset.difficulty;
}

function listPresets(faction) {
  return (curatedDecks.presets || []).filter((p) => !faction || p.faction === faction);
}

function populateSetupDecks() {
  const select = document.getElementById('setup-deck');
  const saved = loadSavedDecks().filter((d) => d.faction === setup.playerFaction);
  const curated = curatedDecks[setup.playerFaction];
  const options = [`<option value="curated">Curated: ${curated ? curated.name : 'Faction deck'}</option>`];
  listPresets(setup.playerFaction).forEach((preset) => {
    options.push(`<option value="preset:${preset.id}">${escHtml(preset.name)}</option>`);
  });
  saved.forEach((deck) => {
    options.push(`<option value="saved:${deck.id}">${escHtml(deck.name)}</option>`);
  });
  select.innerHTML = options.join('');

  const aiSelect = document.getElementById('setup-ai-deck');
  if (!aiSelect) return;
  const aiCurated = curatedDecks[setup.aiFaction];
  const aiOptions = [`<option value="curated">Curated: ${aiCurated ? aiCurated.name : 'Faction deck'}</option>`];
  listPresets(setup.aiFaction).forEach((preset) => {
    aiOptions.push(`<option value="preset:${preset.id}">${escHtml(preset.name)}</option>`);
  });
  aiSelect.innerHTML = aiOptions.join('');
}

function refreshSetup() {
  renderFactionButtons('setup-player-factions', setup.playerFaction, (id) => {
    setup.playerFaction = id;
    if (setup.aiFaction === id) {
      setup.aiFaction = FACTIONS.find((f) => f.id !== id).id;
    }
    refreshSetup();
  });
  renderFactionButtons('setup-ai-factions', setup.aiFaction, (id) => {
    setup.aiFaction = id;
    refreshSetup();
  });
  populateSetupDecks();
}

async function boot() {
  try {
    allCards = await api('GET', '/api/cards');
    encounters = await api('GET', '/api/encounters');
    curatedDecks = await api('GET', '/api/decks');
  } catch (e) {
    console.warn('Failed to preload data', e);
  }
  refreshSetup();
  renderFactionButtons('deck-factions', builderFaction, (id) => {
    builderFaction = id;
    builderList = [];
    document.getElementById('deck-name').value = `${titleCase(id)} Custom`;
    renderDeckBuilder();
  });
  refreshSavedDeckSelect();
  renderDeckBuilder();
  renderKeywordGlossary();
  showScreen('screen-menu');
  setupDragAndDrop();
  setupDossierInteractions();
  setupHandInteractions();
}

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function startTutorial() {
  await beginMatch({ encounter_id: 'tutorial', player_name: 'Recruit' }, { skipMulligan: true });
}

async function startKeywordLab() {
  await beginMatch({ encounter_id: 'keyword_lab', player_name: 'Operator' }, { skipMulligan: true });
}

async function startStandardGame() {
  const name = document.getElementById('player-name').value.trim() || 'Player';
  const deckChoice = document.getElementById('setup-deck').value;
  const payload = {
    player_name: name,
    player_faction: setup.playerFaction,
    ai_faction: setup.aiFaction,
    difficulty: setup.difficulty,
    mode: 'standard',
  };
  if (deckChoice.startsWith('saved:')) {
    const deck = loadSavedDecks().find((d) => d.id === deckChoice.slice(6));
    if (!deck) return alert('Saved deck not found.');
    payload.player_deck = deck.cards;
  } else if (deckChoice.startsWith('preset:')) {
    payload.player_deck_id = deckChoice.slice(7);
  }
  const aiChoice = (document.getElementById('setup-ai-deck') || {}).value || 'curated';
  if (aiChoice.startsWith('preset:')) {
    payload.ai_deck_id = aiChoice.slice(7);
  }
  await beginMatch(payload, { skipMulligan: false });
}

async function startEncounter(id) {
  const name = document.getElementById('player-name').value.trim() || 'Player';
  await beginMatch({ encounter_id: id, player_name: name }, { skipMulligan: isSkipMulliganMode(null, id) });
}

async function beginMatch(payload, { skipMulligan }) {
  try {
    const data = await api('POST', '/api/game/new', payload);
    sessionId = data.session_id;
    state = data.state;
    myPlayerName = data.player_name || payload.player_name || 'Player';
    gameMode = data.mode || 'standard';
    encounter = data.encounter || null;
    selectedCardIndex = null;
    selectedAttackerIndex = null;
    attackMode = false;
    pendingSpellTarget = false;
    pendingTargetSide = 'enemy';
    dismissedHints = new Set();
    resetTutorialProgress();
    document.getElementById('game-over').hidden = true;
    document.getElementById('log').innerHTML = '';
    pinnedInspectCard = null;
    showDossier(null);
    addLog(`${gameMode === 'tutorial' ? 'Tutorial' : (gameMode === 'lab' ? 'Keyword Lab' : 'Match')} started.`, 'turn');

    if (!skipMulligan && !isSkipMulliganMode(gameMode, payload.encounter_id)) {
      showScreen('screen-mulligan');
      renderMulligan();
      return;
    }
    showScreen('screen-game');
    await afterMulliganStart();
  } catch (e) {
    alert('Failed to start game: ' + e.message);
  }
}

function renderMulligan() {
  const me = getMyPlayer();
  const hand = me && me.hand ? me.hand : [];
  document.getElementById('mulligan-hand').innerHTML = hand.map((c, i) =>
    renderCardFace(c, mulliganSelected.has(i) ? 'selected' : '', `toggleMulligan(${i})`)
  ).join('');
}

function toggleMulligan(index) {
  if (mulliganSelected.has(index)) mulliganSelected.delete(index);
  else mulliganSelected.add(index);
  renderMulligan();
}

async function confirmMulligan() {
  try {
    const indices = [...mulliganSelected];
    await api('POST', `/api/game/${sessionId}/mulligan?player_name=${encodeURIComponent(myPlayerName)}`, { card_indices: indices });
    const opp = state.players.find((p) => p.name !== myPlayerName);
    if (opp) {
      await api('POST', `/api/game/${sessionId}/mulligan?player_name=${encodeURIComponent(opp.name)}`, { card_indices: [] });
    }
    mulliganSelected = new Set();
    showScreen('screen-game');
    await afterMulliganStart();
  } catch (e) {
    addLog('Mulligan failed: ' + e.message, 'damage');
  }
}

async function afterMulliganStart() {
  const startData = await api('POST', `/api/game/${sessionId}/start-turn`);
  state = startData.state || startData;
  if (state.active_player !== myPlayerName && !state.is_over) {
    addLog(`${state.active_player} goes first.`, 'turn');
    await runAITurn();
  } else {
    addLog('You go first.', 'turn');
  }
  await loadState();
}

async function loadState() {
  state = await api('GET', `/api/game/${sessionId}/state`);
  render();
}

function getMyPlayer() {
  if (!state) return null;
  return state.players.find((p) => p.name === myPlayerName) || state.players[0];
}

function getOpponent() {
  if (!state) return null;
  return state.players.find((p) => p.name !== myPlayerName) || state.players[1];
}

function render() {
  if (!state) return;
  const me = getMyPlayer();
  const opp = getOpponent();
  const isMyTurn = me && state.active_player === me.name;
  const turnStarted = !!state.turn_started;

  const myTurnCount = playerTurnCount(isMyTurn);
  const turnLabel = isGuidedMode() && myTurnCount
    ? `Your turn ${myTurnCount}`
    : `Turn ${state.turn || 1}`;
  document.getElementById('turn-info').innerHTML =
    `${turnLabel} — <span class="${isMyTurn ? 'energy' : ''}">${state.active_player}'s turn</span>`;
  document.getElementById('player-section').classList.toggle('active', isMyTurn);
  document.getElementById('opponent-section').classList.toggle('active', !isMyTurn);

  document.getElementById('opponent-name').textContent = opp.name;
  paintHeroFrame('opponent-section', opp.faction, 'opponent-portrait');
  const oppLife = document.getElementById('opponent-life');
  if (oppLife) oppLife.textContent = String(opp.life);
  const oppRole = document.getElementById('opponent-role');
  if (oppRole) oppRole.textContent = factionLabel(opp.faction);
  document.getElementById('opponent-stats').innerHTML = heroGuard(opp);
  document.getElementById('opponent-hand-count').textContent = opp.hand_size;
  document.getElementById('opponent-hand').innerHTML = renderHiddenHand(opp.hand_size);
  document.getElementById('opponent-location').innerHTML = renderLocation(opp.location, false);
  document.getElementById('opponent-board').innerHTML = renderBoard(opp.board, false);

  document.getElementById('player-name-display').textContent = me ? me.name : '?';
  if (me) {
    paintHeroFrame('player-section', me.faction, 'player-portrait');
    const myLife = document.getElementById('player-life');
    if (myLife) myLife.textContent = String(me.life);
    const myRole = document.getElementById('player-role');
    if (myRole) myRole.textContent = factionLabel(me.faction);
    document.getElementById('player-stats').innerHTML = heroGuard(me);
    const note = document.getElementById('player-plaque-note');
    const meter = document.getElementById('player-field-meter');
    const board = me.board || [];
    const n = board.length;
    const ready = board.filter((c) => c.attack > 0 && !c.exhausted).length;
    if (note) {
      note.textContent = ready ? `${ready} ready` : `${n} / ${BOARD_SLOTS}`;
    }
    if (meter) {
      meter.innerHTML = Array.from({ length: BOARD_SLOTS }, (_, i) => {
        const c = board[i];
        const filled = !!c;
        const isReady = filled && c.attack > 0 && !c.exhausted;
        const title = filled ? escHtml(c.name) : 'Empty slot';
        return `<span class="pip${filled ? ' filled' : ''}${isReady ? ' ready' : ''}" title="${title}"></span>`;
      }).join('');
    }
    document.getElementById('player-location').innerHTML = renderLocation(me.location, true);
    document.getElementById('player-board').innerHTML = renderBoard(me.board, true);
    document.getElementById('player-hand').innerHTML = renderHand(me.hand || [], me.energy);
    renderEnergyWell(me);
    renderDeckWell(me);
  }

  const pendingChoice = !!(state.pending_discovery || state.pending_split);
  const canAffordCard = isMyTurn && turnStarted && !pendingChoice && me && me.hand && me.hand.some((c) => me.energy >= c.cost);
  const canAttack = isMyTurn && turnStarted && !pendingChoice && me && me.board && me.board.some((c) => c.attack > 0 && !c.exhausted);
  const selectedAtk = (selectedAttackerIndex !== null && me && me.board) ? me.board[selectedAttackerIndex] : null;
  const canFace = canAttack && canAttackFace(opp) && !(selectedAtk && selectedAtk.rush_locked);
  const selectedCard = (selectedCardIndex !== null && me && me.hand) ? me.hand[selectedCardIndex] : null;
  const canRecycle = isMyTurn && turnStarted && !pendingChoice && selectedCard && selectedCard.recycle && me.energy >= 1;
  const step = currentTutorialStep();

  // Hearthstone-style face targeting: opponent header becomes a click target
  const oppHeader = document.querySelector('#opponent-section .player-header');
  if (oppHeader) {
    const faceLegal = attackMode && canFace;
    oppHeader.classList.toggle('face-targetable', !!faceLegal);
    oppHeader.onclick = faceLegal ? () => attackFace() : null;
    oppHeader.title = faceLegal ? 'Drag a character here, or click to attack face' : '';
  }
  const myHeader = document.querySelector('#player-section .player-header');
  if (myHeader) {
    const heroLegal = pendingSpellTarget && (pendingTargetSide === 'hero' || pendingTargetSide === 'ally_or_hero');
    myHeader.classList.toggle('hero-targetable', !!heroLegal);
    myHeader.onclick = heroLegal ? () => chooseHero() : null;
    myHeader.title = heroLegal ? 'Drag or click to target your hero' : '';
  }

  document.getElementById('btn-start-turn').style.display = (isMyTurn && !turnStarted) ? 'inline-block' : 'none';
  document.getElementById('btn-play').style.display = (isMyTurn && turnStarted) ? 'inline-block' : 'none';
  const targetingHeroOptional = pendingSpellTarget && (pendingTargetSide === 'ally_or_hero' || pendingTargetSide === 'hero');
  document.getElementById('btn-play').disabled = !canAffordCard || selectedCardIndex === null || (pendingSpellTarget && !targetingHeroOptional);
  document.getElementById('btn-play').textContent = pendingSpellTarget
    ? (targetingHeroOptional ? 'Heal Hero' : 'Click a target')
    : 'Play Card';
  document.getElementById('btn-play').classList.toggle('hint-glow', !!(step && selectedCardIndex !== null && ['welcome', 'split', 'drain', 'ward', 'spell', 'location', 'charge'].includes(step.id)));
  const recycleBtn = document.getElementById('btn-recycle');
  if (recycleBtn) {
    recycleBtn.hidden = !canRecycle;
    recycleBtn.disabled = !canRecycle;
    recycleBtn.classList.toggle('hint-glow', !!(step && step.id === 'recycle' && selectedCard && selectedCard.recycle));
  }
  const attackBtn = document.getElementById('btn-attack');
  if (attackBtn) {
    attackBtn.style.display = (isMyTurn && turnStarted && canFace) ? 'inline-block' : 'none';
    attackBtn.disabled = !canFace || selectedAttackerIndex === null;
    attackBtn.textContent = 'Attack Face';
  }
  const endBtn = document.getElementById('btn-end-turn');
  const endWrap = endBtn ? endBtn.closest('.end-wrap') : null;
  if (endWrap) endWrap.style.display = (isMyTurn && turnStarted) ? '' : 'none';
  endBtn.disabled = pendingChoice;
  endBtn.classList.toggle('hint-glow', !!(step && step.id === 'exhaustion'));

  renderTutorialHint();
  renderDiscovery();
  renderSplit();
  if (selectedCard) {
    pinnedInspectCard = selectedCard;
    showDossier(selectedCard);
  } else if (selectedAtk) {
    pinnedInspectCard = selectedAtk;
    showDossier(selectedAtk);
  } else {
    showDossier(pinnedInspectCard);
  }

  if (state.is_over) {
    showRecap();
  }
}

function playerTurnCount(isMyTurn) {
  const turn = state.turn || 0;
  if (!turn || !isMyTurn) return 0;
  return Math.ceil(turn / 2);
}

function targetableEnemies(opp) {
  const board = (opp && opp.board) || [];
  const visible = board.filter((c) => !c.stealth);
  const taunts = visible.filter((c) => c.taunt);
  return taunts.length ? taunts : visible;
}

function canAttackFace(opp) {
  return targetableEnemies(opp).length === 0;
}

function plateFaction(faction) {
  if (faction === 'illuminati' || faction === 'templars' || faction === 'reptilians') return faction;
  return 'network';
}

function cardFrontUrl(faction) {
  return `/static/cards/fronts/${plateFaction(faction)}-front.jpg`;
}

function cardBackUrl(faction) {
  return `/static/cards/backs/${plateFaction(faction)}-back.jpg`;
}

function factionLabel(faction) {
  if (faction === 'neutral') return 'Network';
  return titleCase(faction || '');
}

const RULE_KEYWORDS = [
  'Shielding', 'Retaliate', 'Manifest', 'Opening', 'Charge', 'Stealth',
  'Enraged', 'Silence', 'Recycle', 'Amplify', 'Stasis', 'Venom', 'Recur',
  'Chain', 'Flash', 'Excess', 'Drain', 'Echo', 'Rush', 'Taunt', 'Ward',
];
const RULE_KEYWORD_RE = new RegExp(`\\b(${RULE_KEYWORDS.join('|')})\\b`, 'g');

function formatRulesHtml(text) {
  return escHtml(text || '').replace(RULE_KEYWORD_RE, '<strong class="kw-word">$1</strong>');
}

function energyGemFile(faction) {
  if (faction === 'templars') return 'faith';
  if (faction === 'reptilians') return 'psionics';
  return 'influence';
}

function energyTypeName(faction) {
  if (faction === 'templars') return 'Faith';
  if (faction === 'reptilians') return 'Psionics';
  if (faction === 'illuminati') return 'Influence';
  return 'Energy';
}

function heroPortraitUrl(faction) {
  const id = plateFaction(faction);
  if (id === 'network') return '/static/ui/heroes/portrait-illuminati.jpg';
  return `/static/ui/heroes/portrait-${id}.jpg`;
}

function paintHeroFrame(sectionId, faction, portraitId) {
  const header = document.querySelector(`#${sectionId} .player-header`);
  const plaque = document.querySelector(`#${sectionId} .hero-plaque`);
  [header, plaque].forEach((el) => {
    if (!el) return;
    el.classList.remove('illuminati', 'templars', 'reptilians');
    if (faction === 'illuminati' || faction === 'templars' || faction === 'reptilians') {
      el.classList.add(faction);
    }
  });
  const portrait = document.getElementById(portraitId);
  if (portrait) portrait.style.backgroundImage = `url('${heroPortraitUrl(faction)}')`;
}

function renderEnergyWell(player) {
  const el = document.getElementById('energy-display');
  if (!el || !player) return;
  const gem = energyGemFile(player.faction);
  const sockets = [];
  for (let i = 0; i < 10; i += 1) {
    const locked = i >= (player.max_energy || 0);
    const lit = i < (player.energy || 0);
    const src = lit ? `/static/ui/energy/${gem}.jpg` : '/static/ui/energy/empty.jpg';
    sockets.push(`<img src="${src}" class="${locked ? 'locked' : ''}" alt="">`);
  }
  el.innerHTML = `
    <h3>${energyTypeName(player.faction)}</h3>
    <div class="crystals">${sockets.join('')}</div>
    <div class="count">${player.energy || 0} / ${player.max_energy || 0}</div>`;
}

function renderDeckWell(player) {
  const img = document.getElementById('deck-back');
  const count = document.getElementById('deck-remaining');
  if (img) img.src = cardBackUrl(player && player.faction);
  if (count) count.textContent = String(player && player.deck_size != null ? player.deck_size : 0);
}

function renderCardFace(card, extraClass, onclick, meta, extraAttrs) {
  const faction = getFactionClass(card.faction);
  const type = card.type || (card.attack !== undefined ? 'Character' : '');
  const body = card.ability || card.effect || '';
  const kws = cardKeywordChips(card);
  const isChar = card.attack !== undefined && card.attack !== null;
  return `<div class="card frame ${faction} ${extraClass || ''}" data-card-id="${escHtml(card.id || '')}" data-card-name="${escHtml(card.name || '')}" ${extraAttrs || ''} ${onclick ? `onclick="${onclick}"` : ''}>
    <div class="card-title" title="${escHtml(card.name)}">${escHtml(card.name)}</div>
    <div class="card-art" style="background-image:url('${cardFrontUrl(card.faction)}')">
      <span class="card-cost">${card.cost ?? ''}</span>
    </div>
    <div class="card-type">${escHtml(type)}${card.faction ? ' · ' + factionLabel(card.faction) : ''}</div>
    <div class="card-text">
      <p class="card-ability">${formatRulesHtml(body)}</p>
      ${kws.length ? `<div class="card-kws">${kws.map(([cls, label]) => `<span class="kw ${cls}">${label}</span>`).join('')}</div>` : ''}
      ${meta ? `<div class="meta">${meta}</div>` : ''}
    </div>
    <div class="card-footer">
      <div class="card-atk${isChar ? '' : ' empty'}">${isChar ? card.attack : ''}</div>
      <div class="card-hp${isChar ? '' : ' empty'}">${isChar ? card.health : ''}</div>
    </div>
  </div>`;
}

function cardKeywordChips(card) {
  const kws = [];
  if (card.exhausted) kws.push(['exhausted', 'Exhausted']);
  if (card.stealth) kws.push(['stealth', 'Stealth']);
  if (card.taunt) kws.push(['taunt', 'Taunt']);
  if (card.charge || /(^|[.]\s*)Charge\b/.test(card.ability || '')) kws.push(['charge', 'Charge']);
  if (card.rush || /(^|[.]\s*)Rush\b/.test(card.ability || '')) kws.push(['rush', 'Rush']);
  if (card.enraged || /(^|[.]\s*)Enraged\b/.test(card.ability || '')) kws.push(['enraged', 'Enraged']);
  if (card.shield || /(^|[.]\s*)Shielding\b/.test(card.ability || '')) kws.push(['shield', 'Shield']);
  const printed = `${card.ability || ''} ${card.effect || ''}`;
  const prefixKw = (name, cls, label) => {
    if (card[cls] || new RegExp(`(^|[.:]\\s*)${name}\\b`).test(printed)) kws.push([cls, label]);
  };
  prefixKw('Drain', 'drain', 'Drain');
  prefixKw('Venom', 'venom', 'Venom');
  prefixKw('Recur', 'recur', 'Recur');
  if (card.stasis) kws.push(['stasis', 'Stasis']);
  prefixKw('Amplify', 'amplify', 'Amplify');
  prefixKw('Recycle', 'recycle', 'Recycle');
  prefixKw('Chain', 'chain', 'Chain');
  prefixKw('Echo', 'echo', 'Echo');
  prefixKw('Excess', 'excess', 'Excess');
  prefixKw('Retaliate', 'retaliate', 'Retaliate');
  prefixKw('Flash', 'flash', 'Flash');
  prefixKw('Manifest', 'manifest', 'Manifest');
  prefixKw('Opening', 'opening', 'Opening');
  if (card.ward || /(^|[.]\s*)Ward\b/.test(printed)) kws.push(['ward', 'Ward']);
  if (card.silenced) kws.push(['silenced', 'Silenced']);
  return kws;
}

function renderMinion(card, extraClass, onclick, extraAttrs) {
  const faction = getFactionClass(card.faction);
  const kws = cardKeywordChips(card);
  const shown = kws.filter(([cls]) => ['exhausted', 'taunt', 'stealth', 'charge', 'rush', 'ward', 'shield', 'silenced'].includes(cls));
  const taunt = card.taunt ? ' has-taunt' : '';
  const stealth = card.stealth ? ' has-stealth' : '';
  return `<div class="card minion oval ${faction} ${extraClass || ''}${taunt}${stealth}" data-card-id="${escHtml(card.id || '')}" data-card-name="${escHtml(card.name || '')}" ${extraAttrs || ''} ${onclick ? `onclick="${onclick}"` : ''}>
    <div class="minion-art" style="background-image:url('${cardFrontUrl(card.faction)}')"></div>
    <div class="minion-name">${escHtml(card.name || '')}</div>
    <div class="minion-atk">${card.attack ?? ''}</div>
    <div class="minion-hp">${card.health ?? ''}</div>
    ${shown.length ? `<div class="minion-kws">${shown.map(([cls, label]) => `<span class="kw ${cls}">${label}</span>`).join('')}</div>` : ''}
  </div>`;
}

function renderCardBack(faction, extraClass) {
  return `<div class="card frame back ${getFactionClass(faction) || 'neutral'} ${extraClass || ''} disabled">
    <div class="card-back-art" style="background-image:url('${cardBackUrl(faction)}')"></div>
  </div>`;
}

function renderHiddenHand(count) {
  if (!count) return `<div style="color:var(--text-muted);font-size:0.8em;">(empty)</div>`;
  const opp = getOpponent();
  const faction = opp && opp.faction ? opp.faction : 'reptilians';
  return Array.from({ length: count }, () => renderCardBack(faction)).join('');
}

function renderLocation(location, isPlayer) {
  const who = isPlayer ? 'Yours' : 'Enemy';
  if (!location) {
    return `<div class="location-empty">${who}: empty</div>`;
  }
  const step = currentTutorialStep();
  const glow = isPlayer && step && step.id === 'location' ? ' hint-glow' : '';
  return `<div class="location-slot ${getFactionClass(location.faction)}${glow}" data-card-id="${escHtml(location.id || '')}" data-card-name="${escHtml(location.name || '')}">
    <div class="loc-label">${who}</div>
    <div class="loc-name">${escHtml(location.name)}</div>
    <div class="loc-fx">${formatRulesHtml(location.effect || '')}</div>
  </div>`;
}

function renderBoard(board, isPlayer) {
  const list = board || [];
  const opp = getOpponent();
  const me = getMyPlayer();
  const targetingEnemy = (attackMode || pendingSpellTarget) && pendingTargetSide === 'enemy';
  const targetingAlly = pendingSpellTarget && (pendingTargetSide === 'ally' || pendingTargetSide === 'ally_or_hero');
  const legalEnemies = !isPlayer && targetingEnemy ? targetableEnemies(opp) : [];
  const legalAllies = isPlayer && targetingAlly ? ((me && me.board) || []) : [];
  const step = currentTutorialStep();
  const cells = [];
  for (let i = 0; i < BOARD_SLOTS; i += 1) {
    const c = list[i];
    if (!c) {
      cells.push(`<div class="minion-slot ${isPlayer ? 'ally' : 'enemy'}" data-slot="${i}"></div>`);
      continue;
    }
    const canAttack = isPlayer && c.attack > 0 && !c.exhausted && !targetingAlly;
    const validTarget = isPlayer
      ? targetingAlly && legalAllies.includes(c)
      : targetingEnemy && legalEnemies.includes(c);
    const selected = isPlayer && i === selectedAttackerIndex;
    const hintReady = isPlayer && canAttack && step && (step.id === 'attack' || step.id === 'taunt' || step.id === 'drain-attack' || step.id === 'deathrattle');
    const hintTarget = validTarget && step && (step.id === 'attack' || step.id === 'taunt' || step.id === 'spell' || step.id === 'split' || step.id === 'deathrattle' || step.id === 'drain-attack');
    let onclick = '';
    if (isPlayer && targetingAlly) onclick = `chooseAlly(${i})`;
    else if (isPlayer) onclick = `selectAttacker(${i})`;
    else if (targetingEnemy) onclick = `chooseEnemy(${i})`;
    const extra = `${selected ? 'selected' : ''} ${validTarget ? 'targetable' : ''} ${hintReady || hintTarget ? 'hint-glow' : ''} ${!canAttack && isPlayer && !targetingAlly ? 'disabled' : ''}`;
    const attrs = `data-board-index="${i}" data-board-side="${isPlayer ? 'player' : 'opponent'}"`;
    cells.push(renderMinion(c, extra, onclick, attrs));
  }
  return cells.join('');
}

function renderHand(hand, energy) {
  if (!hand.length) return `<div style="color:var(--text-muted);font-size:0.8em;">(empty)</div>`;
  const step = currentTutorialStep();
  return hand.map((c, i) => {
    const canAfford = energy >= c.cost;
    const selected = i === selectedCardIndex;
    const teach = step && (
      (step.id === 'welcome' && c.name === 'Squire')
      || (step.id === 'spell' && c.name === 'Divine Smite')
      || (step.id === 'location' && c.name === 'Sacred Chapel')
      || (step.id === 'charge' && c.name === 'Zealot')
      || (step.id === 'recycle' && c.name === 'Burn Bag')
      || (step.id === 'split' && c.name === 'Forked Brief')
      || (step.id === 'drain' && c.name === 'Leech Contact')
      || (step.id === 'ward' && c.name === 'Quiet Vest')
    );
    const extra = `${selected ? 'selected' : ''} ${teach && canAfford ? 'hint-glow' : ''} ${!canAfford ? 'disabled' : ''}`;
    return renderCardFace(c, extra, canAfford ? `selectCard(${i})` : '', '', `data-hand-index="${i}"`);
  }).join('');
}

function selectCard(index) {
  const me = getMyPlayer();
  const card = me && me.hand ? me.hand[index] : null;
  if (selectedCardIndex === index) {
    clearSelection();
    return;
  }
  selectedCardIndex = index;
  selectedAttackerIndex = null;
  attackMode = false;
  const spec = targetSpec(card);
  if (spec.mode === 'none') {
    pendingSpellTarget = false;
    pendingTargetSide = 'enemy';
    render();
    return;
  }
  if (spec.mode === 'enemy' && targetableEnemies(getOpponent()).length === 0) {
    pendingSpellTarget = false;
    pendingTargetSide = 'enemy';
    addLog('No valid target (Stealth or empty board).', 'damage');
    render();
    return;
  }
  if (spec.mode === 'ally' && !(me.board || []).length) {
    pendingSpellTarget = false;
    pendingTargetSide = 'enemy';
    addLog('No friendly character to target.', 'damage');
    render();
    return;
  }
  pendingSpellTarget = true;
  pendingTargetSide = spec.mode;
  if (spec.mode === 'enemy') addLog('Drag onto a highlighted enemy, or click one.', 'turn');
  else if (spec.mode === 'ally') addLog('Drag onto a friendly character, or click one.', 'turn');
  else addLog('Drag onto your hero or a friendly character.', 'turn');
  render();
}

async function chooseEnemy(targetIndex) {
  if (pendingSplitIndex !== null && pendingSpellTarget) {
    await sendSplit(pendingSplitIndex, targetIndex);
    return;
  }
  if (pendingSpellTarget) {
    await playSelectedCard(targetIndex, 'enemy');
    return;
  }
  await attackTarget(targetIndex);
}

async function chooseAlly(targetIndex) {
  if (!pendingSpellTarget) return;
  await playSelectedCard(targetIndex, 'ally');
}

async function chooseHero() {
  if (!pendingSpellTarget) return;
  await playSelectedCard(null, 'hero');
}

function heroGuard(player) {
  const tags = [];
  if (player && player.ward) tags.push('<span class="kw ward">Ward</span>');
  if (player && player.shield) tags.push('<span class="kw shield">Shield</span>');
  return tags.length ? ` ${tags.join(' ')}` : '';
}

function selectAttacker(index) {
  const board = getMyPlayer().board;
  const c = board[index];
  if (!c || c.attack <= 0 || c.exhausted) return;
  selectedAttackerIndex = selectedAttackerIndex === index ? null : index;
  attackMode = selectedAttackerIndex !== null;
  selectedCardIndex = null;
  pendingSpellTarget = false;
  render();
}

function clearSelection() {
  selectedAttackerIndex = null;
  selectedCardIndex = null;
  attackMode = false;
  pendingSpellTarget = false;
  pendingTargetSide = 'enemy';
  render();
}

async function attackTarget(targetIndex) {
  if (selectedAttackerIndex === null) return;
  await sendAttack(selectedAttackerIndex, targetIndex);
}

async function attackFace() {
  if (selectedAttackerIndex === null) return;
  const opp = getOpponent();
  if (!canAttackFace(opp)) {
    addLog('You must attack a Taunt or visible enemy first.', 'turn');
    return;
  }
  const me = getMyPlayer();
  const atk = me && me.board ? me.board[selectedAttackerIndex] : null;
  if (atk && atk.rush_locked) {
    addLog('Rush characters cannot attack face the turn they are played.', 'turn');
    return;
  }
  await sendAttack(selectedAttackerIndex, null);
}

async function submitAttack() {
  // Keep button as fallback; prefer clicking the highlighted face
  await attackFace();
}

async function sendAttack(attackerIndex, targetIndex) {
  try {
    const oppBefore = getOpponent();
    const targetBefore = (targetIndex !== null && targetIndex !== undefined && oppBefore && oppBefore.board)
      ? oppBefore.board[targetIndex]
      : null;
    const body = { attacker_index: attackerIndex };
    if (targetIndex !== null && targetIndex !== undefined) body.target_index = targetIndex;
    const data = await api('POST', `/api/game/${sessionId}/attack`, body);
    if (data.action_result?.success) {
      const ar = data.action_result;
      addLog(`${ar.attacker} attacks ${ar.target} (${ar.damage_dealt} dmg)`, 'damage');
      tutorialProgress.attacked = true;
      if (targetBefore && targetBefore.taunt) tutorialProgress.attackedTaunt = true;
      if (/Hatchling|Deathrattle|Raptor|when this character dies/i.test(
        `${(targetBefore && (targetBefore.ability || '')) || ''} ${JSON.stringify(ar)}`,
      )) {
        tutorialProgress.sawDeathrattle = true;
      }
      if (/Leech Contact/i.test(ar.attacker || '')) tutorialProgress.drainAttacked = true;
    } else {
      addLog(`Cannot attack: ${data.action_result?.error || 'unknown'}`, 'damage');
    }
    selectedAttackerIndex = null;
    attackMode = false;
    await loadState();
  } catch (e) {
    addLog('Attack failed: ' + e.message, 'damage');
  }
}

async function submitStartTurn() {
  try {
    const data = await api('POST', `/api/game/${sessionId}/start-turn`);
    state = data.state || data;
    addLog(`Turn started. Energy: ${getMyPlayer().energy}`, 'turn');
    render();
  } catch (e) {
    addLog('Start turn failed: ' + e.message, 'damage');
  }
}

async function submitPlay() {
  if (selectedCardIndex === null) return;
  const card = getMyPlayer().hand[selectedCardIndex];
  const spec = targetSpec(card);
  if (pendingSpellTarget && (spec.mode === 'ally_or_hero' || spec.mode === 'hero')) {
    await playSelectedCard(null, 'hero');
    return;
  }
  if (spec.mode === 'none') {
    await playSelectedCard(null, 'enemy');
    return;
  }
  if (spec.mode === 'enemy') {
    const targets = targetableEnemies(getOpponent());
    if (targets.length === 0) {
      addLog('No valid target (Stealth or empty board).', 'damage');
      return;
    }
    pendingSpellTarget = true;
    pendingTargetSide = 'enemy';
    addLog('Drag onto a highlighted enemy, or click one.', 'turn');
    render();
    return;
  }
  if (spec.mode === 'ally') {
    const allies = (getMyPlayer().board || []);
    if (allies.length === 0) {
      addLog('No friendly character to target.', 'damage');
      return;
    }
    pendingSpellTarget = true;
    pendingTargetSide = 'ally';
    addLog('Drag onto a friendly character, or click one.', 'turn');
    render();
    return;
  }
  pendingSpellTarget = true;
  pendingTargetSide = spec.mode;
  addLog(spec.mode === 'hero' ? 'Drag onto your hero, or Play again.' : 'Drag onto your hero or a friendly character.', 'turn');
  render();
}

async function playSelectedCard(spellTarget, targetSide) {
  if (selectedCardIndex === null) return;
  const card = getMyPlayer().hand[selectedCardIndex];
  try {
    let path = `/api/game/${sessionId}/play?card_index=${selectedCardIndex}`;
    if (spellTarget !== null && spellTarget !== undefined && !Number.isNaN(spellTarget)) {
      path += `&spell_target_index=${spellTarget}`;
    }
    if (targetSide) path += `&target_side=${targetSide}`;
    const data = await api('POST', path);
    if (data.action_result?.success) {
      addLog(`Played ${data.action_result.card}`, 'play');
      if (card && card.type === 'Character') tutorialProgress.playedCharacter = true;
      if (card && card.type === 'Spell') tutorialProgress.playedSpell = true;
      if (card && card.type === 'Location') tutorialProgress.playedLocation = true;
      if (card && /^(Charge)\b/i.test(card.ability || '')) tutorialProgress.playedCharge = true;
      if (card && /Drain/i.test(card.ability || '')) tutorialProgress.playedDrain = true;
      if (card && /Ward/i.test(`${card.ability || ''} ${card.effect || ''}`)) tutorialProgress.playedWard = true;
      if (data.action_result.split || (card && /Split:/i.test(card.effect || ''))) tutorialProgress.splitPlayed = true;
    } else {
      addLog(`Cannot play: ${data.action_result?.error || 'unknown'}`, 'damage');
    }
    selectedCardIndex = null;
    pendingSpellTarget = false;
    pendingTargetSide = 'enemy';
    await loadState();
  } catch (e) {
    addLog('Play failed: ' + e.message, 'damage');
    pendingSpellTarget = false;
    pendingTargetSide = 'enemy';
  }
}

function targetSpec(card) {
  if (!card) return { mode: 'none' };
  const text = `${card.effect || ''} ${card.ability || ''}`.toLowerCase();
  if (!text.trim()) return { mode: 'none' };
  if (text.includes('discover') || text.includes('split:')) return { mode: 'none' };

  const spray = /deal \d+ damage to an enemy character/.test(text) && /all other/.test(text);
  const aoeEnemy = /all enemy characters/.test(text) && !spray;
  const aoeFriendly = /all (your|friendly) characters/.test(text);

  if (/your hero or a character/.test(text) || /hero or a character/.test(text)) {
    return { mode: 'ally_or_hero' };
  }
  if (/destroy a friendly/.test(text) || /give a friendly character/.test(text)) {
    return { mode: 'ally' };
  }
  if (aoeEnemy || aoeFriendly) return { mode: 'none' };

  if (
    /assault:/.test(text)
    && /target/.test(text)
    && /restore|give a target[^.]*\+/.test(text)
    && !/deal \d+ damage/.test(text)
  ) {
    return { mode: 'ally' };
  }

  const wantsEnemy =
    spray
    || /(?:a |an )?(?:target|enemy) character/.test(text)
    || /give (?:a |an )?target/.test(text)
    || /give an enemy character/.test(text)
    || /return an enemy character/.test(text)
    || /take control of an enemy/.test(text)
    || /silence (?:and deal|a target)/.test(text)
    || (/assault:/.test(text) && /target/.test(text));

  if (wantsEnemy) return { mode: 'enemy' };
  return { mode: 'none' };
}

function needsSpellTarget(card) {
  const mode = targetSpec(card).mode;
  return mode === 'enemy' || mode === 'ally';
}

function renderDiscovery() {
  const box = document.getElementById('discover-overlay');
  if (!box) return;
  const pending = state && state.pending_discovery;
  if (!pending || !pending.cards || pending.cards.length === 0) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  document.getElementById('discover-choices').innerHTML = pending.cards.map((c, i) =>
    renderCardFace(c, '', `submitDiscover(${i})`)
  ).join('');
}

async function submitDiscover(index) {
  try {
    const data = await api('POST', `/api/game/${sessionId}/discover`, { index });
    state = data.state || state;
    if (data.discover_result && data.discover_result.card) {
      addLog(`Discovered ${data.discover_result.card}`, 'play');
    }
    render();
  } catch (e) {
    addLog('Discovery failed: ' + e.message, 'damage');
  }
}

function renderSplit() {
  const box = document.getElementById('split-overlay');
  if (!box) return;
  const pending = state && state.pending_split;
  if (pendingSplitIndex !== null || !pending || !pending.options || pending.options.length === 0) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  document.getElementById('split-choices').innerHTML = pending.options.map((text, i) =>
    `<button class="primary split-option" onclick="submitSplit(${i})">${escHtml(text)}</button>`
  ).join('');
}

async function submitSplit(index) {
  const pending = state && state.pending_split;
  const option = pending && pending.options ? pending.options[index] : '';
  if (/target/i.test(option || '') && targetableEnemies(getOpponent()).length > 0) {
    pendingSplitIndex = index;
    pendingSpellTarget = true;
    const box = document.getElementById('split-overlay');
    if (box) box.hidden = true;
    addLog('Drag onto a highlighted enemy for that Split option, or click one.', 'turn');
    render();
    return;
  }
  await sendSplit(index, null);
}

async function sendSplit(index, targetIndex) {
  try {
    const body = { index };
    if (targetIndex !== null && targetIndex !== undefined) body.target_index = targetIndex;
    const data = await api('POST', `/api/game/${sessionId}/split`, body);
    state = data.state || state;
    if (data.split_result && data.split_result.choice) {
      addLog(`Split: ${data.split_result.choice}`, 'play');
      tutorialProgress.splitPlayed = true;
    }
    pendingSplitIndex = null;
    pendingSpellTarget = false;
    render();
  } catch (e) {
    addLog('Split failed: ' + e.message, 'damage');
  }
}

async function submitRecycle(forcedIndex) {
  const cardIndex = (forcedIndex !== undefined && forcedIndex !== null) ? forcedIndex : selectedCardIndex;
  if (cardIndex === null || cardIndex === undefined) return;
  try {
    const data = await api('POST', `/api/game/${sessionId}/recycle`, { card_index: cardIndex });
    state = data.state || state;
    if (data.recycle_result && data.recycle_result.recycled) {
      addLog(`Recycled ${data.recycle_result.recycled}`, 'play');
      tutorialProgress.recycled = true;
    }
    selectedCardIndex = null;
    render();
  } catch (e) {
    addLog('Recycle failed: ' + e.message, 'damage');
  }
}

async function submitEndTurn() {
  try {
    await api('POST', `/api/game/${sessionId}/end-turn`);
    addLog('Turn ended.', 'turn');
    await loadState();
    if (!state.is_over && state.active_player !== myPlayerName) {
      addLog(`${state.active_player} is thinking...`, 'turn');
      await runAITurn();
    }
  } catch (e) {
    addLog('End turn failed: ' + e.message, 'damage');
  }
}

async function runAITurn() {
  try {
    const data = await api('POST', `/api/game/${sessionId}/ai-turn`);
    (data.results || []).forEach((step) => {
      const result = step.result || {};
      if (step.action === 'play' && result.card) addLog(`AI plays ${result.card}`, 'play');
      if (step.action === 'attack' && result.attacker) addLog(`AI: ${result.attacker} attacks ${result.target}`, 'damage');
      if (step.action === 'end_turn') addLog('AI ends turn.', 'turn');
      if (step.action === 'discover' && result.card) addLog(`AI discovers ${result.card}`, 'play');
      if (step.action === 'split' && result.choice) addLog(`AI split: ${result.choice}`, 'play');
      if (step.action === 'recycle' && result.recycled) addLog(`AI recycles ${result.recycled}`, 'play');
    });
    state = data.state;
    if (data.recap) renderRecap(data.recap);
    if (!state.is_over) {
      await ensureMyTurnStarted();
    }
    render();
  } catch (e) {
    addLog('AI error: ' + e.message, 'damage');
    await loadState();
  }
}

async function ensureMyTurnStarted() {
  if (!state || state.is_over) return;
  if (state.active_player !== myPlayerName) return;
  if (state.turn_started) return;
  const data = await api('POST', `/api/game/${sessionId}/start-turn`);
  state = data.state || data;
  addLog(`Turn started. Energy: ${getMyPlayer().energy}`, 'turn');
}

function currentTutorialStep() {
  if (!isGuidedMode()) return null;
  const me = getMyPlayer();
  const opp = getOpponent();
  if (!me) return encounter.steps[0];
  const names = (me.hand || []).map((c) => c.name);
  const playedChar = (me.board || []).length > 0;
  const hasLocation = !!me.location;
  const energy = me.energy || 0;
  const ready = (me.board || []).some((c) => c.attack > 0 && !c.exhausted);
  const oppTaunt = (opp.board || []).some((c) => c.taunt && !c.stealth);
  const oppRaptor = (opp.board || []).some((c) => /Raptor/i.test(c.name || ''));
  const oppHatchling = (opp.board || []).some((c) => /Hatchling/i.test(c.name || ''));
  const drainReady = (me.board || []).some((c) => /Leech Contact/i.test(c.name || '') && c.attack > 0 && !c.exhausted);

  if (gameMode === 'lab') {
    if (!tutorialProgress.recycled && names.includes('Burn Bag') && energy >= 1) {
      return findStep('recycle');
    }
    if (!tutorialProgress.splitPlayed && names.includes('Forked Brief') && energy >= 2) {
      return findStep('split');
    }
    if (!tutorialProgress.playedDrain && names.includes('Leech Contact') && energy >= 3) {
      return findStep('drain');
    }
    if (tutorialProgress.playedDrain && drainReady && !tutorialProgress.drainAttacked) {
      return findStep('drain-attack');
    }
    if (!tutorialProgress.playedWard && names.includes('Quiet Vest') && energy >= 4) {
      return findStep('ward');
    }
    return findStep('free');
  }

  if (!tutorialProgress.playedCharacter && !playedChar && names.includes('Squire') && energy >= 1) {
    return findStep('welcome');
  }
  if (playedChar && !ready && !tutorialProgress.attacked) return findStep('exhaustion');
  if (ready && oppTaunt && !tutorialProgress.attackedTaunt) return findStep('taunt');
  if (ready && !tutorialProgress.attacked) return findStep('attack');
  if ((tutorialProgress.sawDeathrattle || oppRaptor) && !dismissedHints.has('deathrattle') && (oppRaptor || !oppHatchling)) {
    return findStep('deathrattle');
  }
  if (names.includes('Divine Smite') && energy >= 3 && !tutorialProgress.playedSpell) return findStep('spell');
  if (names.includes('Sacred Chapel') && energy >= 4 && !hasLocation && !tutorialProgress.playedLocation) {
    return findStep('location');
  }
  if (names.includes('Zealot') && energy >= 3 && !tutorialProgress.playedCharge) {
    return findStep('charge');
  }
  if (!tutorialProgress.playedSpell || !tutorialProgress.playedLocation) {
    return {
      id: 'hold',
      title: 'Keep going',
      text: 'Spend leftover energy if you can, then click End Turn. Spells and locations unlock when you can afford them.',
    };
  }
  return findStep('free');
}

function isMyTurnNow() {
  return !!(state && getMyPlayer() && state.active_player === getMyPlayer().name);
}

function findStep(id) {
  return encounter.steps.find((s) => s.id === id) || encounter.steps[encounter.steps.length - 1];
}

function renderTutorialHint() {
  const box = document.getElementById('tutorial-hint');
  if (!isGuidedMode() || state.is_over) {
    box.hidden = true;
    return;
  }
  const step = currentTutorialStep();
  if (!step || dismissedHints.has(step.id)) {
    box.hidden = true;
    return;
  }
  document.getElementById('hint-title').textContent = step.title;
  document.getElementById('hint-text').textContent = step.text;
  box.hidden = false;
}

function skipTutorialHint() {
  const step = currentTutorialStep();
  if (step) dismissedHints.add(step.id);
  renderTutorialHint();
}

function skipTutorial() {
  const noun = gameMode === 'lab' ? 'keyword lab' : 'guided match';
  if (!window.confirm(`Skip the ${noun} and read the rules recap?`)) return;
  (encounter.steps || []).forEach((step) => dismissedHints.add(step.id));
  dismissedHints.add('hold');
  renderTutorialHint();
  renderRecap({
    winner: null,
    you_won: false,
    skipped: true,
    lesson: 'Here is the rules cheat sheet. Play vs AI when you are ready.',
    turns: state ? state.turn : 0,
    cards_played_count: 0,
    damage_dealt: 0,
    damage_taken: 0,
  });
}

function playAfterTutorial() {
  returnToMenu(true);
  showScreen('screen-setup');
  refreshSetup();
}

async function showRecap() {
  try {
    const recap = await api('GET', `/api/game/${sessionId}/recap`);
    renderRecap(recap);
  } catch (e) {
    renderRecap({ winner: state.winner, you_won: state.winner === myPlayerName });
  }
}

function renderRecap(recap) {
  const overlay = document.getElementById('game-over');
  overlay.hidden = false;
  const skipped = !!recap.skipped;
  const youWon = !skipped && (recap.you_won || recap.winner === myPlayerName);
  document.getElementById('game-over-text').textContent = skipped
    ? 'RULES'
    : (youWon ? 'VICTORY' : 'DEFEAT');
  document.getElementById('game-over-text').className = youWon ? 'winner' : 'loser';
  document.getElementById('game-over-sub').textContent = skipped
    ? 'Tutorial skipped. Review the cheat sheet, then play a real match.'
    : (recap.winner ? `${recap.winner} has won the game.` : 'Match over.');
  document.getElementById('recap-stats').innerHTML = skipped ? '' : `
    <ul>
      <li>Turns: ${recap.turns ?? state.turn ?? '?'}</li>
      <li>Cards you played: ${recap.cards_played_count ?? (recap.cards_played || []).length}</li>
      <li>Damage you dealt: ${recap.damage_dealt ?? 0}</li>
      <li>Damage you took: ${recap.damage_taken ?? 0}</li>
    </ul>
  `;
  document.getElementById('recap-lesson').textContent = recap.lesson || '';
  document.getElementById('tutorial-cheatsheet').hidden = !isGuidedMode();
  document.getElementById('btn-replay-tutorial').hidden = gameMode !== 'tutorial';
  const replayLab = document.getElementById('btn-replay-lab');
  if (replayLab) replayLab.hidden = gameMode !== 'lab';
}

function openEncounters() {
  const list = document.getElementById('encounter-list');
  list.innerHTML = encounters
    .filter((e) => e.mode !== 'tutorial' && e.mode !== 'lab')
    .map((e) => `
      <article class="encounter-card">
        <h3>${escHtml(e.name)}</h3>
        <p>${escHtml(e.description)}</p>
        <p class="meta">${titleCase(e.player_faction)} vs ${titleCase(e.ai_faction)} · ${titleCase(e.difficulty)}${e.mode === 'challenge' ? ' · Challenge' : ''}</p>
        <button class="primary" onclick="startEncounter('${e.id}')">Play encounter</button>
      </article>
    `).join('');
  showScreen('screen-encounters');
}

function openDeckBuilder() {
  document.getElementById('deck-name').value = document.getElementById('deck-name').value || `${titleCase(builderFaction)} Custom`;
  refreshSavedDeckSelect();
  renderDeckBuilder();
  showScreen('screen-deck');
}

function renderKeywordGlossary() {
  const list = document.getElementById('keyword-list');
  const search = document.getElementById('keyword-search');
  if (!list) return;
  const q = (search && search.value ? search.value : '').trim().toLowerCase();
  const rows = KEYWORD_GLOSSARY.filter((k) => {
    if (!q) return true;
    return `${k.name} ${k.text} ${k.example}`.toLowerCase().includes(q);
  });
  list.innerHTML = rows.map((k) => `
    <article class="keyword-card">
      <h3>${escHtml(k.name)}</h3>
      <p>${escHtml(k.text)}</p>
      <p class="meta">e.g. ${escHtml(k.example)}</p>
    </article>
  `).join('') || '<p class="lede">No keywords match that search.</p>';
}

function openKeywordGlossary() {
  renderKeywordGlossary();
  showScreen('screen-help');
  const glossary = document.getElementById('keyword-glossary');
  if (glossary) glossary.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function loadSavedDecks() {
  try {
    return JSON.parse(localStorage.getItem(DECK_STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeSavedDecks(decks) {
  localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(decks));
}

function refreshSavedDeckSelect() {
  const select = document.getElementById('deck-saved');
  const decks = loadSavedDecks();
  select.innerHTML = `<option value="">Saved decks</option>` + decks.map((d) =>
    `<option value="${d.id}">${escHtml(d.name)} (${d.faction})</option>`
  ).join('');
}

function deckCount() {
  return builderList.reduce((sum, e) => sum + e.copies, 0);
}

function renderDeckBuilder() {
  const search = (document.getElementById('deck-search').value || '').toLowerCase();
  const type = document.getElementById('deck-type').value;
  const cost = document.getElementById('deck-cost').value;
  const keyword = document.getElementById('deck-keyword').value;
  const collection = allCards.filter((c) => {
    const pool = (document.getElementById('deck-pool') || {}).value || '';
    if (pool === 'faction' && c.faction !== builderFaction) return false;
    if (pool === 'neutral' && c.faction !== 'neutral') return false;
    if ((c.ability || '').startsWith('Token')) return false;
    if (!pool && c.faction !== builderFaction && c.faction !== 'neutral') return false;
    if (type && c.type !== type) return false;
    if (cost === '5' && c.cost < 5) return false;
    if (cost && cost !== '5' && String(c.cost) !== cost) return false;
    if (keyword && !(c.ability || c.effect || '').includes(keyword)) return false;
    const blob = `${c.name} ${c.ability || ''} ${c.effect || ''} ${c.lore || ''}`.toLowerCase();
    if (search && !blob.includes(search)) return false;
    return true;
  });

  const neutrals = builderList.reduce((sum, e) => {
    const card = allCards.find((c) => c.id === e.id);
    return sum + ((card && card.faction === 'neutral') ? e.copies : 0);
  }, 0);
  document.getElementById('deck-count').textContent =
    `${deckCount()} / 30 · ${neutrals}/12 Network`;
  document.getElementById('deck-collection').innerHTML = collection.map((c) => {
    const used = builderList.find((e) => e.id === c.id)?.copies || 0;
    return renderCardFace(c, '', `addToDeck('${c.id}')`, `${used}/2`);
  }).join('');

  document.getElementById('deck-list').innerHTML = builderList.map((e) => {
    const card = allCards.find((c) => c.id === e.id);
    return `<div class="deck-row">
      <span>${e.copies}× ${escHtml(card ? card.name : e.id)}</span>
      <span>
        <button onclick="addToDeck('${e.id}')">+</button>
        <button onclick="removeFromDeck('${e.id}')">−</button>
      </span>
    </div>`;
  }).join('') || '<p class="lede">Add cards from the collection. 30 cards, max 2 copies.</p>';
}

function addToDeck(cardId) {
  if (deckCount() >= 30) return;
  const adding = allCards.find((c) => c.id === cardId);
  if (adding && adding.faction === 'neutral') {
    const neutrals = builderList.reduce((sum, e) => {
      const card = allCards.find((c) => c.id === e.id);
      return sum + ((card && card.faction === 'neutral') ? e.copies : 0);
    }, 0);
    if (neutrals >= 12) return;
  }
  const entry = builderList.find((e) => e.id === cardId);
  if (entry) {
    if (entry.copies >= 2) return;
    entry.copies += 1;
  } else {
    builderList.push({ id: cardId, copies: 1 });
  }
  renderDeckBuilder();
}

function removeFromDeck(cardId) {
  const entry = builderList.find((e) => e.id === cardId);
  if (!entry) return;
  entry.copies -= 1;
  if (entry.copies <= 0) builderList = builderList.filter((e) => e.id !== cardId);
  renderDeckBuilder();
}

function saveCurrentDeck() {
  const name = document.getElementById('deck-name').value.trim() || `${titleCase(builderFaction)} Custom`;
  if (deckCount() !== 30) {
    alert('A playable deck needs exactly 30 cards. You can still save a draft after you finish it.');
  }
  const decks = loadSavedDecks();
  const id = `deck_${Date.now()}`;
  decks.push({ id, name, faction: builderFaction, cards: builderList.map((e) => ({ ...e })) });
  writeSavedDecks(decks);
  refreshSavedDeckSelect();
  alert('Deck saved on this device.');
}

function loadSelectedDeck() {
  const id = document.getElementById('deck-saved').value;
  const deck = loadSavedDecks().find((d) => d.id === id);
  if (!deck) return;
  builderFaction = deck.faction;
  builderList = deck.cards.map((e) => ({ ...e }));
  document.getElementById('deck-name').value = deck.name;
  renderFactionButtons('deck-factions', builderFaction, (fid) => {
    builderFaction = fid;
    builderList = [];
    renderDeckBuilder();
  });
  renderDeckBuilder();
}

async function playCurrentDeck() {
  if (deckCount() !== 30) {
    alert('Deck must be exactly 30 cards.');
    return;
  }
  const name = document.getElementById('player-name')?.value.trim() || 'Player';
  const opp = FACTIONS.find((f) => f.id !== builderFaction).id;
  await beginMatch({
    player_name: name,
    player_faction: builderFaction,
    ai_faction: opp,
    difficulty: 'medium',
    player_deck: builderList,
  }, { skipMulligan: false });
}

function getFactionClass(faction) {
  if (faction === 'illuminati' || faction === 'templars' || faction === 'reptilians' || faction === 'neutral') {
    return faction;
  }
  return '';
}

function getTypeIcon(type) {
  if (type === 'Character') return '☥';
  if (type === 'Spell') return '★';
  if (type === 'Location') return '⌂';
  return '?';
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function addLog(msg, type = '') {
  const log = document.getElementById('log');
  if (!log) return;
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = msg;
  log.prepend(entry);
  while (log.children.length > 5) log.removeChild(log.lastChild);
}

let pinnedInspectCard = null;

function inspectTarget(el) {
  if (!el) return null;
  return el.closest('.card.frame:not(.back), .card.minion, .location-slot');
}

function resolveInspectCard(el) {
  if (!el) return null;
  const id = el.dataset.cardId || '';
  const name = el.dataset.cardName || '';
  if (!id && !name) return null;
  const sources = [];
  const me = getMyPlayer();
  const opp = getOpponent();
  if (me) sources.push(...(me.hand || []), ...(me.board || []), me.location);
  if (opp) sources.push(...(opp.board || []), opp.location);
  const live = sources.filter(Boolean).find((c) => (id && c.id === id) || (name && c.name === name));
  const cat = allCards.find((c) => (id && c.id === id) || (name && c.name === name));
  if (!live && !cat) return { id, name };
  return { ...(cat || {}), ...(live || {}) };
}

function showDossier(card) {
  const empty = document.getElementById('dossier-empty');
  const body = document.getElementById('dossier-body');
  if (!empty || !body) return;
  if (!card || !card.name) {
    empty.hidden = false;
    body.hidden = true;
    return;
  }
  empty.hidden = true;
  body.hidden = false;
  const art = document.getElementById('dossier-art');
  art.style.backgroundImage = `url('${cardFrontUrl(card.faction)}')`;
  document.getElementById('dossier-cost').textContent = card.cost ?? '';
  document.getElementById('dossier-name').textContent = card.name;
  const type = card.type || (card.attack !== undefined ? 'Character' : '');
  document.getElementById('dossier-type').textContent =
    `${type}${card.faction ? ' · ' + factionLabel(card.faction) : ''}`;
  const isChar = card.attack !== undefined && card.attack !== null;
  document.getElementById('dossier-stats').textContent = isChar ? `${card.attack} / ${card.health}` : '';
  document.getElementById('dossier-effect').innerHTML = formatRulesHtml(card.ability || card.effect || '');
  const lore = card.lore || '';
  const loreEl = document.getElementById('dossier-lore');
  loreEl.textContent = lore ? `“${lore}”` : '';
  loreEl.hidden = !lore;
}

function setupDossierInteractions() {
  const root = document.getElementById('screen-game');
  if (!root || root.dataset.dossierReady) return;
  root.dataset.dossierReady = '1';
  root.addEventListener('pointerover', (e) => {
    const el = inspectTarget(e.target);
    if (!el) return;
    const card = resolveInspectCard(el);
    if (card) showDossier(card);
  });
  root.addEventListener('pointerout', (e) => {
    const left = inspectTarget(e.target);
    const entered = inspectTarget(e.relatedTarget);
    if (!left || left === entered) return;
    showDossier(pinnedInspectCard);
  });
  root.addEventListener('click', (e) => {
    const el = inspectTarget(e.target);
    if (!el) return;
    const card = resolveInspectCard(el);
    if (card) {
      pinnedInspectCard = card;
      showDossier(card);
    }
  });
}

/* ---- Hand expand / lift (supports up to 10 cards) ---- */
function setupHandInteractions() {
  const hand = document.getElementById('player-hand');
  if (!hand || hand.dataset.handReady) return;
  hand.dataset.handReady = '1';

  hand.classList.add('collapsed');
  hand.classList.remove('expanded');

  hand.addEventListener('pointerover', (e) => {
    if (document.body.classList.contains('dragging')) return;
    const card = e.target.closest('.card.frame');
    if (!card || !hand.contains(card)) return;
    hand.querySelectorAll('.card.frame.lifted').forEach((c) => c.classList.remove('lifted'));
    card.classList.add('lifted');
  });

  hand.addEventListener('pointerout', (e) => {
    const card = e.target.closest('.card.frame');
    if (card) card.classList.remove('lifted');
  });
}

/* ---- Drag to play / attack (pointer events, click still works) ---- */
const dragState = {
  tracking: false,
  active: false,
  kind: null,
  index: -1,
  startX: 0,
  startY: 0,
  source: null,
};
let dragConsumedClick = false;

function setupDragAndDrop() {
  const root = document.getElementById('screen-game');
  if (!root || root.dataset.dragReady) return;
  root.dataset.dragReady = '1';
  root.addEventListener('pointerdown', onDragPointerDown);
  window.addEventListener('pointermove', onDragPointerMove);
  window.addEventListener('pointerup', onDragPointerUp);
  window.addEventListener('pointercancel', cancelDrag);
  root.addEventListener('click', (e) => {
    if (!dragConsumedClick) return;
    e.stopPropagation();
    e.preventDefault();
    dragConsumedClick = false;
  }, true);
}

function onDragPointerDown(e) {
  if (e.button !== 0) return;
  if (!state || state.is_over) return;
  if (state.pending_discovery || (state.pending_split && pendingSplitIndex === null)) return;
  const me = getMyPlayer();
  if (!me || state.active_player !== me.name || !state.turn_started) return;

  const handCard = e.target.closest('#player-hand .card.frame');
  if (handCard && !handCard.classList.contains('disabled')) {
    const idx = Number(handCard.dataset.handIndex);
    if (Number.isNaN(idx)) return;
    beginDragTrack(e, 'hand', idx, handCard);
    return;
  }
  const minion = e.target.closest('#player-board .card.minion');
  if (minion && !minion.classList.contains('disabled')) {
    const idx = Number(minion.dataset.boardIndex);
    const c = me.board && me.board[idx];
    if (!c || c.attack <= 0 || c.exhausted) return;
    beginDragTrack(e, 'attacker', idx, minion);
  }
}

function beginDragTrack(e, kind, index, source) {
  dragState.tracking = true;
  dragState.active = false;
  dragState.kind = kind;
  dragState.index = index;
  dragState.startX = e.clientX;
  dragState.startY = e.clientY;
  dragState.source = source;
}

function onDragPointerMove(e) {
  if (!dragState.tracking) return;
  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;
  if (!dragState.active) {
    if ((dx * dx + dy * dy) < 64) return;
    startDragGhost();
  }
  const ghost = document.getElementById('drag-ghost');
  if (ghost && !ghost.hidden) {
    ghost.style.left = `${e.clientX}px`;
    ghost.style.top = `${e.clientY}px`;
  }
}

function startDragGhost() {
  dragState.active = true;
  document.body.classList.add('dragging');
  if (dragState.source) dragState.source.classList.add('dragging-source');
  const ghost = document.getElementById('drag-ghost');
  if (ghost && dragState.source) {
    ghost.innerHTML = dragState.source.outerHTML;
    const inner = ghost.querySelector('[onclick]');
    if (inner) inner.removeAttribute('onclick');
    ghost.hidden = false;
    ghost.style.left = `${dragState.startX}px`;
    ghost.style.top = `${dragState.startY}px`;
  }
  highlightDropZones(dragState.kind, dragState.index);
}

function onDragPointerUp(e) {
  if (!dragState.tracking) return;
  const wasActive = dragState.active;
  const kind = dragState.kind;
  const index = dragState.index;
  const x = e.clientX;
  const y = e.clientY;
  endDragVisual();
  if (wasActive) {
    dragConsumedClick = true;
    setTimeout(() => { dragConsumedClick = false; }, 0);
    resolveDrop(kind, index, x, y);
  }
}

function cancelDrag() {
  endDragVisual();
}

function endDragVisual() {
  dragState.tracking = false;
  dragState.active = false;
  document.body.classList.remove('dragging');
  if (dragState.source) dragState.source.classList.remove('dragging-source');
  dragState.source = null;
  const ghost = document.getElementById('drag-ghost');
  if (ghost) {
    ghost.hidden = true;
    ghost.innerHTML = '';
  }
  clearDropHighlights();
}

function highlightDropZones(kind, index) {
  clearDropHighlights();
  const me = getMyPlayer();
  const opp = getOpponent();
  if (!me) return;
  if (kind === 'hand') {
    const card = me.hand && me.hand[index];
    if (!card) return;
    const spec = targetSpec(card);
    if (card.type === 'Character' || card.type === 'Location' || spec.mode === 'none') {
      const board = document.getElementById('player-board');
      if (board) board.classList.add('drop-ready');
    }
    if (card.type === 'Location') {
      const loc = document.getElementById('location-rail');
      if (loc) loc.classList.add('drop-ready');
    }
    if (spec.mode === 'enemy') {
      const legal = targetableEnemies(opp);
      document.querySelectorAll('#opponent-board .card.minion').forEach((el) => {
        const i = Number(el.dataset.boardIndex);
        if (opp.board && legal.includes(opp.board[i])) el.classList.add('drop-ready', 'targetable');
      });
    }
    if (spec.mode === 'ally' || spec.mode === 'ally_or_hero') {
      document.querySelectorAll('#player-board .card.minion').forEach((el) => el.classList.add('drop-ready'));
    }
    if (spec.mode === 'hero' || spec.mode === 'ally_or_hero') {
      const hero = document.querySelector('#player-section .player-header');
      if (hero) hero.classList.add('drop-ready');
    }
    if (card.recycle && me.energy >= 1) {
      const deck = document.getElementById('deck-info');
      if (deck) deck.classList.add('drop-ready');
    }
    return;
  }
  if (kind === 'attacker') {
    const attacker = me.board && me.board[index];
    const legal = targetableEnemies(opp);
    document.querySelectorAll('#opponent-board .card.minion').forEach((el) => {
      const i = Number(el.dataset.boardIndex);
      if (opp.board && legal.includes(opp.board[i])) el.classList.add('drop-ready', 'targetable');
    });
    const face = document.querySelector('#opponent-section .player-header');
    if (face && canAttackFace(opp) && !(attacker && attacker.rush_locked)) {
      face.classList.add('drop-ready', 'face-targetable');
    }
  }
}

function clearDropHighlights() {
  document.querySelectorAll('.drop-ready').forEach((el) => el.classList.remove('drop-ready'));
}

function dropTargetAt(x, y) {
  const ghost = document.getElementById('drag-ghost');
  const prev = ghost ? ghost.style.pointerEvents : '';
  if (ghost) ghost.style.pointerEvents = 'none';
  const el = document.elementFromPoint(x, y);
  if (ghost) ghost.style.pointerEvents = prev || 'none';
  if (!el) return null;
  const enemy = el.closest('#opponent-board .card.minion');
  if (enemy) return { type: 'enemy', index: Number(enemy.dataset.boardIndex) };
  const ally = el.closest('#player-board .card.minion');
  if (ally) return { type: 'ally', index: Number(ally.dataset.boardIndex) };
  if (el.closest('#opponent-section .player-header, [data-drop="face"]')) return { type: 'face' };
  if (el.closest('#player-section .player-header, [data-drop="hero"]')) return { type: 'hero' };
  if (el.closest('#player-location, #location-rail')) return { type: 'location' };
  if (el.closest('#deck-info, [data-drop="deck"]')) return { type: 'deck' };
  if (el.closest('#player-board, [data-drop="board"]')) return { type: 'board' };
  if (el.closest('#table-surface')) return { type: 'table' };
  return null;
}

async function resolveDrop(kind, index, x, y) {
  const target = dropTargetAt(x, y);
  if (!target) return;
  const me = getMyPlayer();
  if (!me) return;

  if (pendingSplitIndex !== null && pendingSpellTarget && target.type === 'enemy' && !Number.isNaN(target.index)) {
    await sendSplit(pendingSplitIndex, target.index);
    return;
  }

  if (kind === 'attacker') {
    selectedAttackerIndex = index;
    attackMode = true;
    selectedCardIndex = null;
    if (target.type === 'enemy' && !Number.isNaN(target.index)) {
      await attackTarget(target.index);
      return;
    }
    if (target.type === 'face') {
      await attackFace();
      return;
    }
    return;
  }

  if (kind !== 'hand') return;
  const card = me.hand && me.hand[index];
  if (!card) return;
  selectedCardIndex = index;
  selectedAttackerIndex = null;
  attackMode = false;
  const spec = targetSpec(card);

  if (target.type === 'deck' && card.recycle && me.energy >= 1) {
    await submitRecycle(index);
    return;
  }
  if (target.type === 'enemy' && spec.mode === 'enemy' && !Number.isNaN(target.index)) {
    await playSelectedCard(target.index, 'enemy');
    return;
  }
  if (target.type === 'ally' && (spec.mode === 'ally' || spec.mode === 'ally_or_hero') && !Number.isNaN(target.index)) {
    await playSelectedCard(target.index, 'ally');
    return;
  }
  if (target.type === 'hero' && (spec.mode === 'hero' || spec.mode === 'ally_or_hero')) {
    await playSelectedCard(null, 'hero');
    return;
  }
  if (target.type === 'location' && card.type === 'Location') {
    await playSelectedCard(null, 'enemy');
    return;
  }
  const ontoField = target.type === 'board' || target.type === 'table' || target.type === 'ally';
  if (ontoField && (card.type === 'Character' || card.type === 'Location' || spec.mode === 'none')) {
    await playSelectedCard(null, 'enemy');
    return;
  }
  if (spec.mode !== 'none') {
    selectedCardIndex = null;
    selectCard(index);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  boot();
  setTimeout(setupHandInteractions, 100);
  setupDossierInteractions();
  setupDragAndDrop();

  const table = document.getElementById('table-surface');
  if (table) {
    table.addEventListener('click', (e) => {
      if (e.target === table || e.target.classList.contains('board-label') || e.target.classList.contains('board') || e.target.classList.contains('combat-gutter') || e.target.classList.contains('board-empty')) {
        if (selectedAttackerIndex !== null || selectedCardIndex !== null || attackMode || pendingSpellTarget) {
          clearSelection();
        }
      }
    });
  }
});
