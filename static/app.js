/**
 * Conspiracy TCG - Web Frontend
 * Handles game setup, rendering, action input, and server communication.
 */

const API = '';
let state = null;
let sessionId = null;
let selectedCardIndex = null;
let selectedAttackerIndex = null;
let attackMode = false;

// ---- API helpers ----

async function api(method, path, body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== null) opts.body = JSON.stringify(body);
  const resp = await fetch(API + path, opts);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || `HTTP ${resp.status}`);
  }
  return resp.json();
}

// ---- Setup ----

function selectFaction(el) {
  document.querySelectorAll('.faction-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
}

async function startGame() {
  const faction = document.querySelector('.faction-btn.selected')?.dataset.faction || 'illuminati';
  const name = document.getElementById('player-name').value || 'Player';
  try {
    const data = await api('POST', `/api/game/new?player_name=${encodeURIComponent(name)}&player_faction=${faction}`);
    sessionId = data.session_id;
    showGame();
    await loadState();
    addLog(`Game started. You are ${name} (${faction}).`, 'turn');
    addLog(`Opponent: ${data.ai_name} (${data.ai_faction}).`, 'turn');
  } catch (e) {
    alert('Failed to start game: ' + e.message);
  }
}

function showGame() {
  document.getElementById('landing').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';
}

// ---- State loading ----

async function loadState() {
  try {
    state = await api('GET', `/api/game/${sessionId}/state`);
    render();
  } catch (e) {
    addLog('Error loading state: ' + e.message, 'damage');
  }
}

// ---- Rendering ----

function render() {
  if (!state) return;

  const me = state.players[state.active_player_index === 0 ? 0 : 1];
  const opp = state.players[state.active_player_index === 0 ? 1 : 0];
  const playerIdx = state.active_player_index;

  // Turn info
  const isMyTurn = state.active_player === (document.getElementById('player-name').value || 'Player');
  const turnEl = document.getElementById('turn-info');
  turnEl.innerHTML = `Turn ${state.turn_number} — <span class="${isMyTurn ? 'energy' : ''}">${state.active_player}'s turn</span>`;

  // Highlight active section
  document.getElementById('player-section').classList.toggle('active', isMyTurn);
  document.getElementById('opponent-section').classList.toggle('active', !isMyTurn);

  // Opponent
  document.getElementById('opponent-name').textContent = opp.name;
  document.getElementById('opponent-stats').innerHTML =
    `<span class="life">&#9829; ${opp.life}</span>` +
    `<span class="energy">&#9733; ${opp.energy}/${opp.max_energy}</span>` +
    `<span>Deck: ${opp.deck_size}</span>`;
  document.getElementById('opponent-hand-count').textContent = opp.hand_size;
  document.getElementById('opponent-hand').innerHTML = renderHiddenHand(opp.hand_size);
  document.getElementById('opponent-board').innerHTML = renderBoard(opp.board, false);

  // Player
  document.getElementById('player-name-display').textContent = me.name;
  document.getElementById('player-stats').innerHTML =
    `<span class="life">&#9829; ${me.life}</span>` +
    `<span class="energy">&#9733; ${me.energy}/${me.max_energy}</span>` +
    `<span>Deck: ${me.deck_size}</span>`;
  document.getElementById('player-board').innerHTML = renderBoard(me.board, true, me.name);
  document.getElementById('player-hand').innerHTML = renderHand(me.hand, me.energy);

  // Buttons
  const canAct = isMyTurn && !state.is_over;
  document.getElementById('btn-play').disabled = !canAct;
  document.getElementById('btn-attack').disabled = !canAct;
  document.getElementById('btn-end-turn').disabled = !isMyTurn;

  // Reset selection
  selectedCardIndex = null;
  selectedAttackerIndex = null;
  attackMode = false;

  // Game over
  if (state.is_over) {
    document.getElementById('game-over').style.display = 'block';
    const youWon = state.winner === me.name;
    document.getElementById('game-over-text').textContent = youWon ? 'VICTORY' : 'DEFEAT';
    document.getElementById('game-over-text').className = youWon ? 'winner' : 'loser';
    document.getElementById('game-over-sub').textContent = `${state.winner} has won the game!`;
  }
}

function renderHiddenHand(count) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `<div class="card disabled" style="opacity:0.3;">
      <div class="card-name">???</div>
      <div class="card-type-icon">&#10022;</div>
    </div>`;
  }
  if (count === 0) html += `<div style="color:var(--text-muted);font-size:0.8em;">(empty)</div>`;
  return html;
}

