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
  cannon: {
    color:    '#8B4513',
    range:    2.5,
    fireRate: 90,
    damage:   60,
    cost:     75,
    splash:   true,
  },
  frost: {
    color:    '#4A90D9',
    range:    3,
    fireRate: 70,
    damage:   8,
    cost:     60,
    frostSlow: true,
  },
  mage: {
    color:    '#7B2D8B',
    range:    3.5,
    fireRate: 50,
    damage:   25,
    cost:     90,
    mageDmg:  true,
  },
};

let selectedType       = 'archer';
let placingTower       = true;
let selectedTower      = null;
let notEnoughGoldTimer = 0;

// ─── ENEMY DATA ───
const ENEMIES  = [];
let waveNum    = 0;
let lives      = 20;
let gold       = 150;
let score      = 0;
let spawning          = false;
let spawnQueue        = [];
let waveRewardGiven   = false;
let gameOver          = false;

// ─── BOSS STATE ───
let bossAnnounceTimer  = 0;   // counts down 180 frames (3s) before spawning
let bossAnnounceData   = null; // { name, resistance, waveNum }
let bossDefeatedTimer  = 0;   // counts down 120 frames (2s) after boss death
let pendingBossReward  = false;

// ─── COMBAT DATA ───
const BULLETS        = [];
const PARTICLES      = [];
const CHAIN_LINES    = [];
const SPLASH_EFFECTS    = []; // { x, y, life, maxLife }
const FROST_BURSTS      = []; // { x, y, life }
const MAGE_TRAILS       = []; // { x, y, life, color }
const DEBUG_SPLASH_RINGS = []; // DEBUG - remove before release  { x, y, life }
const DEBUG_HIT_FLASHES  = []; // DEBUG - remove before release  { enemy, life }

// ─── CARD SYSTEM ───
const CARD_POOL = [
  {
    id: 'dmg_boost', name: 'Sharp Edges', rarity: 'common',
    description: 'Damage +15%',
    effect: t => { t.damage *= t.mageDmg ? 1.15 * 1.2 : 1.15; },
  },
  {
    id: 'range_boost', name: 'Eagle Eye', rarity: 'common',
    description: 'Range +20%',
    effect: t => { t.range *= 1.2; },
  },
  {
    id: 'speed_boost', name: 'Quick Hands', rarity: 'common',
    description: 'Fire Rate +20%',
    effect: t => { t.fireRate *= 0.8; },
  },
  {
    id: 'poison', name: 'Poison Tip', rarity: 'rare',
    description: 'Enemies hit are poisoned for 3s',
    effect: t => { t.poison = true; },
  },
  {
    id: 'slow', name: 'Tar Arrows', rarity: 'rare',
    description: 'Enemies hit are slowed by 40%',
    effect: t => { t.slow = true; },
  },
  {
    id: 'chain', name: 'Chain Shot', rarity: 'rare',
    description: 'Bullets bounce to a nearby enemy',
    effect: t => { t.chain = true; },
  },
  {
    id: 'warlord', name: 'Warlord', rarity: 'legendary',
    description: 'Buffs adjacent towers damage +25%',
    effect: t => {
      t.warlord = true;
      for (const other of TOWERS) {
        if (other === t) continue;
        if (Math.abs(other.col - t.col) <= 2 && Math.abs(other.row - t.row) <= 2) {
          other.damage *= 1.25;
        }
      }
    },
  },
];

const RARITY_BORDER = {
  common:    COLORS.ash,
  rare:      COLORS.amber,
  legendary: COLORS.gold,
};

function canReceiveCard(tower) {
  return tower.cardSlots.length < 3;
}

function applyCard(card, tower) {
  card.effect(tower);
  tower.cardSlots.push(card.id);
  checkSynergies(tower);
}

function checkSynergies(tower) {
  const slots = tower.cardSlots;
  const has   = id => slots.includes(id);

  if (has('poison') && has('chain') && !tower.plagueChain) {
    tower.plagueChain = true;
    showSynergy('Plague Chain unlocked!');
  }
  if (has('poison') && has('slow') && !tower.venomBog) {
    tower.venomBog = true;
    showSynergy('Venom Bog unlocked!');
  }
  if (has('slow') && has('chain') && !tower.stormVolley) {
    tower.stormVolley = true;
    showSynergy('Storm Volley unlocked!');
  }
}

// ─── SYNERGY NOTIFICATION ───
let synergyMessage = '';
let synergyTimer   = 0;

function showSynergy(msg) {
  synergyMessage = msg;
  synergyTimer   = 180;
}

// ─── CARD OFFER ───
let cardOfferActive  = false;
let offeredCards     = [];
let pendingCardTower = null;
let selectedCard     = null;
let cardFullTimer    = 0;

// Card panel layout (computed in drawCardOffer, stored for hit-testing)
const CARD_PANELS = [];

