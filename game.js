// Ink & Ember game
// ─── CANVAS SETUP ───
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Tile & grid settings
const TILE = 40;
const COLS = 16;
const ROWS = 12;

canvas.width  = COLS * TILE;
canvas.height = ROWS * TILE;

// ─── COLOR PALETTE ───
const COLORS = {
  background:  '#0E0B08',
  grassDark:   '#1C2A10',
  grassLight:  '#223314',
  pathDark:    '#3D3530',
  pathLight:   '#4A4038',
  amber:       '#C87941',
  crimson:     '#8B1A1A',
  gold:        '#D4A847',
  ash:         '#E8DDD0',
};

// ─── MAP DEFINITION ───
// 0 = grass, 1 = path
const MAP = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

// ─── PATH ARRAY (ordered route) ───
const PATH = [
  {col:0,row:2},{col:1,row:2},{col:2,row:2},{col:3,row:2},{col:4,row:2},{col:5,row:2},
  {col:5,row:3},
  {col:5,row:4},{col:6,row:4},{col:7,row:4},{col:8,row:4},{col:9,row:4},{col:10,row:4},
  {col:10,row:5},
  {col:10,row:6},{col:11,row:6},{col:12,row:6},{col:13,row:6},
  {col:13,row:7},
  {col:13,row:8},
  {col:13,row:9},{col:14,row:9},{col:15,row:9},
];

// ─── PATH TILE SET ───
const PATH_TILES = new Set();
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    if (MAP[row][col] === 1) PATH_TILES.add(`${col},${row}`);
  }
}

// ─── TOWER DATA ───
const TOWERS = [];

const TOWER_TYPES = {
  archer: {
    color:    '#C87941',
    range:    3,
    fireRate: 60,
    damage:   15,
    cost:     50,
  },
};

let selectedType  = 'archer';
let placingTower  = true;
let selectedTower = null;

// ─── ENEMY DATA ───
const ENEMIES   = [];
let waveNum     = 0;
let lives       = 20;
let gold        = 150;
let score       = 0;
let spawning    = false;
let spawnQueue  = [];

// ─── SPAWN WAVE ───
function spawnWave() {
  waveNum++;
  const count    = 5 + waveNum * 3;
  const enemyHp  = 40 + waveNum * 20;
  spawning       = true;
  spawnQueue     = [];
  for (let i = 0; i < count; i++) {
    spawnQueue.push({ hp: enemyHp, delay: i * 45 });
  }
}

function updateSpawnQueue() {
  if (spawnQueue.length === 0) return;
  spawnQueue[0].delay--;
  if (spawnQueue[0].delay <= 0) {
    const template = spawnQueue.shift();
    const start    = PATH[0];
    ENEMIES.push({
      x:       start.col * TILE + TILE / 2,
      y:       start.row * TILE + TILE / 2,
      pathIdx: 0,
      hp:      template.hp,
      maxHp:   template.hp,
      speed:   1.5 + waveNum * 0.05,
      done:    false,
    });
    if (spawnQueue.length === 0) spawning = false;
  }
}

// ─── ENEMY MOVEMENT ───
function updateEnemies() {
  for (const enemy of ENEMIES) {
    if (enemy.done) continue;

    const next = PATH[enemy.pathIdx + 1];
    if (!next) {
      lives = Math.max(0, lives - 1);
      enemy.done = true;
      continue;
    }

    const tx  = next.col * TILE + TILE / 2;
    const ty  = next.row * TILE + TILE / 2;
    const dx  = tx - enemy.x;
    const dy  = ty - enemy.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= enemy.speed) {
      enemy.x = tx;
      enemy.y = ty;
      enemy.pathIdx++;
    } else {
      enemy.x += (dx / dist) * enemy.speed;
      enemy.y += (dy / dist) * enemy.speed;
    }
  }

  // Remove finished enemies
  for (let i = ENEMIES.length - 1; i >= 0; i--) {
    if (ENEMIES[i].done) ENEMIES.splice(i, 1);
  }
}

