import { playExplosion, playLose, playSlice } from './audio.ts';
import { BOMB_RADIUS, FREEZE_CHANCE, FRUIT_COLORS, GOLDEN_CHANCE, GOLDEN_POINTS, GRAVITY, MIN_SLASH_VELOCITY, s } from './constants.ts';
import { activateFreeze, addFloatingText, colorBoxes, durationBoxes, entities, freeze, game, recordSlice, triggerShake } from './state.ts';
import type { FruitKind } from './types.ts';

// --- Difficulty scaling ---
function getProgress(): number {
  if (game.gameDuration <= 0) return 0;
  const elapsed = (performance.now() - game.gameStartTime) / 1000;
  return Math.min(1, elapsed / game.gameDuration);
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function getSpawnInterval(): number { return lerp(1200, 500, getProgress()); }
function getBombChance(): number { return lerp(0.10, 0.35, getProgress()); }
function getLaunchSpeed(): { base: number; range: number } {
  const p = getProgress();
  return { base: s(lerp(900, 1200, p)), range: s(lerp(450, 600, p)) };
}
function getFruitsPerWave(): number {
  const p = getProgress();
  const roll = Math.random();
  if (p > 0.7 && roll < 0.15) return 3;
  if (p > 0.3 && roll < 0.4 * p) return 2;
  return 1;
}

// Determine fruit kind
function rollFruitKind(): FruitKind {
  const r = Math.random();
  if (r < GOLDEN_CHANCE) return 'golden';
  if (r < GOLDEN_CHANCE + FREEZE_CHANCE) return 'freeze';
  return 'normal';
}

function getFruitColor(kind: FruitKind): string {
  switch (kind) {
    case 'golden': return '#ffd700';
    case 'freeze': return '#00cfff';
    default: return FRUIT_COLORS[Math.floor(Math.random() * FRUIT_COLORS.length)];
  }
}

function getFruitRadius(kind: FruitKind): number {
  switch (kind) {
    case 'golden': return s(40 + Math.random() * 20);
    case 'freeze': return s(45 + Math.random() * 20);
    default: return s(50 + Math.random() * 30);
  }
}

// --- Spawning ---

export function spawnFruit(canvasW: number, canvasH: number) {
  const { base, range } = getLaunchSpeed();
  const kind = rollFruitKind();
  const radius = getFruitRadius(kind);
  const color = getFruitColor(kind);
  const x = radius + Math.random() * (canvasW - radius * 2);
  entities.fruits.push({
    x,
    y: canvasH + radius,
    vx: (Math.random() - 0.5) * s(300),
    vy: -(base + Math.random() * range),
    radius,
    color,
    sliced: false,
    angle: Math.random() * Math.PI * 2,
    angularVel: (Math.random() - 0.5) * 8,
    kind,
  });
}

export function spawnBomb(canvasW: number, canvasH: number) {
  const { base, range } = getLaunchSpeed();
  const speedMult = 0.85;
  const r = s(BOMB_RADIUS);
  const x = r + Math.random() * (canvasW - r * 2);
  entities.bombs.push({
    x,
    y: canvasH + r,
    vx: (Math.random() - 0.5) * s(300),
    vy: -(base * speedMult + Math.random() * range * speedMult),
    radius: r,
    hit: false,
    fuse: 0,
    angle: Math.random() * Math.PI * 2,
    angularVel: (Math.random() - 0.5) * 6,
  });
}

export function spawnWave(canvasW: number, canvasH: number) {
  const bombChance = getBombChance();
  const count = getFruitsPerWave();
  for (let i = 0; i < count; i++) {
    if (Math.random() < bombChance) spawnBomb(canvasW, canvasH);
    else spawnFruit(canvasW, canvasH);
  }
}

export { getSpawnInterval };

// --- Slice / hit effects ---

export function sliceFruit(fruit: typeof entities.fruits[0]) {
  fruit.sliced = true;
  playSlice();

  // Points based on kind
  let points = 1;
  if (fruit.kind === 'golden') points = GOLDEN_POINTS;

  // Combo
  const comboMult = recordSlice();
  const totalPoints = points * comboMult;
  game.score += totalPoints;

  // Floating text
  if (fruit.kind === 'golden') {
    addFloatingText(fruit.x, fruit.y, `+${totalPoints} GOLDEN!`, '#ffd700');
  } else if (fruit.kind === 'freeze') {
    addFloatingText(fruit.x, fruit.y, 'FREEZE!', '#00cfff');
    activateFreeze();
  } else if (comboMult >= 3) {
    addFloatingText(fruit.x, fruit.y, `COMBO x${comboMult}! +${totalPoints}`, '#ff0');
  }

  const spreadVx = s(120 + Math.random() * 80);
  for (let side = 0; side < 2; side++) {
    const dir = side === 0 ? -1 : 1;
    entities.fruitHalves.push({
      x: fruit.x,
      y: fruit.y,
      vx: fruit.vx + dir * spreadVx,
      vy: fruit.vy - s(50) - Math.random() * s(100),
      radius: fruit.radius,
      color: fruit.color,
      angle: 0,
      angularVel: dir * (3 + Math.random() * 4),
      startAngle: side === 0 ? 0 : Math.PI,
      alpha: 1,
    });
  }

  const particleColor = fruit.kind === 'golden' ? '#ffd700'
    : fruit.kind === 'freeze' ? '#00cfff'
    : fruit.color;
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = s(100 + Math.random() * 300);
    entities.particles.push({
      x: fruit.x,
      y: fruit.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: s(2 + Math.random() * 4),
      color: particleColor,
      alpha: 1,
      decay: 1.5 + Math.random() * 1.5,
    });
  }
}