function renderBoard(board, isPlayer) {
  let html = '';
  if (board.length === 0) {
    html += `<div style="color:var(--text-muted);font-size:0.8em;">(empty)</div>`;
    return html;
  }
  board.forEach((c, i) => {
    const factionClass = getFactionClass(c.faction);
    const canAttack = isPlayer && c.current_attack > 0 && !c.exhausted;
    const damaged = c.damage_taken > 0;
    const selected = isPlayer && i === selectedAttackerIndex;
    html += `<div class="card ${factionClass} ${selected ? 'selected' : ''} ${!canAttack && isPlayer ? 'disabled' : ''}"
                  onclick="${isPlayer ? `selectAttacker(${i})` : ''}">
      <div class="card-cost">${c.cost}</div>
      <div class="card-name" title="${c.name}">${c.name}</div>
      <div class="card-stats">
        <span class="attack">&#9876; ${c.current_attack}</span>
        <span class="health">&#9829; ${c.health}</span>
      </div>
      ${c.exhausted ? '<div style="font-size:0.7em;color:var(--text-muted);">Exhausted</div>' : ''}
      ${c.stealth ? '<div style="font-size:0.7em;color:#1abc9c;">Stealth</div>' : ''}
      ${c.silenced ? '<div style="font-size:0.7em;color:#c0392b;">Silenced</div>' : ''}
      ${damaged ? `<div class="damage-overlay">-${c.damage_taken}</div>` : ''}
    </div>`;
  });
  return html;
}

