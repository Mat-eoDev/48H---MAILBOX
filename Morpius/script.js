const GAME_NAME = "Morpius";
const GAME_TAGLINE = "Le morpion où même tes propres pièces te détestent.";
const REQUIRED_PLAYER_WINS = 3;
const LOST_PROGRESS_FOR_EASY_MODE = 3;

const PLAYER_MOD_CHANCE = 0.5;
const PLAYER_FLIP_SHARE = 0.12;
const AI_MOD_CHANCE = 0.3;
const AI_TURN_DELAY = 900;
const MOVE_ANIMATION_DURATION = 280;
const PUSH_ANIMATION_DURATION = 360;
const ENDGAME_DELAY = 420;
const ROUND_RESET_DELAY = 2000;
const PIECE_APPEAR_DELAY = 170;
const REJECT_FEEDBACK_DURATION = 220;

const STATUS_MESSAGES = {
  playerTurn: "À toi de jouer.",
  aiThinking: "L'IA réfléchit...",
  aiPlay: "L'IA joue...",
  playerWin: "Tu as gagné cette manche.",
  aiWin: "L'IA gagne.",
  aiWinSaved: "L'IA gagne. Ton score reste sauvegardé.",
  draw: "Match nul."
};

const POPUP_COPY = {
  firstRuleReveal: {
    kicker: "Pas si vite",
    title: "Allez, encore 2.",
    body: "Une victoire, c'était l'accroche. En vrai, il t'en faut trois avant d'avoir le code.",
    actionLabel: "Continuer"
  },
  firstAiLoss: {
    kicker: "Évidemment",
    title: "Retour à 0.",
    body: "Quand l'IA te bat, ton compteur repart à zéro. Il valait mieux ne pas perdre maintenant.",
    actionLabel: "Continuer"
  },
  finalWin: {
    kicker: "Enfin",
    title: "Tu as fini par l'obtenir.",
    body: "Tu as tenu jusqu'au bout. Surveille ta boîte de réception, je t'envoie la suite par mail.",
    actionLabel: "Continuer"
  },
  easyModeUnlock: {
    kicker: "Bon, ça suffit",
    title: "Tu es trop mauvais.",
    body: "Tu as déjà perdu trop de progression. À partir de maintenant, une défaite contre l'IA ne te renverra plus à zéro, et une seule victoire suffira pour terminer l'épreuve.",
    actionLabel: "Continuer"
  }
};

const DIRECTIONS = [
  { key: "up", row: -1, col: 0 },
  { key: "right", row: 0, col: 1 },
  { key: "down", row: 1, col: 0 },
  { key: "left", row: 0, col: -1 }
];

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

const state = {
  board: Array(9).fill(null),
  isGameOver: false,
  isAnimating: false,
  isAiTurn: false,
  isModalOpen: false,
  clicksEnabled: true,
  winningLine: [],
  hiddenIndices: new Set(),
  lastPlacedIndex: null,
  lastResolvedIndex: null,
  rejectedIndex: null,
  currentMessage: "",
  resultTone: "",
  actionToken: 0,
  playerWins: 0,
  lostVictoryBars: 0,
  goalRevealed: false,
  codeUnlocked: false,
  lossProtectionUnlocked: false,
  firstAiLossExplained: false
};

const dom = {};

document.addEventListener("DOMContentLoaded", () => {
  cacheDom();
  hydrateStaticCopy();
  bindEvents();
  resetGame();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.add("is-loaded");
      startBootSequence();
    });
  });
});

function cacheDom() {
  dom.gameCard = document.querySelector(".game-card");
  dom.board = document.getElementById("board");
  dom.boardFrame = document.getElementById("board-frame");
  dom.cells = Array.from(document.querySelectorAll(".cell"));
  dom.title = document.getElementById("game-title");
  dom.tagline = document.getElementById("game-tagline");
  dom.statusMessage = document.getElementById("status-message");
  dom.turnBadge = document.getElementById("turn-badge");
  dom.goalLabel = document.getElementById("goal-label");
  dom.goalText = document.getElementById("goal-text");
  dom.progressStrip = document.getElementById("progress-strip");
  dom.progressCount = document.getElementById("progress-count");
  dom.winDots = Array.from(document.querySelectorAll("[data-win-dot]"));
  dom.modalBackdrop = document.getElementById("modal-backdrop");
  dom.modalKicker = document.getElementById("modal-kicker");
  dom.modalTitle = document.getElementById("modal-title");
  dom.modalBody = document.getElementById("modal-body");
  dom.modalAction = document.getElementById("modal-action");
  dom.bootSequence = document.getElementById("boot-sequence");
}

