import { HAND_CONNECTIONS, SHAKE_DURATION, SHAKE_INTENSITY, TRAIL_FADE_MS, s } from './constants.ts';
import { colorBoxes, durationBoxes, entities, freeze, game, getHighScore, secondTrail, shake, trail } from './state.ts';
import type { Bomb, Explosion, FloatingText, Fruit, FruitHalf, Particle } from './types.ts';

let ctx: CanvasRenderingContext2D;
let canvasEl: HTMLCanvasElement;
let canvasWidth: number;
let canvasHeight: number;

export function initRenderer(canvas: HTMLCanvasElement) {
  canvasEl = canvas;
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

// --- Screen shake ---

export function applyShake() {
  if (!shake.active) return;
  const elapsed = performance.now() - shake.startTime;
  if (elapsed > SHAKE_DURATION) {
    shake.active = false;
    return;
  }
  const decay = 1 - elapsed / SHAKE_DURATION;
  const ox = (Math.random() - 0.5) * 2 * s(SHAKE_INTENSITY) * decay;
  const oy = (Math.random() - 0.5) * 2 * s(SHAKE_INTENSITY) * decay;
  ctx.translate(ox, oy);
}

export function resetShake() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// --- Freeze overlay tint ---

export function drawFreezeOverlay() {
  if (!freeze.active) return;
  const remaining = freeze.endTime - performance.now();
  if (remaining <= 0) return;
  const alpha = Math.min(0.15, remaining / 2000 * 0.15);
  ctx.fillStyle = `rgba(0, 200, 255, ${alpha})`;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
}

// --- Hand skeleton ---

export function drawHandSkeleton(landmarks: { x: number; y: number; z: number }[]) {
  const rgb = hexToRgb(game.activeColor);
  ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`;
  ctx.lineWidth = 2;
  for (const [a, b] of HAND_CONNECTIONS) {
    ctx.beginPath();
    ctx.moveTo(landmarks[a].x * canvasWidth, landmarks[a].y * canvasHeight);
    ctx.lineTo(landmarks[b].x * canvasWidth, landmarks[b].y * canvasHeight);
    ctx.stroke();
  }

  ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4)`;
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

function drawTrailArray(trailArr: typeof trail) {
  if (trailArr.length < 2) return;

  const now = performance.now();
  const rgb = hexToRgb(game.activeColor);

  for (let i = 1; i < trailArr.length; i++) {
    const age = now - trailArr[i].t;
    const alpha = Math.max(0, 1 - age / TRAIL_FADE_MS);
    if (alpha <= 0) continue;

    ctx.beginPath();
    ctx.moveTo(trailArr[i - 1].x, trailArr[i - 1].y);
    ctx.lineTo(trailArr[i].x, trailArr[i].y);
    ctx.strokeStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    ctx.lineWidth = s(alpha * 6 + 2);
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  const cutoff = now - TRAIL_FADE_MS;
  while (trailArr.length > 0 && trailArr[0].t < cutoff) trailArr.shift();
}

export function drawTrail() { drawTrailArray(trail); }
export function drawSecondTrail() { drawTrailArray(secondTrail); }

// --- Game entities ---

export function drawFruit(f: Fruit) {
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.rotate(f.angle);

  // Golden glow
  if (f.kind === 'golden') {
    ctx.beginPath();
    ctx.arc(0, 0, f.radius * 1.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
    ctx.fill();
  }

  // Freeze glow
  if (f.kind === 'freeze') {
    ctx.beginPath();
    ctx.arc(0, 0, f.radius * 1.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 207, 255, 0.2)';
    ctx.fill();
  }

  ctx.beginPath();
  ctx.arc(0, 0, f.radius, 0, Math.PI * 2);
  ctx.fillStyle = f.color;
  ctx.fill();

  // Highlight
  ctx.beginPath();
  ctx.arc(-f.radius * 0.25, -f.radius * 0.25, f.radius * 0.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.fill();

  // Star icon for golden
  if (f.kind === 'golden') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = `${f.radius * 0.8}px Segoe UI, Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u2605', 0, 0);
  }

  // Snowflake icon for freeze
  if (f.kind === 'freeze') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = `${f.radius * 0.8}px Segoe UI, Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('\u2744', 0, 0);
  }

  ctx.restore();
}

export function drawBomb(b: Bomb) {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.angle);

  ctx.beginPath();
  ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(-b.radius * 0.3, -b.radius * 0.3, b.radius * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.fill();

  const fsx = b.radius * 0.5;
  const fsy = -b.radius * 0.7;
  const fex = fsx + s(12);
  const fey = fsy - s(16);

  ctx.beginPath();
  ctx.moveTo(fsx, fsy);
  ctx.quadraticCurveTo(fsx + s(8), fsy - s(4), fex, fey);
  ctx.strokeStyle = '#8B4513';
  ctx.lineWidth = 3;
  ctx.stroke();

  const ss = s(4 + Math.sin(b.fuse) * 2);
  ctx.beginPath();
  ctx.arc(fex, fey, ss, 0, Math.PI * 2);
  ctx.fillStyle = Math.sin(b.fuse * 2) > 0 ? '#ff4500' : '#ffcc00';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(fex, fey, ss + s(4), 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 150, 0, 0.3)';
  ctx.fill();

  const ms = b.radius * 0.35;
  ctx.strokeStyle = '#cc0000';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-ms, -ms);
  ctx.lineTo(ms, ms);
  ctx.moveTo(ms, -ms);
  ctx.lineTo(-ms, ms);
  ctx.stroke();

  ctx.restore();
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

export function drawFloatingText(ft: FloatingText) {
  const alpha = Math.max(0, 1 - ft.age / ft.maxAge);
  const scale = 1 + ft.age * 0.3;

  ctx.save();
  // Flip so text reads correctly
  ctx.translate(canvasWidth, 0);
  ctx.scale(-1, 1);

  const screenX = canvasWidth - ft.x; // mirror x
  ctx.globalAlpha = alpha;
  ctx.font = `bold ${s(28 * scale)}px Segoe UI, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = s(3);
  ctx.strokeText(ft.text, screenX, ft.y);
  ctx.fillStyle = ft.color;
  ctx.fillText(ft.text, screenX, ft.y);

  ctx.restore();
}

// --- Batch draw helpers ---

export function drawAllEntities() {
  for (const f of entities.fruits) drawFruit(f);
  for (const b of entities.bombs) drawBomb(b);
  for (const h of entities.fruitHalves) drawHalf(h);
  for (const p of entities.particles) drawParticle(p);
  for (const e of entities.explosions) drawExplosion(e);
  for (const ft of entities.floatingTexts) drawFloatingText(ft);
}

export function drawEffectsOnly() {
  for (const h of entities.fruitHalves) drawHalf(h);
  for (const p of entities.particles) drawParticle(p);
  for (const e of entities.explosions) drawExplosion(e);
  for (const ft of entities.floatingTexts) drawFloatingText(ft);
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
    ctx.fillText('FRUIT NINJA', canvasWidth / 2, canvasHeight * 0.18);

    // High score
    const hs = getHighScore();
    if (hs > 0) {
      ctx.font = `${s(22)}px Segoe UI, Arial, sans-serif`;
      ctx.fillStyle = 'rgba(255, 215, 0, 0.8)';
      ctx.fillText(`High Score: ${hs}`, canvasWidth / 2, canvasHeight * 0.27);
    }

    ctx.font = `${s(28)}px Segoe UI, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('Pinch to select game duration', canvasWidth / 2, canvasHeight * 0.38);

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

    // Two-hand toggle
    const toggleY = canvasHeight * 0.72;
    ctx.font = `${s(24)}px Segoe UI, Arial, sans-serif`;
    ctx.fillStyle = game.twoHands ? 'rgba(0, 255, 100, 0.9)' : 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(
      game.twoHands ? '\u2714 Two-Hand Mode (pinch to toggle)' : 'One-Hand Mode (pinch to toggle)',
      canvasWidth / 2,
      toggleY,
    );

    ctx.font = `${s(18)}px Segoe UI, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('Pick trail color by pinching on the color boxes (top right)', canvasWidth / 2, canvasHeight * 0.85);
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
    ctx.fillText(title, canvasWidth / 2, canvasHeight / 2 - s(50));

    ctx.font = `${s(40)}px Segoe UI, Arial, sans-serif`;
    ctx.fillText(`Final Score: ${game.score}`, canvasWidth / 2, canvasHeight / 2 + s(20));

    const hs = getHighScore();
    if (game.score >= hs && game.score > 0) {
      ctx.fillStyle = '#ffd700';
      ctx.font = `bold ${s(28)}px Segoe UI, Arial, sans-serif`;
      ctx.fillText('NEW HIGH SCORE!', canvasWidth / 2, canvasHeight / 2 + s(65));
    }

    ctx.font = `${s(24)}px Segoe UI, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText('Press SPACE to continue', canvasWidth / 2, canvasHeight / 2 + s(110));
  });
}

export function clearCanvas() {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);
}