function drawCard(card, x, y, w, h, highlighted) {
  // Background
  ctx.fillStyle = highlighted ? 'rgba(40,30,20,0.97)' : 'rgba(20,15,10,0.95)';
  ctx.fillRect(x, y, w, h);

  // Border
  ctx.strokeStyle = RARITY_BORDER[card.rarity];
  ctx.lineWidth   = highlighted ? 3 : 1.5;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);

  // Name
  ctx.fillStyle  = COLORS.ash;
  ctx.font       = 'bold 13px monospace';
  ctx.textAlign  = 'center';
  ctx.fillText(card.name, x + w / 2, y + 28);

  // Rarity
  ctx.fillStyle = RARITY_BORDER[card.rarity];
  ctx.font      = '10px monospace';
  ctx.fillText(card.rarity.toUpperCase(), x + w / 2, y + 46);

  // Description (word-wrap at ~18 chars)
  ctx.fillStyle = COLORS.ash;
  ctx.font      = '11px monospace';
  const words   = card.description.split(' ');
  let   line    = '';
  let   lineY   = y + 68;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (test.length > 18 && line) {
      ctx.fillText(line, x + w / 2, lineY);
      line  = word;
      lineY += 16;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x + w / 2, lineY);

  ctx.textAlign = 'left';
}

function offerCards() {
  offeredCards = [];
  for (let i = 0; i < 3; i++) {
    const roll = Math.random();
    let pool;
    if (roll < 0.6)       pool = CARD_POOL.filter(c => c.rarity === 'common');
    else if (roll < 0.9)  pool = CARD_POOL.filter(c => c.rarity === 'rare');
    else                  pool = CARD_POOL.filter(c => c.rarity === 'legendary');
    offeredCards.push(pool[Math.floor(Math.random() * pool.length)]);
  }
  cardOfferActive = true;
  selectedCard    = null;
  document.getElementById('rerollBtn').style.display = 'block';
}

function closeCardOffer() {
  cardOfferActive  = false;
  selectedCard     = null;
  pendingCardTower = null;
  document.getElementById('rerollBtn').style.display = 'none';
}

function drawCardOffer() {
  if (cardOfferActive) {
    // State 1: choosing a card — full overlay + panels
    ctx.fillStyle = 'rgba(14, 11, 8, 0.80)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cardW  = 120;
    const cardH  = 160;
    const gap    = 20;
    const totalW = cardW * 3 + gap * 2;
    const startX = (canvas.width - totalW) / 2;
    const startY = (canvas.height - cardH) / 2 - 20;

    ctx.fillStyle = COLORS.ash;
    ctx.font      = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Choose a Card', canvas.width / 2, startY - 16);
    ctx.textAlign = 'left';

    CARD_PANELS.length = 0;
    offeredCards.forEach((card, i) => {
      const cx = startX + i * (cardW + gap);
      CARD_PANELS.push({ x: cx, y: startY, w: cardW, h: cardH, card });
      drawCard(card, cx, startY, cardW, cardH, false);
    });

  } else if (selectedCard !== null) {
    // State 2: card chosen, awaiting tower tap — floating banner only
    const bannerText = cardFullTimer > 0
      ? `${selectedCard.name} — tower is full, tap another`
      : `${selectedCard.name} — tap a tower to apply`;

    const bannerW = canvas.width - 40;
    const bannerH = 36;
    const bannerX = 20;
    const bannerY = 10;

    ctx.fillStyle = 'rgba(14, 11, 8, 0.88)';
    ctx.fillRect(bannerX, bannerY, bannerW, bannerH);
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(bannerX + 1, bannerY + 1, bannerW - 2, bannerH - 2);

    ctx.fillStyle = COLORS.amber;
    ctx.font      = '13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(bannerText, canvas.width / 2, bannerY + 23);
    ctx.textAlign = 'left';
  }
}

// ─── SPAWN WAVE ───
function makeBossTemplate() {
  const resistances = ['slow', 'poison', 'chain'];
  const resistance  = resistances[Math.floor(Math.random() * resistances.length)];
  const names       = { slow: 'Stone Golem', poison: 'Plague Rat', chain: 'Phantom' };
  return {
    isBoss:     true,
    hp:         400 + waveNum * 80,
    speed:      0.8 + waveNum * 0.03,
    resistance,
    name:       names[resistance],
    reward:     80,
    size:       20,
  };
}

function spawnBossWave() {
  const boss = makeBossTemplate();
  bossAnnounceData  = { name: boss.name, resistance: boss.resistance, waveNum };
  bossAnnounceTimer = 180;

  const escortHp = 40 + waveNum * 20;
  spawnQueue = [
    { ...boss, delay: 0 },
    ...Array.from({ length: 5 }, (_, i) => ({ hp: escortHp, delay: (i + 1) * 60 })),
  ];
}

function spawnWave() {
  if (cardOfferActive || selectedCard !== null) return;
  waveRewardGiven = false;
  waveNum++;
  spawning   = true;
  spawnQueue = [];

  if (waveNum % 5 === 0) {
    spawnBossWave();
  } else {
    const count   = 5 + waveNum * 3;
    const enemyHp = 40 + waveNum * 20;
    for (let i = 0; i < count; i++) {
      spawnQueue.push({ hp: enemyHp, delay: i * 45 });
    }
  }
}

