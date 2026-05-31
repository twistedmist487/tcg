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
let myPlayerName = '';

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

    // Auto-start the first turn (whoever goes first)
    const startData = await api('POST', `/api/game/${sessionId}/start-turn`);
    state = startData.state || startData;
    // If it's not the player's turn, auto-play AI
    const myName = name;
    if (state.active_player !== myName && !state.is_over) {
      addLog(`Opponent (${state.active_player}) goes first.`, 'turn');
      await autoPlayAI();
    } else {
      addLog(`Game started. You go first!`, 'turn');
    }
    await loadState();
  } catch (e) {
    alert('Failed to start game: ' + e.message);
  }
}

async function showGame() {
  document.getElementById('landing').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';
}

async function startGame() {
  const faction = document.querySelector('.faction-btn.selected')?.dataset.faction || 'illuminati';
  const name = document.getElementById('player-name').value || 'Player';
  myPlayerName = name;
  try {
    const data = await api('POST', `/api/game/new?player_name=${encodeURIComponent(name)}&player_faction=${faction}`);
    sessionId = data.session_id;
    showGame();

    // Auto-start the first turn (whoever goes first)
    const startData = await api('POST', `/api/game/${sessionId}/start-turn`);
    state = startData.state || startData;
    // If it's not the player's turn, auto-play AI
    if (state.active_player !== myPlayerName && !state.is_over) {
      addLog(`Opponent (${state.active_player}) goes first.`, 'turn');
      await autoPlayAI();
    } else {
      addLog(`Game started. You go first!`, 'turn');
    }
    await loadState();
  } catch (e) {
    alert('Failed to start game: ' + e.message);
  }
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

  const me = getMyPlayer();
  const opp = state.players.find(p => p !== me) || state.players[0];
  const isMyTurn = me && state.active_player === me.name;

  // Turn info
  const turnEl = document.getElementById('turn-info');
  turnEl.innerHTML = "Turn " + (state.turn_number || 1) + " - <span class=\"" + (isMyTurn ? 'energy' : '') + "\">" + state.active_player + "'s turn</span>";

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
  document.getElementById('player-name-display').textContent = me ? me.name : '?';
  if (me) {
    document.getElementById('player-stats').innerHTML =
      `<span class="life">&#9829; ${me.life}</span>` +
      `<span class="energy">&#9733; ${me.energy}/${me.max_energy}</span>` +
      `<span>Deck: ${me.deck_size}</span>`;
    document.getElementById('player-board').innerHTML = renderBoard(me.board, true);
    document.getElementById('player-hand').innerHTML = renderHand(me.hand || [], me.energy);
  }

  // Button logic:
  // - Start Turn: shown when it's your turn and energy == 0 (turn not started yet)
  // - Play Card: shown when it's your turn and can afford at least one card
  // - Attack: shown when it's your turn and has a character that can attack
  // - End Turn: shown when it's your turn after starting (energy > 0)
  const turnStarted = me && me.energy > 0;
  const canAffordCard = isMyTurn && me && me.hand && me.hand.some(c => me.energy >= c.cost);
  const canAttack = isMyTurn && me && me.board && me.board.some(c => c.current_attack > 0 && !c.exhausted);

  document.getElementById('btn-start-turn').style.display = (isMyTurn && !turnStarted) ? 'inline-block' : 'none';
  document.getElementById('btn-play').style.display = (isMyTurn && turnStarted) ? 'inline-block' : 'none';
  document.getElementById('btn-play').disabled = !canAffordCard;
  document.getElementById('btn-attack').style.display = (isMyTurn && turnStarted) ? 'inline-block' : 'none';
  document.getElementById('btn-attack').disabled = !canAttack;
  document.getElementById('btn-end-turn').style.display = (isMyTurn && turnStarted) ? 'inline-block' : 'none';
  document.getElementById('btn-end-turn').disabled = !isMyTurn;

  // Reset selection
  selectedCardIndex = null;
  selectedAttackerIndex = null;
  attackMode = false;

  // Game over
  if (state.is_over) {
    document.getElementById('game-over').style.display = 'block';
    const youWon = me && state.winner === me.name;
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

async function submitStartTurn() {
  try {
    const data = await api('POST', `/api/game/${sessionId}/start-turn`);
    state = data.state || data;
    addLog(`Turn started. Energy: ${getMyEnergy()}`, 'turn');
    selectedCardIndex = null;
    selectedAttackerIndex = null;
    render();
  } catch (e) {
    addLog('Start turn failed: ' + e.message, 'damage');
  }
}

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

function autoPlayAI() {
  // AI plays its turn - call server endpoints until it ends turn
  // We use the same game engine on the client side to decide AI actions
  // by reading the state and making calls
  return new Promise(async (resolve) => {
    try {
      const myTurnAfterAI = await playAITurn();
      resolve(myTurnAfterAI);
    } catch (e) {
      addLog('AI error: ' + e.message, 'damage');
      resolve(false);
    }
  });
}

async function playAITurn() {
  // Keep taking AI actions until the turn ends or game is over
  const maxSteps = 30;
  for (let step = 0; step < maxSteps; step++) {
    // Always start the turn first (draw, gain energy, clear exhaust)
    let data = await api('POST', `/api/game/${sessionId}/start-turn`);
    state = data.state || data;

    if (state.is_over) {
      await loadState();
      return true;
    }

    const myName = document.getElementById('player-name').value || 'Player';
    // If it's now the human's turn, AI is done
    if (state.active_player === myName) {
      await loadState();
      return true;
    }

    // AI decision loop
    let actionsTaken = 0;
    while (actionsTaken < 20) {
      state = await api('GET', `/api/game/${sessionId}/state`);
      if (state.is_over || state.active_player === myName) break;

      const aiPlayerIdx = state.players.findIndex(p => p.name === state.active_player);
      const aiPlayer = state.players[aiPlayerIdx];

      // Try to play a card
      let played = false;
      if (aiPlayer.hand && aiPlayer.hand.length > 0) {
        // Play highest-cost affordable card
        let bestIdx = -1;
        let bestCost = -1;
        for (let i = 0; i < aiPlayer.hand.length; i++) {
          const card = aiPlayer.hand[i];
          if (aiPlayer.energy >= card.cost && card.cost > bestCost) {
            bestCost = card.cost;
            bestIdx = i;
          }
        }
        if (bestIdx >= 0) {
          const playData = await api('POST', `/api/game/${sessionId}/play?card_index=${bestIdx}`);
          if (playData.action_result?.success) {
            addLog(`AI plays ${playData.action_result.card}`, 'play');
            played = true;
            actionsTaken++;
          }
        }
      }

      // Try to attack
      state = await api('GET', `/api/game/${sessionId}/state`);
      if (state.is_over || state.active_player === myName) break;

      const aiBoard = state.players[aiPlayerIdx].board;
      const oppIdx = aiPlayerIdx === 0 ? 1 : 0;
      const oppBoard = state.players[oppIdx].board;
      const opp = state.players[oppIdx];

      if (aiBoard && aiBoard.length > 0) {
        // Attack with first available character
        for (let ai = 0; ai < aiBoard.length; ai++) {
          if (aiBoard[ai].current_attack > 0 && !aiBoard[ai].exhausted) {
            let targetIdx = null;
            if (oppBoard && oppBoard.length > 0) {
              // Target weakest enemy
              let weakestHP = 999;
              for (let ti = 0; ti < oppBoard.length; ti++) {
                if (oppBoard[ti].health < weakestHP) {
                  weakestHP = oppBoard[ti].health;
                  targetIdx = ti;
                }
              }
            }
            const atkData = await api('POST', `/api/game/${sessionId}/attack`,
              { attacker_index: ai, target_index: targetIdx });
            if (atkData.action_result?.success) {
              const ar = atkData.action_result;
              addLog(`AI: ${ar.attacker} attacks ${ar.target}`, 'damage');
              actionsTaken++;
              break;  // one attack per loop iteration
            }
          }
        }
      }

      // If nothing was done, end turn
      if (!played) {
        break;
      }
    }

    // End AI turn
    await api('POST', `/api/game/${sessionId}/end-turn`);
    addLog('AI ends turn.', 'turn');
    state = await api('GET', `/api/game/${sessionId}/state`);

    const myName2 = document.getElementById('player-name').value || 'Player';
    if (state.is_over || state.active_player === myName2) {
      await loadState();
      return true;
    }
    // Otherwise it's another player's turn (shouldn't happen in 2-player)
    await loadState();
    return true;
  }
  await loadState();
  return true;
}

async function submitEndTurn() {
  try {
    await api('POST', `/api/game/${sessionId}/end-turn`);
    addLog('Turn ended.', 'turn');

    // Load state and let AI play
    await loadState();
    if (!state.is_over) {
      const myName = document.getElementById('player-name').value || 'Player';
      if (state.active_player !== myName) {
        addLog(`${state.active_player} is thinking...`, 'turn');
        await autoPlayAI();
      }
    }
  } catch (e) {
    addLog('End turn failed: ' + e.message, 'damage');
  }
}

// ---- Helpers ----

function getMyPlayer() {
  if (!state) return null;
  // Use the stored player name from game creation
  let me = state.players.find(p => p.name === myPlayerName);
  if (!me) {
    // Fallback: use the non-AI player
    me = state.players.find(p => p.name !== state.players[0].name || p.name === myPlayerName);
  }
  // Last resort: if active player name matches, use that
  if (!me && state.active_player === myPlayerName) {
    me = state.players.find(p => p.name === state.active_player);
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
