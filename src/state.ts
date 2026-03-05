import { COLOR_OPTIONS, DURATION_OPTIONS, MAX_LIVES, s, TRAIL_MAX_LEN } from './constants.ts';
import type { Bomb, ColorBox, DurationBox, Explosion, Fruit, FruitHalf, Particle, Point } from './types.ts';

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
};

export const hand = {
  landmarks: null as { x: number; y: number; z: number }[] | null,
  visible: false,
  prevTip: null as Point | null,
  velocity: 0,
};

export const trail: Point[] = [];

export const entities = {
  fruits: [] as Fruit[],
  bombs: [] as Bomb[],
  fruitHalves: [] as FruitHalf[],
  particles: [] as Particle[],
  explosions: [] as Explosion[],
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

export function clearAll() {
  entities.fruits.length = 0;
  entities.bombs.length = 0;
  entities.fruitHalves.length = 0;
  entities.particles.length = 0;
  entities.explosions.length = 0;
  trail.length = 0;
  hand.prevTip = null;
  hand.velocity = 0;
}