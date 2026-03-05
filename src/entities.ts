import { playExplosion, playLose, playSlice } from './audio.ts';
import { BOMB_RADIUS, FRUIT_COLORS, GRAVITY, MIN_SLASH_VELOCITY, s } from './constants.ts';
import { colorBoxes, durationBoxes, entities, game, hand } from './state.ts';

// --- Difficulty scaling ---
// Returns 0 at game start, 1 at game end
function getProgress(): number {
  if (game.gameDuration <= 0) return 0;
  const elapsed = (performance.now() - game.gameStartTime) / 1000;
  return Math.min(1, elapsed / game.gameDuration);
}

// Linearly interpolate between start and end based on progress
function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

// Difficulty parameters that scale with progress:
//   spawn interval:  1200ms → 500ms  (faster spawns)
//   bomb chance:     10% → 35%       (more bombs)
//   launch speed:    1000-1500 → 1300-2000 (faster fruit)
//   fruits per wave: 1 → up to 3     (clusters)
function getSpawnInterval(): number { return lerp(1200, 500, getProgress()); }
function getBombChance(): number { return lerp(0.10, 0.35, getProgress()); }
function getLaunchSpeed(): { base: number; range: number } {
  const p = getProgress();
  return { base: s(lerp(1000, 1300, p)), range: s(lerp(500, 700, p)) };
}
function getFruitsPerWave(): number {
  const p = getProgress();
  // At 0% → always 1, at 100% → 40% chance of 2, 15% chance of 3
  const roll = Math.random();
  if (p > 0.7 && roll < 0.15) return 3;
  if (p > 0.3 && roll < 0.4 * p) return 2;
  return 1;
}

// --- Spawning ---

export function spawnFruit(canvasW: number, canvasH: number) {
  const { base, range } = getLaunchSpeed();
  const radius = s(50 + Math.random() * 30);
  const x = radius + Math.random() * (canvasW - radius * 2);
  const color = FRUIT_COLORS[Math.floor(Math.random() * FRUIT_COLORS.length)];
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
    if (Math.random() < bombChance) {
      spawnBomb(canvasW, canvasH);
    } else {
      spawnFruit(canvasW, canvasH);
    }
  }
}

export { getSpawnInterval };

// --- Slice / hit effects ---

export function sliceFruit(fruit: typeof entities.fruits[0]) {
  fruit.sliced = true;
  game.score++;
  playSlice();

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

  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = s(100 + Math.random() * 300);
    entities.particles.push({
      x: fruit.x,
      y: fruit.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: s(2 + Math.random() * 4),
      color: fruit.color,
      alpha: 1,
      decay: 1.5 + Math.random() * 1.5,
    });
  }
}

export function hitBomb(bomb: typeof entities.bombs[0]) {
  bomb.hit = true;
  game.lives--;
  playExplosion();
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

export function updateFruits(dt: number, canvasH: number) {
  const gravity = s(GRAVITY);
  for (let i = entities.fruits.length - 1; i >= 0; i--) {
    const f = entities.fruits[i];
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    f.vy += gravity * dt;
    f.angle += f.angularVel * dt;
    if (f.y > canvasH + f.radius * 2 || f.sliced) entities.fruits.splice(i, 1);
  }
}

export function updateBombs(dt: number, canvasH: number) {
  const gravity = s(GRAVITY);
  for (let i = entities.bombs.length - 1; i >= 0; i--) {
    const b = entities.bombs[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vy += gravity * dt;
    b.fuse += dt * 10;
    b.angle += b.angularVel * dt;
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

export function updateAllEntities(dt: number, canvasH: number) {
  updateFruits(dt, canvasH);
  updateBombs(dt, canvasH);
  updateHalves(dt, canvasH);
  updateParticles(dt);
  updateExplosions(dt);
}

export function updateEffectsOnly(dt: number, canvasH: number) {
  updateHalves(dt, canvasH);
  updateParticles(dt);
  updateExplosions(dt);
}

// --- Collision detection ---

export function checkSlashing(tipX: number, tipY: number) {
  if (hand.velocity < s(MIN_SLASH_VELOCITY)) return;

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