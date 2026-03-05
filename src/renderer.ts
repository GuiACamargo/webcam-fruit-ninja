import { HAND_CONNECTIONS, TRAIL_FADE_MS, s } from './constants.ts';
import { colorBoxes, durationBoxes, entities, game, trail } from './state.ts';
import type { Bomb, Explosion, Fruit, FruitHalf, Particle } from './types.ts';

let ctx: CanvasRenderingContext2D;
let canvasWidth: number;
let canvasHeight: number;

export function initRenderer(canvas: HTMLCanvasElement) {
  ctx = canvas.getContext('2d')!;
  canvasWidth = canvas.width;
  canvasHeight = canvas.height;
}

// --- Utility ---

function hexToRgb(hex: string) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r
    ? { r: parseInt(r[1], 16), g: parseInt(r[2], 16), b: parseInt(r[3], 16) }
    : { r: 0, g: 255, b: 100 };
}

function withFlippedText(fn: () => void) {
  ctx.save();
  ctx.translate(canvasWidth, 0);
  ctx.scale(-1, 1);
  fn();
  ctx.restore();
}

// --- Hand skeleton ---

export function drawHandSkeleton(landmarks: { x: number; y: number; z: number }[]) {
  ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
  ctx.lineWidth = 2;
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(landmarks[a].x * canvasWidth, landmarks[a].y * canvasHeight);
    ctx.lineTo(landmarks[b].x * canvasWidth, landmarks[b].y * canvasHeight);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(200, 200, 200, 0.4)';
  for (const lm of landmarks) {
    ctx.beginPath();
    ctx.arc(lm.x * canvasWidth, lm.y * canvasHeight, s(4), 0, Math.PI * 2);
    ctx.fill();
  }
}

// --- Fingertip + trail ---

export function drawFingertip(x: number, y: number) {
  const rgb = hexToRgb(game.activeColor);
  ctx.beginPath();
  ctx.arc(x, y, s(10), 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7)`;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawTrail() {
  if (trail.length < 2) return;

  const now = performance.now();
  const rgb = hexToRgb(game.activeColor);

  for (let i = 1; i < trail.length; i++) {
    const age = now - trail[i].t;
    const alpha = Math.max(0, 1 - age / TRAIL_FADE_MS);
    if (alpha <= 0) continue;

    ctx.beginPath();
    ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
    ctx.lineTo(trail[i].x, trail[i].y);
    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    ctx.lineWidth = s(alpha * 6 + 2);
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  const cutoff = now - TRAIL_FADE_MS;
  while (trail.length > 0 && trail[0].t < cutoff) trail.shift();
}

// --- Game entities ---

export function drawFruit(f: Fruit) {
  ctx.beginPath();
  ctx.arc(f.x, f.y, f.radius, 0, Math.PI * 2);
  ctx.fillStyle = f.color;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(f.x - f.radius * 0.25, f.y - f.radius * 0.25, f.radius * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fill();
}

export function drawBomb(b: Bomb) {
  // Body
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Highlight
  ctx.beginPath();
  ctx.arc(b.x - b.radius * 0.3, b.y - b.radius * 0.3, b.radius * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fill();

  // Fuse
  const fsx = b.x + b.radius * 0.5;
  const fsy = b.y - b.radius * 0.7;
  const fex = fsx + s(12);
  const fey = fsy - s(16);

  ctx.beginPath();
  ctx.moveTo(fsx, fsy);
  ctx.quadraticCurveTo(fsx + s(8), fsy - s(4), fex, fey);
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Spark
  const ss = s(4 + Math.sin(b.fuse) * 2);
  ctx.beginPath();
  ctx.arc(fex, fey, ss, 0, Math.PI * 2);
  ctx.fillStyle = Math.sin(b.fuse * 2) > 0 ? '#ff4500' : '#ffcc00';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(fex, fey, ss + s(4), 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 150, 0, 0.3)';
  ctx.fill();

  // Danger mark
  const ms = b.radius * 0.35;
  ctx.strokeStyle = '#cc0000';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(b.x - ms, b.y - ms);
  ctx.lineTo(b.x + ms, b.y + ms);
  ctx.moveTo(b.x + ms, b.y - ms);
  ctx.lineTo(b.x - ms, b.y + ms);
  ctx.stroke();
}

export function drawExplosion(e: Explosion) {
  const progress = e.age / e.maxAge;
  const radius = e.maxRadius * progress;
  const alpha = 1 - progress;

  ctx.beginPath();
  ctx.arc(e.x, e.y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255, 100, 0, ${alpha * 0.8})`;
  ctx.lineWidth = s(8) * (1 - progress);
  ctx.stroke();

  const ir = radius * 0.5;
  const gradient = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, ir);
  gradient.addColorStop(0, `rgba(255, 255, 200, ${alpha * 0.6})`);
  gradient.addColorStop(0.5, `rgba(255, 120, 0, ${alpha * 0.4})`);
  gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');
  ctx.beginPath();
  ctx.arc(e.x, e.y, ir, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
}

