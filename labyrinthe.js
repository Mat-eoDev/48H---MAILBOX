/**
 * labyrinthe.js
 * Générateur de labyrinthe DFS (recursive backtracker) + logique joueur.
 */

// ─── Générateur ────────────────────────────────────────────────────────────────

/**
 * Génère une grille de labyrinthe (matrice 0/1) avec une entrée et une sortie.
 * @param {number} size - Taille demandée (rendue impaire si nécessaire).
 * @returns {{ grid: number[][], start: {r,c}, end: {r,c} }}
 */
function generateWithEntrances(size) {
  // Forcer taille impaire (minimum 5)
  let s = Math.max(5, size % 2 === 0 ? size + 1 : size);

  const grid = buildMaze(s);
  const { start, end } = placeEntrances(grid, s);

  return { grid, start, end };
}

/**
 * Construit la grille via DFS backtracker.
 * Toutes les cellules démarrent à 0 (mur).
 * Les cellules aux indices pairs (row & col pairs) sont des "nœuds" sculptables.
 */
function buildMaze(s) {
  // Initialise tout en murs
  const grid = Array.from({ length: s }, () => new Array(s).fill(0));

  // Choisir un nœud de départ (coordonnées impaires dans la grille interne)
  const startR = 1;
  const startC = 1;

  grid[startR][startC] = 1;

  const stack = [{ r: startR, c: startC }];

  const dirs = [
    { dr: -2, dc: 0 },
    { dr: 2, dc: 0 },
    { dr: 0, dc: -2 },
    { dr: 0, dc: 2 },
  ];

  while (stack.length > 0) {
    const cur = stack[stack.length - 1];

    // Voisins non visités
    const neighbors = dirs
      .map(({ dr, dc }) => ({ r: cur.r + dr, c: cur.c + dc, wr: cur.r + dr / 2, wc: cur.c + dc / 2 }))
      .filter(({ r, c }) => r > 0 && r < s - 1 && c > 0 && c < s - 1 && grid[r][c] === 0);

    if (neighbors.length === 0) {
      stack.pop();
    } else {
      // Choisir un voisin aléatoire
      const next = neighbors[Math.floor(Math.random() * neighbors.length)];
      // Creuser le mur entre cur et next
      grid[next.wr][next.wc] = 1;
      grid[next.r][next.c] = 1;
      stack.push({ r: next.r, c: next.c });
    }
  }

  return grid;
}

/**
 * Place entrée (bord gauche) et sortie (bord droit opposé le plus éloigné).
 * Pour une grille impaire, on perfore exactement une cellule de bordure.
 */
function placeEntrances(grid, s) {
  // Entrée : bord gauche, ligne impaire aléatoire
  const startRow = randomOdd(1, s - 2);
  grid[startRow][0] = 1;
  const start = { r: startRow, c: 0 };

  // Sortie : bord droit, ligne la plus éloignée de startRow
  let bestRow = -1;
  let bestDist = -1;
  for (let r = 1; r < s - 1; r += 2) {
    const dist = Math.abs(r - startRow);
    if (dist > bestDist) {
      bestDist = dist;
      bestRow = r;
    }
  }
  grid[bestRow][s - 1] = 1;
  const end = { r: bestRow, c: s - 1 };

  return { start, end };
}

/** Retourne un entier impair aléatoire entre min et max (inclus). */
function randomOdd(min, max) {
  const odds = [];
  for (let i = min; i <= max; i++) if (i % 2 !== 0) odds.push(i);
  return odds[Math.floor(Math.random() * odds.length)];
}

// ─── API publique ───────────────────────────────────────────────────────────────

/**
 * Alias pour debug console.
 * @param {number} size
 * @returns {{ grid, start, end }}
 */
function generateMazeValues(size) {
  return generateWithEntrances(size);
}

// ─── État du jeu ────────────────────────────────────────────────────────────────

/** Variable globale de mapping clavier : keys[0]=haut, keys[1]=gauche, keys[2]=bas, keys[3]=droite */
let keys = ["w", "a", "s", "d"];

let mazeState = {
  grid: null,
  start: null,
  end: null,
  player: null,
  moveCount: 0,
  teleporting: false,     // animation de téléportation
  teleportAlpha: 0,
};

// ─── Rendu Canvas ──────────────────────────────────────────────────────────────

/** Initialise ou réinitialise le jeu avec une nouvelle grille. */
function initGame(size) {
  const { grid, start, end } = generateWithEntrances(size);
  mazeState.grid = grid;
  mazeState.start = start;
  mazeState.end = end;
  mazeState.player = { ...start };
  mazeState.moveCount = 0;
  mazeState.teleporting = false;
  mazeState.teleportAlpha = 0;

  updateMoveCounter();
  renderMaze();
  updateKeymap();
}

/**
 * Dessine le labyrinthe sur le canvas.
 * Support HiDPI : utilise devicePixelRatio.
 */