function hydrateStaticCopy() {
  document.title = GAME_NAME;
  dom.title.textContent = GAME_NAME;
  dom.tagline.textContent = GAME_TAGLINE;
}

function bindEvents() {
  dom.cells.forEach((cell) => {
    cell.addEventListener("click", handleCellClick);
  });
}

function resetGame() {
  state.actionToken += 1;
  resetRoundState();
  updateMessage(STATUS_MESSAGES.playerTurn);
  clearBoardEffects();
  hideModal();
  render();
}

function startBootSequence() {
  if (!dom.bootSequence) {
    return;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const exitDelay = reducedMotion ? 160 : 1160;
  const hideDelay = reducedMotion ? 220 : 1620;

  window.setTimeout(() => {
    dom.bootSequence.classList.add("is-hidden");
  }, exitDelay);

  window.setTimeout(() => {
    dom.bootSequence.hidden = true;
  }, hideDelay);
}

async function handleCellClick(event) {
  const startIndex = Number(event.currentTarget.dataset.index);

  if (!canPlayCell(startIndex)) {
    return;
  }

  state.clicksEnabled = false;
  render();

  const token = state.actionToken;
  await runTurn({ symbol: "X", startIndex, actor: "player", token });

  if (isStale(token) || state.isGameOver) {
    return;
  }

  state.isAiTurn = true;
  updateMessage(STATUS_MESSAGES.aiThinking);
  render();

  await delay(AI_TURN_DELAY);
  if (isStale(token) || state.isGameOver) {
    return;
  }

  const aiIndex = chooseAiPlacement(state.board);
  if (aiIndex === null) {
    const outcome = evaluateBoard(state.board, "O");
    if (outcome.draw) {
      await finishGame(outcome, token);
    }
    return;
  }

  updateMessage(STATUS_MESSAGES.aiPlay);
  render();
  await runTurn({ symbol: "O", startIndex: aiIndex, actor: "ai", token });

  if (isStale(token) || state.isGameOver) {
    return;
  }

  state.isAiTurn = false;
  state.clicksEnabled = true;
  updateMessage(STATUS_MESSAGES.playerTurn);
  render();
}

async function runTurn({ symbol, startIndex, actor, token }) {
  if (state.board[startIndex] !== null || isStale(token)) {
    return;
  }

  let activeSymbol = symbol;

  state.board[startIndex] = activeSymbol;
  state.lastPlacedIndex = startIndex;
  state.lastResolvedIndex = startIndex;
  render({ popIndex: startIndex });

  await delay(PIECE_APPEAR_DELAY);
  if (isStale(token)) {
    return;
  }

  const effect = chooseTurnEffect(actor);

  if (effect === "flip") {
    activeSymbol = flipPlacedSymbol(startIndex, activeSymbol);
    render({ popIndex: startIndex });
    await delay(Math.max(120, Math.round(MOVE_ANIMATION_DURATION * 0.45)));
    if (isStale(token)) {
      return;
    }
  }

  const direction = effect === "move" ? chooseSlideDirection() : null;
  const resolution = resolveSlide(state.board, startIndex, direction);

  if (resolution.moved) {
    await animateResolution(resolution, token);
    if (isStale(token)) {
      return;
    }
  } else {
    state.lastResolvedIndex = startIndex;
    if (direction && resolution.blocked) {
      render();
      await playRejectedFeedback(startIndex, token);
      if (isStale(token)) {
        return;
      }
    } else {
      render();
    }
  }

  const outcome = evaluateBoard(state.board, activeSymbol);
  if (outcome.winner || outcome.draw) {
    await finishGame(outcome, token);
  }
}

function chooseSlideDirection() {
  return pickRandom(DIRECTIONS).key;
}

function resolveSlide(board, startIndex, direction) {
  const finalBoard = board.slice();
  const activeSymbol = board[startIndex];

  if (!direction || !activeSymbol) {
    return {
      finalBoard,
      moves: [],
      moved: false,
      blocked: false,
      didPush: false,
      exited: false,
      finalIndex: startIndex
    };
  }

  const targetIndex = getNeighborIndex(startIndex, direction);
  if (targetIndex === null) {
    finalBoard[startIndex] = null;
    return {
      finalBoard,
      moves: [{ from: startIndex, to: null, symbol: activeSymbol, exitDirection: direction }],
      moved: true,
      blocked: false,
      didPush: false,
      exited: true,
      finalIndex: null
    };
  }

  if (board[targetIndex] === null) {
    finalBoard[startIndex] = null;
    finalBoard[targetIndex] = activeSymbol;
    return {
      finalBoard,
      moves: [{ from: startIndex, to: targetIndex, symbol: activeSymbol }],
      moved: true,
      blocked: false,
      didPush: false,
      exited: false,
      finalIndex: targetIndex
    };
  }

  const chain = [];
  let cursor = targetIndex;

  while (cursor !== null && board[cursor] !== null) {
    chain.push(cursor);
    cursor = getNeighborIndex(cursor, direction);
  }

  if (cursor === null) {
    return {
      finalBoard,
      moves: [],
      moved: false,
      blocked: true,
      didPush: false,
      exited: false,
      finalIndex: startIndex
    };
  }

  const moves = [];

  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const from = chain[index];
    const to = index === chain.length - 1 ? cursor : chain[index + 1];
    finalBoard[to] = board[from];
    moves.push({ from, to, symbol: board[from] });
  }

  finalBoard[startIndex] = null;
  finalBoard[targetIndex] = activeSymbol;
  moves.push({ from: startIndex, to: targetIndex, symbol: activeSymbol });

  return {
    finalBoard,
    moves,
    moved: true,
    blocked: false,
    didPush: true,
    exited: false,
    finalIndex: targetIndex
  };
}

