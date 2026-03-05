export interface Point {
  x: number;
  y: number;
  t: number;
}

export interface Fruit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  sliced: boolean;
}

export interface Bomb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hit: boolean;
  fuse: number;
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