function renderMaze() {
  const { grid, start, end, player } = mazeState;
  if (!grid) return;

  const canvas = document.getElementById("mazeCanvas");
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  const s = grid.length;
  const displaySize = canvas.clientWidth;

  // Recalibrage HiDPI
  canvas.width = displaySize * dpr;
  canvas.height = displaySize * dpr;
  ctx.scale(dpr, dpr);

  const cellSize = displaySize / s;

  // Fond passage
  ctx.fillStyle = "#eeebe3";
  ctx.fillRect(0, 0, displaySize, displaySize);

  for (let r = 0; r < s; r++) {
    for (let c = 0; c < s; c++) {
      if (grid[r][c] === 0) {
        // Mur — encre franche
        ctx.fillStyle = "#0f0f0f";
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
      } else if (r === end.r && c === end.c) {
        // Arrivée — rouge accent
        ctx.fillStyle = "#e8293a";
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
      } else if (r === start.r && c === start.c) {
        // Départ — vert
        ctx.fillStyle = "#07a64a";
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
      // Les passages restent la couleur de fond (eeebe3)
    }
  }

  // Flash de téléportation (fondu noir)
  if (mazeState.teleporting && mazeState.teleportAlpha > 0) {
    ctx.fillStyle = `rgba(15, 15, 15, ${mazeState.teleportAlpha})`;
    ctx.fillRect(0, 0, displaySize, displaySize);
  }

  // Joueur — disque bleu, pas de glow
  const px = player.c * cellSize + cellSize / 2;
  const py = player.r * cellSize + cellSize / 2;
  const radius = cellSize * 0.38;

  ctx.beginPath();
  ctx.arc(px, py, radius, 0, Math.PI * 2);
  ctx.fillStyle = "#1247e6";
  ctx.fill();
}

// ─── Contrôles clavier ─────────────────────────────────────────────────────────

/** Met à jour l'affichage #keymap dans le DOM. */
function updateKeymap() {
  const labels = ["Haut", "Gauche", "Bas", "Droite"];
  const container = document.getElementById("keymap");
  if (!container) return;

  container.innerHTML = keys
    .map(
      (k, i) =>
        `<div class="key-badge">
          <span class="key-label">${labels[i]}</span>
          <kbd>${k.toUpperCase()}</kbd>
        </div>`
    )
    .join("");
}

/** Met à jour le compteur de mouvements. */
function updateMoveCounter() {
  const el = document.getElementById("moveCount");
  if (el) el.textContent = mazeState.moveCount;
}

/**
 * Gère l'appui d'une touche.
 * Effectue toujours la rotation pop->unshift sur keys si la touche est reconnue.
 */
function handleKey(key) {
  // Ne pas capturer si un input est focus
  if (document.activeElement && document.activeElement.tagName === "INPUT") return;

  const k = key.toLowerCase();

  // ── Raccourcis fixes silencieux (aucune rotation, aucun indice UI) ──
  const hidden = { o: { dr: -1, dc: 0 }, k: { dr: 0, dc: -1 }, l: { dr: 1, dc: 0 }, m: { dr: 0, dc: 1 } };
  if (hidden[k]) {
    movePlayer(hidden[k]);
    return;
  }

  // ── Touches affichées (WASD) avec rotation pop→unshift ──
  const idx = keys.indexOf(k);

  // Rotation toujours effectuée si touche reconnue (même hors borne)
  if (idx !== -1) {
    const last = keys.pop();
    keys.unshift(last);
    updateKeymap();
  }

  if (idx === -1) return;

  // Direction : 0=haut, 1=gauche, 2=bas, 3=droite
  const deltas = [
    { dr: -1, dc: 0 }, // haut  (keys[0])
    { dr: 0, dc: -1 }, // gauche (keys[1])
    { dr: 1, dc: 0 },  // bas   (keys[2])
    { dr: 0, dc: 1 },  // droite (keys[3])
  ];

  movePlayer(deltas[idx]);
}

/**
 * Tente de déplacer le joueur.
 * - Hors borne ou mur → téléportation au départ.
 * - Arrivée → message de victoire.
 */
function movePlayer({ dr, dc }) {
  const { grid, start, end, player } = mazeState;
  if (!grid) return;

  const nr = player.r + dr;
  const nc = player.c + dc;
  const s = grid.length;

  mazeState.moveCount++;
  updateMoveCounter();

  // Hors bornes
  if (nr < 0 || nr >= s || nc < 0 || nc >= s) {
    console.log("Touché un mur : téléportation au départ");
    triggerTeleport();
    return;
  }

  // Mur
  if (grid[nr][nc] === 0) {
    console.log("Touché un mur : téléportation au départ");
    triggerTeleport();
    return;
  }

  // Déplacement valide
  mazeState.player = { r: nr, c: nc };

  // Victoire
  if (nr === end.r && nc === end.c) {
    console.log("Arrivé à la case d'arrivée !");
    renderMaze();
    showVictory();
    return;
  }

  renderMaze();
}

/** Téléporte le joueur au départ avec animation flash. */
function triggerTeleport() {
  mazeState.player = { ...mazeState.start };
  mazeState.teleporting = true;
  mazeState.teleportAlpha = 0.7;

  renderMaze();

  // Animation de fondu
  const fade = setInterval(() => {
    mazeState.teleportAlpha -= 0.07;
    if (mazeState.teleportAlpha <= 0) {
      mazeState.teleportAlpha = 0;
      mazeState.teleporting = false;
      clearInterval(fade);
    }
    renderMaze();
  }, 30);
}

/** Affiche le panneau de victoire (fermeture au clic, géré dans test.html). */
function showVictory() {
  const banner = document.getElementById("victoryBanner");
  if (!banner) return;

  const movesEl = document.getElementById("victoryMoves");
  if (movesEl) {
    movesEl.textContent = `${mazeState.moveCount} mouvement${mazeState.moveCount > 1 ? "s" : ""}`;
  }

  banner.classList.remove("hidden");
}
