import { COLOR_OPTIONS, COMBO_MIN, COMBO_WINDOW_MS, DURATION_OPTIONS, MAX_LIVES, s, TRAIL_MAX_LEN } from './constants.ts';
import type { Bomb, ColorBox, DurationBox, Explosion, FloatingText, Fruit, FruitHalf, Particle, Point } from './types.ts';

export type GameState = 'menu' | 'playing' | 'paused' | 'gameover' | 'win';

export const game = {
  state: 'menu' as GameState,
  score: 0,
  lives: MAX_LIVES,
  activeColor: '#00ff64',
  gameDuration: 60,
  gameStartTime: 0,
  timeRemaining: 0,
  lastSpawnTime: 0,
  pauseTime: 0,
  twoHands: false,
};

export const hand = {
  landmarks: null as { x: number; y: number; z: number }[] | null,
  secondLandmarks: null as { x: number; y: number; z: number }[] | null,
  visible: false,
  secondVisible: false,
  prevTip: null as Point | null,
  secondPrevTip: null as Point | null,
  velocity: 0,
  secondVelocity: 0,
};

// Combo tracking
export const combo = {
  streak: 0,
  lastSliceTime: 0,
};

// Screen shake
export const shake = {
  active: false,
  startTime: 0,
};

// Freeze effect
export const freeze = {
  active: false,
  endTime: 0,
};

// High score
const HS_KEY = 'fruit-ninja-highscore';
export function getHighScore(): number {
  return parseInt(localStorage.getItem(HS_KEY) || '0', 10);
}
export function saveHighScore(score: number) {
  const current = getHighScore();
  if (score > current) localStorage.setItem(HS_KEY, String(score));
}

export const trail: Point[] = [];
export const secondTrail: Point[] = [];

export const entities = {
  fruits: [] as Fruit[],
  bombs: [] as Bomb[],
  fruitHalves: [] as FruitHalf[],
  particles: [] as Particle[],
  explosions: [] as Explosion[],
  floatingTexts: [] as FloatingText[],
};

export let colorBoxes: ColorBox[] = [];
export let durationBoxes: DurationBox[] = [];

export function initColorBoxes() {
  const boxW = s(60), boxH = s(60), gap = s(16), marginRight = s(30), marginTop = s(20);
  colorBoxes = COLOR_OPTIONS.map((c, i) => ({
    x: marginRight + i * (boxW + gap),
    y: marginTop,
    w: boxW,
    h: boxH,
    ...c,
  }));
}

export function initDurationBoxes(cw: number, ch: number) {
  const boxW = s(140), boxH = s(70), gap = s(30);
  const totalW = DURATION_OPTIONS.length * boxW + (DURATION_OPTIONS.length - 1) * gap;
  const startX = (cw - totalW) / 2;
  const y = ch * 0.55;
  durationBoxes = DURATION_OPTIONS.map((o, i) => ({
    x: startX + i * (boxW + gap),
    y,
    w: boxW,
    h: boxH,
    ...o,
  }));
}

export function addTrailPoint(x: number, y: number, t: number) {
  trail.push({ x, y, t });
  if (trail.length > TRAIL_MAX_LEN) trail.shift();
}

export function addSecondTrailPoint(x: number, y: number, t: number) {
  secondTrail.push({ x, y, t });
  if (secondTrail.length > TRAIL_MAX_LEN) secondTrail.shift();
}

// Record a slice for combo tracking, returns the current combo multiplier
export function recordSlice(): number {
  const now = performance.now();
  if (now - combo.lastSliceTime < COMBO_WINDOW_MS) {
    combo.streak++;
  } else {
    combo.streak = 1;
  }
  combo.lastSliceTime = now;
  return combo.streak >= COMBO_MIN ? combo.streak : 1;
}

export function addFloatingText(x: number, y: number, text: string, color: string) {
  entities.floatingTexts.push({ x, y, text, color, age: 0, maxAge: 1.2 });
}

export function triggerShake() {
  shake.active = true;
  shake.startTime = performance.now();
}

export function activateFreeze() {
  freeze.active = true;
  freeze.endTime = performance.now() + 2000;
}

export function clearAll() {
  entities.fruits.length = 0;
  entities.bombs.length = 0;
  entities.fruitHalves.length = 0;
  entities.particles.length = 0;
  entities.explosions.length = 0;
  entities.floatingTexts.length = 0;
  trail.length = 0;
  secondTrail.length = 0;
  hand.prevTip = null;
  hand.secondPrevTip = null;
  hand.velocity = 0;
  hand.secondVelocity = 0;
  combo.streak = 0;
  combo.lastSliceTime = 0;
  shake.active = false;
  freeze.active = false;
}