function updateSpawnQueue() {
  // Hold spawn queue while boss announcement is showing
  if (bossAnnounceTimer > 0) { bossAnnounceTimer--; return; }

  if (spawnQueue.length === 0) return;
  spawnQueue[0].delay--;
  if (spawnQueue[0].delay <= 0) {
    const template = spawnQueue.shift();
    const start    = PATH[0];
    if (template.isBoss) {
      ENEMIES.push({
        x:          start.col * TILE + TILE / 2,
        y:          start.row * TILE + TILE / 2,
        pathIdx:    0,
        hp:         template.hp,
        maxHp:      template.hp,
        speed:      template.speed,
        isBoss:     true,
        size:       template.size,
        name:       template.name,
        resistance: template.resistance,
        reward:     template.reward,
        done:       false,
      });
    } else {
      ENEMIES.push({
        x:       start.col * TILE + TILE / 2,
        y:       start.row * TILE + TILE / 2,
        pathIdx: 0,
        hp:      template.hp,
        maxHp:   template.hp,
        speed:   1.5 + waveNum * 0.05,
        done:    false,
      });
    }
    if (spawnQueue.length === 0) spawning = false;
  }
}

// ─── ENEMY MOVEMENT ───
function killEnemy(enemy) {
  enemy.hp   = 0;
  enemy.done = true;
  if (enemy.isBoss) {
    gold  += enemy.reward;
    score += 100;
    spawnParticles(enemy.x, enemy.y, 20);
    bossDefeatedTimer = 120;
    pendingBossReward = true;
  } else {
    gold  += 15;
    score += 10;
    spawnParticles(enemy.x, enemy.y, 8);
  }
}

function updateEnemies() {
  for (const enemy of ENEMIES) {
    if (enemy.done) continue;

    // ── Poison tick ──
    if (enemy.poisoned && enemy.poisonDuration > 0) {
      enemy.poisonDuration--;
      if (enemy.poisonDuration % 20 === 0) {
        enemy.hp -= enemy.poisonDamage;
        if (enemy.hp <= 0) { killEnemy(enemy); continue; }
      }
      if (enemy.poisonDuration <= 0) enemy.poisoned = false;
    }

    // ── Slow tick ──
    if (enemy.slowed && enemy.slowTimer > 0) {
      enemy.slowTimer--;
      if (enemy.slowTimer <= 0) enemy.slowed = false;
    }

    const next = PATH[enemy.pathIdx + 1];
    if (!next) {
      lives = Math.max(0, lives - 1);
      enemy.done = true;
      continue;
    }

    const effectiveSpeed = enemy.slowed ? enemy.speed * 0.6 : enemy.speed;
    const tx   = next.col * TILE + TILE / 2;
    const ty   = next.row * TILE + TILE / 2;
    const dx   = tx - enemy.x;
    const dy   = ty - enemy.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= effectiveSpeed) {
      enemy.x = tx;
      enemy.y = ty;
      enemy.pathIdx++;
    } else {
      enemy.x += (dx / dist) * effectiveSpeed;
      enemy.y += (dy / dist) * effectiveSpeed;
    }
  }

  for (let i = ENEMIES.length - 1; i >= 0; i--) {
    if (ENEMIES[i].done) ENEMIES.splice(i, 1);
  }
}

// ─── TOWER SHOOTING ───
function updateTowers() {
  for (const tower of TOWERS) {
    tower.timer--;

    const rangePx = tower.range * TILE;
    const inRange = ENEMIES.filter(e =>
      !e.done && Math.hypot(e.x - tower.cx, e.y - tower.cy) <= rangePx
    );

    if (inRange.length === 0) continue;

    const target = inRange.reduce((best, e) =>
      e.pathIdx > best.pathIdx ? e : best
    );

    tower.angle = Math.atan2(target.y - tower.cy, target.x - tower.cx);

    if (tower.timer <= 0) {
      BULLETS.push({
        x:           tower.cx,
        y:           tower.cy,
        tx:          target,
        speed:       7,
        dmg:         tower.damage,
        color:       tower.color,
        poison:      tower.poison      || false,
        slow:        tower.slow        || false,
        bounces:     tower.stormVolley ? 2 : (tower.chain ? 1 : 0),
        plagueChain: tower.plagueChain || false,
        splash:      tower.splash      || false,
        frostSlow:   tower.frostSlow   || false,
        isMage:      tower.mageDmg     || false,
        hitSet:      new Set(),
        done:        false,
      });
      tower.timer = tower.fireRate;
    }
  }
}