async function animateResolution(resolution, token) {
  const duration = resolution.didPush ? PUSH_ANIMATION_DURATION : MOVE_ANIMATION_DURATION;
  const boardRect = dom.board.getBoundingClientRect();
  const layer = document.createElement("div");
  layer.className = "piece-layer";

  const ghosts = resolution.moves.map((move) => {
    const sourceCell = dom.cells[move.from];
    const sourcePiece = sourceCell.querySelector(".piece");
    if (!sourcePiece) {
      return null;
    }
    const sourceRect = sourceCell.getBoundingClientRect();
    const ghost = sourcePiece.cloneNode(true);
    let deltaX = 0;
    let deltaY = 0;

    ghost.classList.add("piece--ghost");
    ghost.classList.remove("piece--pop", "piece--hidden");
    ghost.style.left = `${sourceRect.left - boardRect.left}px`;
    ghost.style.top = `${sourceRect.top - boardRect.top}px`;
    ghost.style.width = `${sourceRect.width}px`;
    ghost.style.height = `${sourceRect.height}px`;
    ghost.style.transition = `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${duration}ms ease`;

    if (move.to === null) {
      const vector = getDirectionVector(move.exitDirection);
      deltaX = vector.col * sourceRect.width * 1.08;
      deltaY = vector.row * sourceRect.height * 1.08;
      ghost.style.opacity = "1";
    } else {
      const targetCell = dom.cells[move.to];
      const targetRect = targetCell.getBoundingClientRect();
      deltaX = targetRect.left - sourceRect.left;
      deltaY = targetRect.top - sourceRect.top;
    }

    layer.appendChild(ghost);

    return {
      ghost,
      deltaX,
      deltaY,
      exits: move.to === null
    };
  }).filter(Boolean);

  dom.board.appendChild(layer);

  state.isAnimating = true;
  state.board = resolution.finalBoard.slice();
  state.lastResolvedIndex = resolution.finalIndex;
  state.hiddenIndices = new Set(
    resolution.moves
      .filter((move) => move.to !== null)
      .map((move) => move.to)
  );
  render();

  await nextFrame();
  if (isStale(token)) {
    layer.remove();
    return;
  }

  if (resolution.didPush) {
    dom.board.classList.add("is-shove");
  }

  ghosts.forEach(({ ghost, deltaX, deltaY, exits }) => {
    ghost.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
    if (exits) {
      ghost.style.opacity = "0";
    }
  });

  await delay(duration + 40);
  layer.remove();
  dom.board.classList.remove("is-shove");

  if (isStale(token)) {
    return;
  }

  state.isAnimating = false;
  state.hiddenIndices = new Set();
  render();
}