export function drawHalf(h: FruitHalf) {
  ctx.save();
  ctx.globalAlpha = Math.max(0, h.alpha);
  ctx.translate(h.x, h.y);
  ctx.rotate(h.angle);

  ctx.beginPath();
  ctx.arc(0, 0, h.radius, h.startAngle, h.startAngle + Math.PI);
  ctx.closePath();
  ctx.fillStyle = h.color;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, -h.radius);
  ctx.lineTo(0, h.radius);
  ctx.strokeStyle = 'rgba(255, 255, 200, 0.6)';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.restore();
}

export function drawParticle(p: Particle) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
  ctx.fillStyle = p.color;
  ctx.globalAlpha = Math.max(0, p.alpha);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// --- Batch draw helpers ---

export function drawAllEntities() {
  for (const f of entities.fruits) drawFruit(f);
  for (const b of entities.bombs) drawBomb(b);
  for (const h of entities.fruitHalves) drawHalf(h);
  for (const p of entities.particles) drawParticle(p);
  for (const e of entities.explosions) drawExplosion(e);
}

export function drawEffectsOnly() {
  for (const h of entities.fruitHalves) drawHalf(h);
  for (const p of entities.particles) drawParticle(p);
  for (const e of entities.explosions) drawExplosion(e);
}

export function drawFrozenEntities() {
  for (const f of entities.fruits) drawFruit(f);
  for (const b of entities.bombs) drawBomb(b);
  for (const h of entities.fruitHalves) drawHalf(h);
}

// --- Color boxes ---

export function drawColorBoxes() {
  withFlippedText(() => {
    for (const box of colorBoxes) {
      const dx = canvasWidth - box.x - box.w;

      ctx.fillStyle = box.fillRgba;
      ctx.strokeStyle = box.borderColor;
      ctx.lineWidth = s(3);
      ctx.beginPath();
      ctx.roundRect(dx, box.y, box.w, box.h, s(8));
      ctx.fill();
      ctx.stroke();

      if (game.activeColor === box.color) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = s(2);
        ctx.beginPath();
        ctx.roundRect(dx + s(4), box.y + s(4), box.w - s(8), box.h - s(8), s(5));
        ctx.stroke();
      }
    }
  });
}

// --- Overlay screens ---

export function drawMenu() {
  withFlippedText(() => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${s(80)}px Segoe UI, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FRUIT NINJA', canvasWidth / 2, canvasHeight * 0.25);

    ctx.font = `${s(28)}px Segoe UI, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('Pinch to select game duration', canvasWidth / 2, canvasHeight * 0.42);

    for (const box of durationBoxes) {
      const dx = canvasWidth - box.x - box.w;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = s(3);
      ctx.beginPath();
      ctx.roundRect(dx, box.y, box.w, box.h, s(12));
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = `bold ${s(36)}px Segoe UI, Arial, sans-serif`;
      ctx.fillText(box.label, dx + box.w / 2, box.y + box.h / 2);
    }

    ctx.font = `${s(20)}px Segoe UI, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText('Pick trail color by pinching on the color boxes (top right)', canvasWidth / 2, canvasHeight * 0.82);
  });
}

export function drawPauseOverlay() {
  withFlippedText(() => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${s(70)}px Segoe UI, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', canvasWidth / 2, canvasHeight / 2 - s(20));

    ctx.font = `${s(26)}px Segoe UI, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText('Press SPACE to resume', canvasWidth / 2, canvasHeight / 2 + s(40));
  });
}

export function drawEndScreen(title: string) {
  withFlippedText(() => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${s(80)}px Segoe UI, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, canvasWidth / 2, canvasHeight / 2 - s(40));

    ctx.font = `${s(40)}px Segoe UI, Arial, sans-serif`;
    ctx.fillText(`Final Score: ${game.score}`, canvasWidth / 2, canvasHeight / 2 + s(40));

    ctx.font = `${s(24)}px Segoe UI, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText('Press SPACE to restart', canvasWidth / 2, canvasHeight / 2 + s(100));
  });
}

export function clearCanvas() {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
}