// ─── BULLET MOVEMENT ───
function updateBullets() {
  for (const bullet of BULLETS) {
    if (bullet.done) continue;

    if (bullet.tx.done) {
      bullet.done = true;
      continue;
    }

    const dx   = bullet.tx.x - bullet.x;
    const dy   = bullet.tx.y - bullet.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= bullet.speed) {
      hitEnemy(bullet, bullet.tx);
      bullet.done = true;
    } else {
      bullet.x += (dx / dist) * bullet.speed;
      bullet.y += (dy / dist) * bullet.speed;
      if (bullet.isMage) {
        MAGE_TRAILS.push({ x: bullet.x, y: bullet.y, life: 8, color: bullet.color });
      }
    }
  }

  for (let i = BULLETS.length - 1; i >= 0; i--) {
    if (BULLETS[i].done) BULLETS.splice(i, 1);
  }
}

function applyStatusEffects(bullet, enemy) {
  if (bullet.poison && enemy.resistance !== 'poison') {
    enemy.poisoned       = true;
    enemy.poisonDamage   = 3;
    enemy.poisonDuration = 180;
  }
  if ((bullet.slow || bullet.frostSlow) && enemy.resistance !== 'slow') {
    const base  = bullet.frostSlow ? 180 : 120;
    const bonus = (enemy.poisoned && enemy.slowed) ? 1.5 : 1;
    enemy.slowed    = true;
    enemy.slowTimer = Math.round(base * bonus);
  }
}

function hitEnemy(bullet, enemy) {
  if (enemy.done) return;

  bullet.hitSet.add(enemy);
  enemy.hp -= bullet.dmg;
  applyStatusEffects(bullet, enemy);

  if (enemy.hp <= 0) killEnemy(enemy);

  // Cannon splash
  if (bullet.splash) {
    SPLASH_EFFECTS.push({ x: enemy.x, y: enemy.y, life: 15, maxLife: 15 });
    DEBUG_SPLASH_RINGS.push({ x: enemy.x, y: enemy.y, life: 30 }); // DEBUG - remove before release
    for (const e of ENEMIES) {
      if (e === enemy || e.done) continue;
      if (Math.hypot(e.x - enemy.x, e.y - enemy.y) <= 50) {
        e.hp -= bullet.dmg * 0.4;
        DEBUG_HIT_FLASHES.push({ enemy: e, life: 12 }); // DEBUG - remove before release
        if (e.hp <= 0) killEnemy(e);
      }
    }
  }

  // Frost burst
  if (bullet.frostSlow) {
    FROST_BURSTS.push({ x: enemy.x, y: enemy.y, life: 12 });
  }

  // Chain / Storm Volley bounce (blocked by chain resistance)
  if (bullet.bounces > 0 && enemy.resistance !== 'chain') {
    const others = ENEMIES.filter(e =>
      !e.done && !bullet.hitSet.has(e) &&
      Math.hypot(e.x - enemy.x, e.y - enemy.y) <= 150
    );
    if (others.length > 0) {
      const nearest = others.reduce((best, e) =>
        Math.hypot(e.x - enemy.x, e.y - enemy.y) <
        Math.hypot(best.x - enemy.x, best.y - enemy.y) ? e : best
      );
      CHAIN_LINES.push({ x1: enemy.x, y1: enemy.y, x2: nearest.x, y2: nearest.y, life: 10 });
      BULLETS.push({
        x:           enemy.x,
        y:           enemy.y,
        tx:          nearest,
        speed:       bullet.speed,
        dmg:         bullet.dmg * 0.6,
        color:       bullet.color,
        poison:      bullet.plagueChain ? true : bullet.poison,
        slow:        bullet.slow,
        bounces:     bullet.bounces - 1,
        plagueChain: bullet.plagueChain,
        hitSet:      bullet.hitSet,
        done:        false,
      });
    }
  }
}

// ─── PARTICLES ───
function spawnParticles(x, y, count = 8) {
  for (let i = 0; i < count; i++) {
    PARTICLES.push({
      x,
      y,
      vx:    (Math.random() * 6) - 3,
      vy:    (Math.random() * 6) - 3,
      life:  20 + Math.random() * 15,
      color: '#D4A847',
    });
  }
}

function updateParticles() {
  for (const p of PARTICLES) {
    p.x    += p.vx;
    p.y    += p.vy;
    p.vx   *= 0.9;
    p.vy   *= 0.9;
    p.life -= 1;
  }
  for (let i = PARTICLES.length - 1; i >= 0; i--) {
    if (PARTICLES[i].life <= 0) PARTICLES.splice(i, 1);
  }
  for (const cl of CHAIN_LINES) cl.life--;
  for (let i = CHAIN_LINES.length - 1; i >= 0; i--) {
    if (CHAIN_LINES[i].life <= 0) CHAIN_LINES.splice(i, 1);
  }
  for (const s of SPLASH_EFFECTS) s.life--;
  for (let i = SPLASH_EFFECTS.length - 1; i >= 0; i--) {
    if (SPLASH_EFFECTS[i].life <= 0) SPLASH_EFFECTS.splice(i, 1);
  }
  for (const f of FROST_BURSTS) f.life--;
  for (let i = FROST_BURSTS.length - 1; i >= 0; i--) {
    if (FROST_BURSTS[i].life <= 0) FROST_BURSTS.splice(i, 1);
  }
  for (const m of MAGE_TRAILS) m.life--;
  for (let i = MAGE_TRAILS.length - 1; i >= 0; i--) {
    if (MAGE_TRAILS[i].life <= 0) MAGE_TRAILS.splice(i, 1);
  }
  // DEBUG - remove before release
  for (const r of DEBUG_SPLASH_RINGS) r.life--;
  for (let i = DEBUG_SPLASH_RINGS.length - 1; i >= 0; i--) {
    if (DEBUG_SPLASH_RINGS[i].life <= 0) DEBUG_SPLASH_RINGS.splice(i, 1);
  }
  for (const f of DEBUG_HIT_FLASHES) f.life--;
  for (let i = DEBUG_HIT_FLASHES.length - 1; i >= 0; i--) {
    if (DEBUG_HIT_FLASHES[i].life <= 0) DEBUG_HIT_FLASHES.splice(i, 1);
  }
}