async function playRejectedFeedback(index, token) {
  state.isAnimating = true;
  state.rejectedIndex = index;
  render();

  await nextFrame();
  dom.board.classList.add("is-rejecting");
  await delay(REJECT_FEEDBACK_DURATION);
  dom.board.classList.remove("is-rejecting");

  if (isStale(token)) {
    return;
  }

  state.isAnimating = false;
  state.rejectedIndex = null;
  render();
}

function chooseAiPlacement(board) {
  const available = getAvailableMoves(board);
  if (!available.length) {
    return null;
  }

  const winningMove = findTacticalMove(board, available, "O");
  if (winningMove !== null) {
    return winningMove;
  }

  const blockingMove = findTacticalMove(board, available, "X");
  if (blockingMove !== null) {
    return blockingMove;
  }

  const preferredGroups = [
    [4],
    [0, 2, 6, 8],
    [1, 3, 5, 7]
  ];

  for (const group of preferredGroups) {
    const candidates = group.filter((index) => available.includes(index));
    if (candidates.length) {
      return pickRandom(candidates);
    }
  }

  return pickRandom(available);
}

function findTacticalMove(board, candidates, symbol) {
  const winningCandidates = candidates.filter((index) => {
    const simulatedBoard = board.slice();
    simulatedBoard[index] = symbol;
    const outcome = evaluateBoard(simulatedBoard, symbol);
    return outcome.winner === symbol;
  });

  return winningCandidates.length ? pickRandom(winningCandidates) : null;
}

function evaluateBoard(board, lastMoverSymbol) {
  const wins = { X: [], O: [] };

  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    const symbol = board[a];

    if (symbol && symbol === board[b] && symbol === board[c]) {
      wins[symbol].push(line);
    }
  }

  if (wins.X.length && wins.O.length) {
    const winner = lastMoverSymbol === "X" ? "O" : "X";
    return { winner, line: wins[winner][0], draw: false };
  }

  if (wins.X.length) {
    return { winner: "X", line: wins.X[0], draw: false };
  }

  if (wins.O.length) {
    return { winner: "O", line: wins.O[0], draw: false };
  }

  if (board.every((cell) => cell !== null)) {
    return { winner: null, line: null, draw: true };
  }

  return { winner: null, line: null, draw: false };
}

async function finishGame(outcome, token) {
  state.isGameOver = true;
  state.isAiTurn = false;
  state.clicksEnabled = false;
  render();

  await delay(ENDGAME_DELAY);
  if (isStale(token)) {
    return;
  }

  if (outcome.winner) {
    state.winningLine = outcome.line.slice();
    state.resultTone = outcome.winner === "X" ? "player" : "ai";
    if (outcome.winner === "X") {
      updateMessage(STATUS_MESSAGES.playerWin);
    } else {
      const lostProgress = state.lossProtectionUnlocked || state.codeUnlocked ? 0 : state.playerWins;
      state.lostVictoryBars += lostProgress;
      if (!state.codeUnlocked && !state.lossProtectionUnlocked) {
        state.playerWins = 0;
      }
      updateMessage(
        state.lossProtectionUnlocked
          ? STATUS_MESSAGES.aiWinSaved
          : STATUS_MESSAGES.aiWin
      );
    }
  } else {
    state.resultTone = "draw";
    updateMessage(STATUS_MESSAGES.draw);
  }

  render();

  if (outcome.winner === "X") {
    await handlePlayerVictoryProgress(token);
    return;
  }

  if (outcome.winner === "O" && !state.lossProtectionUnlocked && state.lostVictoryBars >= LOST_PROGRESS_FOR_EASY_MODE) {
    state.lossProtectionUnlocked = true;
    render();
    await showModal({ ...POPUP_COPY.easyModeUnlock, requireAction: true }, token);
    if (isStale(token)) {
      return;
    }
    hideModal();
    resetGame();
    return;
  }

  if (outcome.winner === "O" && state.goalRevealed && !state.lossProtectionUnlocked && !state.firstAiLossExplained) {
    state.firstAiLossExplained = true;
    render();
    await showModal({ ...POPUP_COPY.firstAiLoss, requireAction: true }, token);
    if (isStale(token)) {
      return;
    }
    hideModal();
    resetGame();
    return;
  }

  await delay(ROUND_RESET_DELAY);
  if (isStale(token)) {
    return;
  }

  resetGame();
}

