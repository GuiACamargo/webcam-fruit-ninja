export interface Point {
  x: number;
  y: number;
  t: number;
}

export type FruitKind = 'normal' | 'golden' | 'freeze';

export interface Fruit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  sliced: boolean;
  angle: number;
  angularVel: number;
  kind: FruitKind;
}

export interface Bomb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hit: boolean;
  fuse: number;
  angle: number;
  angularVel: number;
}

export interface FruitHalf {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  angle: number;
  angularVel: number;
  startAngle: number;
  alpha: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  decay: number;
}

export interface Explosion {
  x: number;
  y: number;
  age: number;
  maxAge: number;
  maxRadius: number;
}

export interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
  maxAge: number;
}

export interface ColorBox {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  fillRgba: string;
  borderColor: string;
}

export interface DurationBox {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  seconds: number;
}