// ─── PLACEMENT HANDLER ───
function handleTileClick(pixelX, pixelY) {
  // State 1: card offer overlay — check panel clicks
  if (cardOfferActive) {
    for (const panel of CARD_PANELS) {
      if (
        pixelX >= panel.x && pixelX <= panel.x + panel.w &&
        pixelY >= panel.y && pixelY <= panel.y + panel.h
      ) {
        selectedCard    = panel.card;
        cardOfferActive = false;
        document.getElementById('rerollBtn').style.display = 'none';
        return;
      }
    }
    return;
  }

  // State 2: card selected, awaiting tower tap
  if (selectedCard !== null) {
    const col   = Math.floor(pixelX / TILE);
    const row   = Math.floor(pixelY / TILE);
    const tower = TOWERS.find(t => t.col === col && t.row === row);
    if (tower) {
      if (!canReceiveCard(tower)) {
        cardFullTimer = 120;
        return;
      }
      applyCard(selectedCard, tower);
      closeCardOffer();
    }
    return;
  }

  const col = Math.floor(pixelX / TILE);
  const row = Math.floor(pixelY / TILE);

  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

  const existing = TOWERS.find(t => t.col === col && t.row === row);
  if (existing) {
    selectedTower = existing;
    return;
  }

  if (PATH_TILES.has(`${col},${row}`)) return;

  if (!placingTower) {
    selectedTower = null;
    return;
  }

  const type = TOWER_TYPES[selectedType];
  if (gold < type.cost) {
    notEnoughGoldTimer = 120;
    return;
  }

  gold -= type.cost;
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
    splash:    type.splash    || false,
    frostSlow: type.frostSlow || false,
    mageDmg:   type.mageDmg   || false,
    cardSlots: [],
    angle:     0,
    timer:     0,
  });
  selectedTower = TOWERS[TOWERS.length - 1];
}

function handleCanvasInput(pixelX, pixelY) {
  if (gameOver) {
    if (
      GAME_OVER_BTN.x !== undefined &&
      pixelX >= GAME_OVER_BTN.x && pixelX <= GAME_OVER_BTN.x + GAME_OVER_BTN.w &&
      pixelY >= GAME_OVER_BTN.y && pixelY <= GAME_OVER_BTN.y + GAME_OVER_BTN.h
    ) {
      restartGame();
    }
    return;
  }
  handleTileClick(pixelX, pixelY);
}

canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  handleCanvasInput(e.clientX - rect.left, e.clientY - rect.top);
});

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  const rect  = canvas.getBoundingClientRect();
  const touch = e.changedTouches[0];
  handleCanvasInput(touch.clientX - rect.left, touch.clientY - rect.top);
});

document.getElementById('sendWaveBtn').addEventListener('click', spawnWave);

// DEBUG - remove before release
function testCannon() {
  const start = PATH[0];
  for (let i = 0; i < 20; i++) {
    ENEMIES.push({
      x:       start.col * TILE + TILE / 2,
      y:       start.row * TILE + TILE / 2,
      pathIdx: 0,
      hp:      100,
      maxHp:   100,
      speed:   1.5,
      done:    false,
    });
  }
}
document.getElementById('testCannonBtn').addEventListener('click', testCannon); // DEBUG - remove before release

['archer','cannon','frost','mage'].forEach(type => {
  document.getElementById(`btn_${type}`).addEventListener('click', () => {
    selectedType = type;
    updateTowerBtnStyles();
  });
});

function updateTowerBtnStyles() {
  ['archer','cannon','frost','mage'].forEach(type => {
    const btn = document.getElementById(`btn_${type}`);
    btn.style.borderColor = type === selectedType
      ? TOWER_TYPES[type].color
      : '#444';
    btn.style.opacity = type === selectedType ? '1' : '0.65';
  });
}