// ─── PLACEMENT HANDLER ───
function handleTileClick(pixelX, pixelY) {
  const col = Math.floor(pixelX / TILE);
  const row = Math.floor(pixelY / TILE);

  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

  // Clicked an existing tower — select it
  const existing = TOWERS.find(t => t.col === col && t.row === row);
  if (existing) {
    selectedTower = existing;
    return;
  }

  // Ignore path tiles
  if (PATH_TILES.has(`${col},${row}`)) return;

  if (!placingTower) {
    selectedTower = null;
    return;
  }

  // Place new tower
  const type = TOWER_TYPES[selectedType];
  TOWERS.push({
    col,
    row,
    cx:        col * TILE + TILE / 2,
    cy:        row * TILE + TILE / 2,
    type:      selectedType,
    color:     type.color,
    range:     type.range,
    fireRate:  type.fireRate,
    damage:    type.damage,
    cost:      type.cost,
    cardSlots: [],
    angle:     0,
    timer:     0,
  });
  selectedTower = TOWERS[TOWERS.length - 1];
}

canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  handleTileClick(e.clientX - rect.left, e.clientY - rect.top);
});

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  const rect  = canvas.getBoundingClientRect();
  const touch = e.changedTouches[0];
  handleTileClick(touch.clientX - rect.left, touch.clientY - rect.top);
});

document.getElementById('sendWaveBtn').addEventListener('click', spawnWave);

// ─── DRAW MAP ───
function drawMap() {
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const isPath = MAP[row][col] === 1;
      const isEven = (row + col) % 2 === 0;

      if (isPath) {
        ctx.fillStyle = isEven ? COLORS.pathDark : COLORS.pathLight;
      } else {
        ctx.fillStyle = isEven ? COLORS.grassDark : COLORS.grassLight;
      }

      ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
    }
  }
}

// ─── DRAW TOWERS ───
function drawTowers() {
  for (const tower of TOWERS) {
    const x = tower.col * TILE;
    const y = tower.row * TILE;
    const inset = 4;

    // Tower body
    ctx.fillStyle = tower.color;
    ctx.fillRect(x + inset, y + inset, TILE - inset * 2, TILE - inset * 2);

    // Cannon barrel
    ctx.save();
    ctx.translate(tower.cx, tower.cy);
    ctx.rotate(tower.angle);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, -3, TILE / 2 - 2, 6);
    ctx.restore();

    // Selected highlight
    if (tower === selectedTower) {
      ctx.strokeStyle = COLORS.amber;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);

      ctx.beginPath();
      ctx.arc(tower.cx, tower.cy, tower.range * TILE, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(200, 121, 65, 0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(200, 121, 65, 0.05)';
      ctx.fill();
    }
  }
}

// ─── DRAW ENEMIES ───
function drawEnemies() {
  for (const enemy of ENEMIES) {
    // Outer body
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#8B1A1A';
    ctx.fill();

    // Inner detail
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#B03030';
    ctx.fill();

    // Health bar background
    const barW = 20;
    const barH = 3;
    const bx   = enemy.x - barW / 2;
    const by   = enemy.y - 16;
    ctx.fillStyle = '#333';
    ctx.fillRect(bx, by, barW, barH);

    // Health bar fill
    ctx.fillStyle = COLORS.crimson;
    ctx.fillRect(bx, by, barW * (enemy.hp / enemy.maxHp), barH);
  }
}

// ─── DRAW HUD ───
function drawHUD() {
  const lines  = [
    `Wave:  ${waveNum}`,
    `Lives: ${lives}`,
    `Gold:  ${gold}`,
    `Score: ${score}`,
  ];
  const pad    = 8;
  const lineH  = 18;
  const panelW = 110;
  const panelH = pad * 2 + lineH * lines.length;

  ctx.fillStyle = 'rgba(14, 11, 8, 0.75)';
  ctx.fillRect(6, 6, panelW, panelH);

  ctx.fillStyle = COLORS.ash;
  ctx.font      = '13px monospace';
  lines.forEach((line, i) => {
    ctx.fillText(line, 6 + pad, 6 + pad + lineH * i + 12);
  });
}

// ─── MAIN DRAW ───
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMap();
  drawTowers();
  drawEnemies();
  drawHUD();
}

// ─── GAME LOOP ───
function gameLoop() {
  updateSpawnQueue();
  updateEnemies();
  draw();
  requestAnimationFrame(gameLoop);
}

gameLoop();