export function hitBomb(bomb: typeof entities.bombs[0]) {
  bomb.hit = true;
  game.lives--;
  playExplosion();
  triggerShake();

  if (game.lives <= 0) {
    game.state = 'gameover';
    playLose();
  }

  entities.explosions.push({
    x: bomb.x,
    y: bomb.y,
    age: 0,
    maxAge: 0.6,
    maxRadius: s(180),
  });

  const fireColors = ['#ff4500', '#ff6600', '#ffaa00', '#ffcc00', '#333'];
  for (let i = 0; i < 30; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = s(150 + Math.random() * 500);
    entities.particles.push({
      x: bomb.x,
      y: bomb.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - s(100),
      radius: s(3 + Math.random() * 8),
      color: fireColors[Math.floor(Math.random() * fireColors.length)],
      alpha: 1,
      decay: 1.2 + Math.random() * 1.5,
    });
  }
}

// --- Update functions ---

function getTimeScale(): number {
  return freeze.active && performance.now() < freeze.endTime ? 0.3 : 1;
}

export function updateFreeze() {
  if (freeze.active && performance.now() >= freeze.endTime) {
    freeze.active = false;
  }
}

export function updateFruits(dt: number, canvasH: number) {
  const gravity = s(GRAVITY);
  const ts = getTimeScale();
  for (let i = entities.fruits.length - 1; i >= 0; i--) {
    const f = entities.fruits[i];
    f.x += f.vx * dt * ts;
    f.y += f.vy * dt * ts;
    f.vy += gravity * dt * ts;
    f.angle += f.angularVel * dt * ts;
    if (f.y > canvasH + f.radius * 2 || f.sliced) entities.fruits.splice(i, 1);
  }
}

export function updateBombs(dt: number, canvasH: number) {
  const gravity = s(GRAVITY);
  const ts = getTimeScale();
  for (let i = entities.bombs.length - 1; i >= 0; i--) {
    const b = entities.bombs[i];
    b.x += b.vx * dt * ts;
    b.y += b.vy * dt * ts;
    b.vy += gravity * dt * ts;
    b.fuse += dt * 10;
    b.angle += b.angularVel * dt * ts;
    if (b.y > canvasH + b.radius * 2 || b.hit) entities.bombs.splice(i, 1);
  }
}

export function updateHalves(dt: number, canvasH: number) {
  const gravity = s(GRAVITY);
  for (let i = entities.fruitHalves.length - 1; i >= 0; i--) {
    const h = entities.fruitHalves[i];
    h.x += h.vx * dt;
    h.y += h.vy * dt;
    h.vy += gravity * dt;
    h.angle += h.angularVel * dt;
    h.alpha -= 0.8 * dt;
    if (h.alpha <= 0 || h.y > canvasH + h.radius * 2) entities.fruitHalves.splice(i, 1);
  }
}

export function updateParticles(dt: number) {
  const gravity = s(GRAVITY) * 0.5;
  for (let i = entities.particles.length - 1; i >= 0; i--) {
    const p = entities.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += gravity * dt;
    p.alpha -= p.decay * dt;
    if (p.alpha <= 0) entities.particles.splice(i, 1);
  }
}

export function updateExplosions(dt: number) {
  for (let i = entities.explosions.length - 1; i >= 0; i--) {
    entities.explosions[i].age += dt;
    if (entities.explosions[i].age >= entities.explosions[i].maxAge) entities.explosions.splice(i, 1);
  }
}

export function updateFloatingTexts(dt: number) {
  for (let i = entities.floatingTexts.length - 1; i >= 0; i--) {
    const ft = entities.floatingTexts[i];
    ft.age += dt;
    ft.y -= s(60) * dt; // float upward
    if (ft.age >= ft.maxAge) entities.floatingTexts.splice(i, 1);
  }
}

export function updateAllEntities(dt: number, canvasH: number) {
  updateFreeze();
  updateFruits(dt, canvasH);
  updateBombs(dt, canvasH);
  updateHalves(dt, canvasH);
  updateParticles(dt);
  updateExplosions(dt);
  updateFloatingTexts(dt);
}

export function updateEffectsOnly(dt: number, canvasH: number) {
  updateHalves(dt, canvasH);
  updateParticles(dt);
  updateExplosions(dt);
  updateFloatingTexts(dt);
}

// --- Collision detection ---

export function checkSlashing(tipX: number, tipY: number, velocity: number) {
  if (velocity < s(MIN_SLASH_VELOCITY)) return;

  const grace = s(15);
  for (const fruit of entities.fruits) {
    if (fruit.sliced) continue;
    const dx = tipX - fruit.x, dy = tipY - fruit.y;
    if (Math.sqrt(dx * dx + dy * dy) < fruit.radius + grace) sliceFruit(fruit);
  }

  for (const bomb of entities.bombs) {
    if (bomb.hit) continue;
    const dx = tipX - bomb.x, dy = tipY - bomb.y;
    if (Math.sqrt(dx * dx + dy * dy) < bomb.radius + grace) hitBomb(bomb);
  }
}

// --- UI box checks ---

export function checkColorBoxes(x: number, y: number, pinching: boolean) {
  if (!pinching) return;
  for (const box of colorBoxes) {
    if (isInsideBox(x, y, box)) {
      game.activeColor = box.color;
      return;
    }
  }
}

export function checkDurationBoxes(x: number, y: number, pinching: boolean): boolean {
  if (!pinching) return false;
  for (const box of durationBoxes) {
    if (isInsideBox(x, y, box)) {
      game.gameDuration = box.seconds;
      return true;
    }
  }
  return false;
}

function isInsideBox(x: number, y: number, box: { x: number; y: number; w: number; h: number }) {
  return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
}