document.getElementById('rerollBtn').addEventListener('click', () => {
  if (gold >= 30) {
    gold -= 30;
    offerCards();
  }
});

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
function drawTowerShape(tower) {
  const x  = tower.col * TILE;
  const y  = tower.row * TILE;
  const cx = tower.cx;
  const cy = tower.cy;

  ctx.fillStyle = tower.color;

  if (tower.type === 'archer') {
    // Square base, thin long barrel
    ctx.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tower.angle);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(2, -2, TILE / 2, 4);
    ctx.restore();

  } else if (tower.type === 'cannon') {
    // Wider base, short thick barrel
    ctx.fillRect(x + 4, y + 4, TILE - 8, TILE - 8);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tower.angle);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(2, -5, TILE / 2 - 6, 10);
    ctx.restore();

  } else if (tower.type === 'frost') {
    // Square base + diamond on top
    ctx.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
    ctx.save();
    ctx.translate(cx, cy - 2);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#A8D4F0';
    ctx.fillRect(-5, -5, 10, 10);
    ctx.restore();
    // thin barrel
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tower.angle);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(2, -2, TILE / 2 - 4, 4);
    ctx.restore();

  } else if (tower.type === 'mage') {
    // Square base + circle on top
    ctx.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
    ctx.beginPath();
    ctx.arc(cx, cy - 2, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#C060D8';
    ctx.fill();
    // thin barrel
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tower.angle);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(2, -2, TILE / 2 - 4, 4);
    ctx.restore();
  }
}

function drawTowers() {
  for (const tower of TOWERS) {
    const x = tower.col * TILE;
    const y = tower.row * TILE;

    drawTowerShape(tower);

    if (tower === selectedTower) {
      ctx.strokeStyle = COLORS.amber;
      ctx.lineWidth   = 2;
      ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);

      ctx.beginPath();
      ctx.arc(tower.cx, tower.cy, tower.range * TILE, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(200, 121, 65, 0.25)';
      ctx.lineWidth   = 1;
      ctx.stroke();
      ctx.fillStyle = 'rgba(200, 121, 65, 0.05)';
      ctx.fill();
    }

    // Card slot dots
    if (tower.cardSlots.length > 0) {
      const dotR   = 4;
      const dotY   = y + TILE - 7;
      const totalW = tower.cardSlots.length * (dotR * 2 + 2) - 2;
      let   dotX   = tower.cx - totalW / 2 + dotR;
      for (const cardId of tower.cardSlots) {
        const card = CARD_POOL.find(c => c.id === cardId);
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
        ctx.fillStyle = card ? RARITY_BORDER[card.rarity] : COLORS.ash;
        ctx.fill();
        dotX += dotR * 2 + 2;
      }
    }
  }
}

// ─── DRAW ENEMIES ───
const RESISTANCE_DOT_COLOR = { slow: '#2D4F9E', poison: '#2D7A2D', chain: '#C87941' };