function renderHand(hand, energy) {
  let html = '';
  if (!hand || hand.length === 0) {
    html += `<div style="color:var(--text-muted);font-size:0.8em;">(empty)</div>`;
    return html;
  }
  hand.forEach((c, i) => {
    const canAfford = energy >= c.cost;
    const selected = i === selectedCardIndex;
    const factionClass = getFactionClass(c.faction);
    const typeIcon = getTypeIcon(c.type);

    html += `<div class="card ${factionClass} ${selected ? 'selected' : ''} ${!canAfford ? 'disabled' : ''}"
                  onclick="${canAfford ? `selectCard(${i})` : ''}">
      <div class="card-cost">${c.cost}</div>
      <div class="card-type-icon">${typeIcon}</div>
      <div class="card-name" title="${c.name}">${c.name}</div>
      ${c.attack !== undefined && c.health !== undefined ? `<div class="card-stats">
        <span class="attack">&#9876; ${c.attack}</span>
        <span class="health">&#9829; ${c.health}</span>
      </div>` : ''}
      ${c.ability ? `<div class="card-ability">${escHtml(c.ability.substring(0, 60))}${c.ability.length > 60 ? '...' : ''}</div>` : ''}
      ${c.effect ? `<div class="card-effect">${escHtml(c.effect.substring(0, 60))}${c.effect.length > 60 ? '...' : ''}</div>` : ''}
      <div class="card-lore">${escHtml(c.lore.substring(0, 40))}...</div>
    </div>`;
  });
  return html;
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function getFactionClass(faction) {
  if (faction === 'illuminati') return 'illuminati';
  if (faction === 'templars') return 'templars';
  if (faction === 'reptilians') return 'reptilians';
  return '';
}

function getTypeIcon(type) {
  if (type === 'Character') return '&#9764;';
  if (type === 'Spell') return '&#9733;';
  if (type === 'Location') return '&#9783;';
  return '?';
}

// ---- Selection ----

function selectCard(index) {
  if (!state) return;
  const hand = getMyHand();
  if (index < 0 || index >= hand.length) return;
  const myPlayer = getMyPlayer();
  if (!myPlayer || myPlayer.energy < hand[index].cost) return;

  selectedCardIndex = (selectedCardIndex === index) ? null : index;
  attackMode = false;
  selectedAttackerIndex = null;
  render();
}

function selectAttacker(index) {
  if (!state) return;
  const board = getMyBoard();
  if (index < 0 || index >= board.length) return;
  const c = board[index];
  if (c.current_attack <= 0 || c.is_exhausted) return;

  attackMode = true;
  selectedAttackerIndex = (selectedAttackerIndex === index) ? null : index;
  selectedCardIndex = null;
  render();
}

// ---- Action submission ----

async function submitPlay() {
  if (selectedCardIndex === null) return;
  try {
    const data = await api('POST', `/api/game/${sessionId}/play?card_index=${selectedCardIndex}`);
    if (data.action_result?.success) {
      addLog(`Played ${data.action_result.card}`, 'play');
    } else {
      addLog(`Cannot play: ${data.action_result?.error || 'unknown'}`, 'damage');
    }
    selectedCardIndex = null;
    await loadState();
  } catch (e) {
    addLog('Play failed: ' + e.message, 'damage');
  }
}

async function submitAttack() {
  if (!attackMode || selectedAttackerIndex === null) return;

  // If opponent has board, need to pick a target
  const oppBoard = state.players[state.active_player_index === 0 ? 1 : 0].board;
  let targetIndex = null;

  if (oppBoard.length > 0) {
    // Simple: let user click target on opponent board
    // For now, auto-target first available (simplified MVP)
    targetIndex = 0;
  }

  try {
    const body = { attacker_index: selectedAttackerIndex };
    if (targetIndex !== null) body.target_index = targetIndex;

    const data = await api('POST', `/api/game/${sessionId}/attack`, body);
    if (data.action_result?.success) {
      const ar = data.action_result;
      addLog(`${ar.attacker} attacks ${ar.target} (${ar.damage_dealt} dmg)`, 'damage');
      if (ar.killed_target) addLog(`${ar.target} slain!`, 'damage');
      if (ar.killed_attacker) addLog(`${ar.attacker} died!`, 'damage');
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

async function submitEndTurn() {
  try {
    await api('POST', `/api/game/${sessionId}/end-turn`);
    addLog('Turn ended.', 'turn');
    // AI turn — load state after a delay
    await loadState();
    if (!state.is_over && state.active_player !== (document.getElementById('player-name').value || 'Player')) {
      addLog(`${state.active_player} is thinking...`, 'turn');
      await loadState();
    }
  } catch (e) {
    addLog('End turn failed: ' + e.message, 'damage');
  }
}

// ---- Helpers ----

function getMyPlayer() {
  if (!state) return null;
  // The player whose name matches the input field name
  const myName = document.getElementById('player-name').value || 'Player';
  // Try to find by name first
  let me = state.players.find(p => p.name === myName);
  if (!me) {
    // Fallback: if names don't match (e.g. after restart), use the non-AI player
    me = state.players.find(p => !p.name.startsWith('Overmind') && !p.name.startsWith('Admiral') && !p.name.startsWith('Agent'));
  }
  return me;
}

function getMyHand() {
  const me = getMyPlayer();
  return me && me.hand ? me.hand : [];
}

function getMyBoard() {
  const me = getMyPlayer();
  return me && me.board ? me.board : [];
}

function getMyEnergy() {
  const me = getMyPlayer();
  return me ? me.energy : 0;
}

function addLog(msg, type = '') {
  const log = document.getElementById('log');
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  entry.textContent = msg;
  log.prepend(entry);
  // Keep last 50 entries
  while (log.children.length > 50) log.removeChild(log.lastChild);
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  // Faction icons fallback (unicode symbols that work without font)
  document.querySelectorAll('.faction-btn .icon').forEach(el => {
    if (el.textContent.trim() === '') el.textContent = '★';
  });
});