function render(options = {}) {
  renderBoard(options.popIndex ?? null);
  renderStatus();
  renderProgress();
}

function renderBoard(popIndex = null) {
  const boardIsLocked = state.isAnimating || state.isAiTurn || state.isGameOver || state.isModalOpen;

  dom.board.setAttribute("aria-busy", String(boardIsLocked));
  dom.boardFrame.classList.toggle("is-locked", state.isAnimating || state.isAiTurn || state.isModalOpen);
  dom.gameCard.dataset.result = state.resultTone;

  dom.cells.forEach((cell, index) => {
    const symbol = state.board[index];
    const isAvailable = canPlayCell(index);
    const isWinning = state.winningLine.includes(index);
    const isLast = state.lastResolvedIndex === index;
    const isHidden = state.hiddenIndices.has(index);
    const isRejected = state.rejectedIndex === index;

    cell.classList.toggle("is-filled", Boolean(symbol));
    cell.classList.toggle("is-available", isAvailable);
    cell.classList.toggle("is-locked", !isAvailable && !state.isGameOver);
    cell.classList.toggle("is-winning", isWinning);
    cell.classList.toggle("is-last", isLast);
    cell.classList.toggle("is-rejected", isRejected);
    cell.disabled = !isAvailable;
    cell.setAttribute("aria-label", buildAriaLabel(index, symbol));

    if (!symbol) {
      cell.innerHTML = "";
      return;
    }

    const pieceClasses = [
      "piece",
      symbol === "X" ? "piece--x" : "piece--o"
    ];

    if (index === popIndex) {
      pieceClasses.push("piece--pop");
    }

    if (isHidden) {
      pieceClasses.push("piece--hidden");
    }

    cell.innerHTML = `<span class="${pieceClasses.join(" ")}">${symbol}</span>`;
  });
}

function renderStatus() {
  dom.statusMessage.textContent = state.currentMessage;

  if (state.isGameOver) {
    dom.turnBadge.textContent = "Fin";
    dom.turnBadge.className = "turn-badge is-end";
    return;
  }

  if (state.isModalOpen) {
    dom.turnBadge.textContent = "Pause";
    dom.turnBadge.className = "turn-badge is-end";
    return;
  }

  if (state.isAiTurn) {
    dom.turnBadge.textContent = "IA";
    dom.turnBadge.className = "turn-badge is-ai";
    return;
  }

  dom.turnBadge.textContent = "À toi";
  dom.turnBadge.className = "turn-badge is-player";
}

function canPlayCell(index) {
  return (
    state.clicksEnabled &&
    !state.isGameOver &&
    !state.isAnimating &&
    !state.isAiTurn &&
    !state.isModalOpen &&
    state.board[index] === null
  );
}

function renderProgress() {
  const targetWins = getRequiredWins();

  if (state.codeUnlocked) {
    dom.goalLabel.textContent = "Expérience validée";
    dom.goalText.textContent = `Le hacker peut maintenant t'envoyer la suite après ${targetWins} victoire${targetWins > 1 ? "s" : ""}.`;
  } else if (state.goalRevealed) {
    dom.goalLabel.textContent = "Objectif réel";
    dom.goalText.textContent = state.lossProtectionUnlocked
      ? `Mode facile actif: une seule victoire suffit désormais, et ton score est sauvegardé.`
      : `${REQUIRED_PLAYER_WINS} victoires sont finalement nécessaires.`;
  } else {
    dom.goalLabel.textContent = "Objectif annoncé";
    dom.goalText.textContent = "Une victoire suffit pour repartir avec le code.";
  }

  dom.progressStrip.classList.toggle("is-concealed", !state.goalRevealed && !state.codeUnlocked);
  dom.progressCount.textContent = `${Math.min(state.playerWins, targetWins)} / ${targetWins} victoire${targetWins > 1 ? "s" : ""}`;

  dom.winDots.forEach((dot, index) => {
    dot.classList.toggle("is-earned", index < Math.min(state.playerWins, targetWins));
    dot.hidden = index >= targetWins;
  });
}

function buildAriaLabel(index, symbol) {
  const slot = `Case ${index + 1}`;
  if (!symbol) {
    return `${slot}, vide`;
  }
  return `${slot}, ${symbol === "X" ? "X du joueur" : "O de l'ordinateur"}`;
}