function drawEnemies() {
  for (const enemy of ENEMIES) {
    const r = enemy.isBoss ? 20 : 10;

    if (enemy.isBoss) {
      // Boss body
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#8B1A1A';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, r - 5, 0, Math.PI * 2);
      ctx.fillStyle = '#C03030';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = '#111';
      ctx.lineWidth   = 3;
      ctx.stroke();
    } else {
      // Normal body
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#8B1A1A';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#B03030';
      ctx.fill();
    }

    // Status tints
    if (enemy.poisoned) {
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#2D7A2D';
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (enemy.slowed) {
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#2D4F9E';
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Health bar
    const barW = enemy.isBoss ? 44 : 20;
    const barH = enemy.isBoss ? 5  : 3;
    const bx   = enemy.x - barW / 2;
    const by   = enemy.y - r - 10;
    ctx.fillStyle = '#333';
    ctx.fillRect(bx, by, barW, barH);
    ctx.fillStyle = COLORS.crimson;
    ctx.fillRect(bx, by, barW * (enemy.hp / enemy.maxHp), barH);

    // Boss name + resistance shield dot
    if (enemy.isBoss) {
      ctx.fillStyle = COLORS.ash;
      ctx.font      = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(enemy.name, enemy.x, by - 4);
      ctx.textAlign = 'left';

      // Resistance dot to the right of bar
      ctx.beginPath();
      ctx.arc(bx + barW + 6, by + barH / 2, 4, 0, Math.PI * 2);
      ctx.fillStyle = RESISTANCE_DOT_COLOR[enemy.resistance] || COLORS.ash;
      ctx.fill();
    }

    // Status icon dots above health bar
    let dotX = enemy.x - 4;
    const dotY = by - (enemy.isBoss ? 14 : 6);
    if (enemy.poisoned) {
      ctx.beginPath();
      ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#2D7A2D';
      ctx.fill();
      dotX += 8;
    }
    if (enemy.slowed) {
      ctx.beginPath();
      ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#2D4F9E';
      ctx.fill();
    }
  }
}

// ─── DRAW BULLETS ───
function drawBullets() {
  // Mage trails
  for (const m of MAGE_TRAILS) {
    ctx.globalAlpha = m.life / 8;
    ctx.beginPath();
    ctx.arc(m.x, m.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = m.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Chain lines
  for (const cl of CHAIN_LINES) {
    ctx.globalAlpha = cl.life / 10;
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(cl.x1, cl.y1);
    ctx.lineTo(cl.x2, cl.y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Splash effects — expanding amber circle
  for (const s of SPLASH_EFFECTS) {
    const progress = 1 - s.life / s.maxLife;
    const radius   = 50 * progress;
    ctx.globalAlpha = s.life / s.maxLife;
    ctx.strokeStyle = COLORS.amber;
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Frost bursts — 8 radiating white lines
  for (const f of FROST_BURSTS) {
    ctx.globalAlpha = f.life / 12;
    ctx.strokeStyle = '#DDEEFF';
    ctx.lineWidth   = 1.5;
    const len = 10;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(f.x + Math.cos(angle) * len, f.y + Math.sin(angle) * len);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  for (const bullet of BULLETS) {
    const r = bullet.isMage ? 5 : 3;
    ctx.beginPath();
    ctx.arc(bullet.x, bullet.y, r, 0, Math.PI * 2);
    ctx.fillStyle = bullet.color;
    ctx.fill();
  }

  // DEBUG - remove before release: yellow 50px splash radius ring
  for (const r of DEBUG_SPLASH_RINGS) {
    ctx.globalAlpha = r.life / 30;
    ctx.strokeStyle = '#FFFF00';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 50, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // DEBUG - remove before release: red flash on splash-hit enemies
  for (const f of DEBUG_HIT_FLASHES) {
    if (f.enemy.done) continue;
    ctx.globalAlpha = f.life / 12;
    ctx.beginPath();
    ctx.arc(f.enemy.x, f.enemy.y, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#FF0000';
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ─── DRAW PARTICLES ───
function drawParticles() {
  for (const p of PARTICLES) {
    ctx.globalAlpha = p.life / 35;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ─── DRAW HUD ───
function drawHUD() {
  const isBossWave = waveNum > 0 && waveNum % 5 === 0;
  const lines = [
    `Wave:  ${waveNum}${isBossWave ? ' !' : ''}`,
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

  ctx.font = '13px monospace';
  lines.forEach((line, i) => {
    ctx.fillStyle = (i === 0 && isBossWave) ? COLORS.amber : COLORS.ash;
    ctx.fillText(line, 6 + pad, 6 + pad + lineH * i + 12);
  });

  // Not enough gold message
  if (notEnoughGoldTimer > 0) {
    ctx.fillStyle   = COLORS.crimson;
    ctx.font        = 'bold 14px monospace';
    ctx.textAlign   = 'center';
    ctx.globalAlpha = Math.min(1, notEnoughGoldTimer / 30);
    ctx.fillText('Not enough gold!', canvas.width / 2, canvas.height - 16);
    ctx.textAlign   = 'left';
    ctx.globalAlpha = 1;
  }

  // Synergy notification
  if (synergyTimer > 0) {
    const alpha = Math.min(1, synergyTimer / 40);
    ctx.globalAlpha = alpha;

    const msgW  = 320;
    const msgH  = 48;
    const msgX  = (canvas.width - msgW) / 2;
    const msgY  = canvas.height / 2 - msgH / 2;

    ctx.fillStyle = 'rgba(14, 11, 8, 0.88)';
    ctx.fillRect(msgX, msgY, msgW, msgH);
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth   = 1.5;
    ctx.strokeRect(msgX + 1, msgY + 1, msgW - 2, msgH - 2);

    ctx.fillStyle = COLORS.gold;
    ctx.font      = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(synergyMessage, canvas.width / 2, msgY + 30);
    ctx.textAlign = 'left';

    ctx.globalAlpha = 1;
  }
}

// ─── BOSS ANNOUNCEMENT ───
function drawBossAnnounce() {
  if (bossAnnounceTimer <= 0 || !bossAnnounceData) return;

  ctx.fillStyle = 'rgba(14, 11, 8, 0.90)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  ctx.textAlign = 'center';

  ctx.fillStyle = COLORS.ash;
  ctx.font      = '14px monospace';
  ctx.fillText(`Wave ${bossAnnounceData.waveNum}`, cx, cy - 54);

  ctx.fillStyle = COLORS.gold;
  ctx.font      = 'bold 32px monospace';
  ctx.fillText(bossAnnounceData.name, cx, cy - 10);

  const immuneLabel = { slow: 'Immune to Slow', poison: 'Immune to Poison', chain: 'Immune to Chain' };
  ctx.fillStyle = COLORS.amber;
  ctx.font      = '14px monospace';
  ctx.fillText(immuneLabel[bossAnnounceData.resistance], cx, cy + 24);

  ctx.textAlign = 'left';
}

// ─── BOSS DEFEATED MESSAGE ───
function drawBossDefeated() {
  if (bossDefeatedTimer <= 0) return;

  const alpha = Math.min(1, bossDefeatedTimer / 30);
  ctx.globalAlpha = alpha;

  const msgW = 300;
  const msgH = 50;
  const msgX = (canvas.width - msgW) / 2;
  const msgY = canvas.height / 2 - msgH / 2;

  ctx.fillStyle = 'rgba(14, 11, 8, 0.88)';
  ctx.fillRect(msgX, msgY, msgW, msgH);
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth   = 1.5;
  ctx.strokeRect(msgX + 1, msgY + 1, msgW - 2, msgH - 2);

  ctx.fillStyle = COLORS.gold;
  ctx.font      = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Boss Defeated!', canvas.width / 2, msgY + 32);
  ctx.textAlign = 'left';

  ctx.globalAlpha = 1;
}

// ─── GAME OVER ───
const GAME_OVER_BTN = { w: 160, h: 36 }; // centered, y computed at draw time

function restartGame() {
  lives           = 20;
  gold            = 150;
  score           = 0;
  waveNum         = 0;
  spawning        = false;
  spawnQueue      = [];
  waveRewardGiven = false;
  gameOver        = false;
  selectedTower   = null;
  selectedCard    = null;
  cardOfferActive = false;
  bossAnnounceTimer = 0;
  bossAnnounceData  = null;
  bossDefeatedTimer = 0;
  pendingBossReward = false;
  TOWERS.length       = 0;
  ENEMIES.length      = 0;
  BULLETS.length      = 0;
  PARTICLES.length    = 0;
  CHAIN_LINES.length  = 0;
  SPLASH_EFFECTS.length    = 0;
  FROST_BURSTS.length      = 0;
  MAGE_TRAILS.length       = 0;
  DEBUG_SPLASH_RINGS.length = 0;
  DEBUG_HIT_FLASHES.length  = 0;
  document.getElementById('rerollBtn').style.display = 'none';
  updateTowerBtnStyles();
}

function drawGameOver() {
  const cx     = canvas.width / 2;
  const cy     = canvas.height / 2;
  const panelW = 320;
  const panelH = 160;

  ctx.fillStyle = 'rgba(14, 11, 8, 0.88)';
  ctx.fillRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH);
  ctx.strokeStyle = COLORS.amber;
  ctx.lineWidth   = 1.5;
  ctx.strokeRect(cx - panelW / 2 + 1, cy - panelH / 2 + 1, panelW - 2, panelH - 2);

  ctx.textAlign = 'center';

  ctx.fillStyle = COLORS.gold;
  ctx.font      = 'bold 32px monospace';
  ctx.fillText('Game Over', cx, cy - 40);

  ctx.fillStyle = COLORS.ash;
  ctx.font      = '14px monospace';
  ctx.fillText(`Score: ${score}`, cx, cy - 10);
  ctx.fillText(`Wave reached: ${waveNum}`, cx, cy + 12);

  // Play Again button
  const btnX = cx - GAME_OVER_BTN.w / 2;
  const btnY = cy + 36;
  ctx.fillStyle = '#1C1410';
  ctx.fillRect(btnX, btnY, GAME_OVER_BTN.w, GAME_OVER_BTN.h);
  ctx.strokeStyle = COLORS.amber;
  ctx.lineWidth   = 2;
  ctx.strokeRect(btnX + 1, btnY + 1, GAME_OVER_BTN.w - 2, GAME_OVER_BTN.h - 2);
  ctx.fillStyle = COLORS.ash;
  ctx.font      = '14px monospace';
  ctx.fillText('Play Again', cx, btnY + 23);

  ctx.textAlign = 'left';

  // Store button bounds for hit testing (y is relative to canvas center)
  GAME_OVER_BTN.x = btnX;
  GAME_OVER_BTN.y = btnY;
}

// ─── MAIN DRAW ───
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMap();
  drawTowers();
  drawEnemies();
  drawBullets();
  drawParticles();
  drawHUD();
  drawBossDefeated();
  if (bossAnnounceTimer > 0) drawBossAnnounce();
  if (cardOfferActive || selectedCard !== null) drawCardOffer();
}

// ─── GAME LOOP ───
function gameLoop() {
  if (lives <= 0 && !gameOver) gameOver = true;

  if (gameOver) {
    draw();
    drawGameOver();
    requestAnimationFrame(gameLoop);
    return;
  }

  if (synergyTimer > 0)        synergyTimer--;
  if (cardFullTimer > 0)       cardFullTimer--;
  if (notEnoughGoldTimer > 0)  notEnoughGoldTimer--;

  // Boss defeated countdown — trigger bonus card offer when it expires
  if (bossDefeatedTimer > 0) {
    bossDefeatedTimer--;
    if (bossDefeatedTimer === 0 && pendingBossReward) {
      pendingBossReward = false;
      waveRewardGiven   = true; // prevent normal wave-end offer from also firing
      offerCards();
    }
  }

  if (!cardOfferActive && selectedCard === null) {
    updateSpawnQueue();
    updateEnemies();
    updateTowers();
    updateBullets();
    updateParticles();

    // Trigger card offer when wave is fully cleared
    if (waveNum > 0 && !spawning && spawnQueue.length === 0 && ENEMIES.length === 0 && !cardOfferActive && !waveRewardGiven) {
      waveRewardGiven = true;
      offerCards();
    }
  }

  draw();
  requestAnimationFrame(gameLoop);
}

updateTowerBtnStyles();
gameLoop();