function getAvailableMoves(board) {
  return board.flatMap((cell, index) => (cell === null ? [index] : []));
}

function getNeighborIndex(index, directionKey) {
  const direction = DIRECTIONS.find((item) => item.key === directionKey);
  const { row, col } = toRowCol(index);
  const nextRow = row + direction.row;
  const nextCol = col + direction.col;

  if (!isInsideGrid(nextRow, nextCol)) {
    return null;
  }

  return toIndex(nextRow, nextCol);
}

function getDirectionVector(directionKey) {
  const direction = DIRECTIONS.find((item) => item.key === directionKey);
  return direction || { row: 0, col: 0 };
}

function toRowCol(index) {
  return {
    row: Math.floor(index / 3),
    col: index % 3
  };
}

function toIndex(row, col) {
  return row * 3 + col;
}

function isInsideGrid(row, col) {
  return row >= 0 && row < 3 && col >= 0 && col < 3;
}

function updateMessage(message) {
  state.currentMessage = message;
  if (dom.statusMessage) {
    dom.statusMessage.textContent = message;
  }
}

function clearBoardEffects() {
  dom.board.classList.remove("is-shove", "is-rejecting");
  dom.boardFrame.classList.remove("is-locked");
  dom.gameCard.dataset.result = "";
  dom.board.querySelectorAll(".piece-layer").forEach((layer) => layer.remove());
}

function chooseTurnEffect(actor) {
  if (actor === "player") {
    if (Math.random() >= PLAYER_MOD_CHANCE) {
      return "none";
    }
    return Math.random() < PLAYER_FLIP_SHARE ? "flip" : "move";
  }

  if (Math.random() >= AI_MOD_CHANCE) {
    return "none";
  }

  return "move";
}

function flipPlacedSymbol(index, symbol) {
  const flippedSymbol = symbol === "X" ? "O" : "X";
  state.board[index] = flippedSymbol;
  return flippedSymbol;
}

async function handlePlayerVictoryProgress(token) {
  const targetWins = getRequiredWins();

  if (state.playerWins >= targetWins) {
    return;
  }

  state.playerWins += 1;

  if (!state.goalRevealed) {
    state.goalRevealed = true;
    render();
    await showModal({ ...POPUP_COPY.firstRuleReveal, requireAction: true }, token);
  } else if (state.playerWins < targetWins) {
    render();
    await delay(ROUND_RESET_DELAY);
  } else {
    state.codeUnlocked = true;
    render();
    await showModal({ ...POPUP_COPY.finalWin, requireAction: true }, token);
  }

  if (isStale(token)) {
    return;
  }

  hideModal();
  resetGame();
}

function resetRoundState() {
  state.board = Array(9).fill(null);
  state.isGameOver = false;
  state.isAnimating = false;
  state.isAiTurn = false;
  state.isModalOpen = false;
  state.clicksEnabled = true;
  state.winningLine = [];
  state.hiddenIndices = new Set();
  state.lastPlacedIndex = null;
  state.lastResolvedIndex = null;
  state.rejectedIndex = null;
  state.resultTone = "";
}

function getRequiredWins() {
  return state.lossProtectionUnlocked ? 1 : REQUIRED_PLAYER_WINS;
}

function showModal(config, token) {
  state.isModalOpen = true;
  dom.modalKicker.textContent = config.kicker;
  dom.modalTitle.textContent = config.title;
  dom.modalBody.textContent = config.body;
  dom.modalAction.textContent = config.actionLabel || "Continuer";
  dom.modalAction.hidden = !config.requireAction;
  dom.modalBackdrop.hidden = false;
  render();

  return new Promise((resolve) => {
    if (config.requireAction) {
      dom.modalAction.onclick = () => {
        if (isStale(token)) {
          resolve();
          return;
        }
        resolve();
      };
      return;
    }

    window.setTimeout(() => {
      if (isStale(token)) {
        resolve();
        return;
      }
      resolve();
    }, ROUND_RESET_DELAY);
  });
}

function hideModal() {
  state.isModalOpen = false;
  dom.modalBackdrop.hidden = true;
  dom.modalAction.hidden = true;
  dom.modalAction.onclick = null;
}

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function isStale(token) {
  return token !== state.actionToken;
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function nextFrame() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}
