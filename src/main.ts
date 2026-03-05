import { initAudio, playWin } from './audio.ts';
import { MAX_LIVES, initScale } from './constants.ts';
import { checkColorBoxes, checkDurationBoxes, checkSlashing, getSpawnInterval, spawnWave, updateAllEntities, updateEffectsOnly } from './entities.ts';
import { createHandLandmarker, detectHand, getFingertipPos, isPinching, startWebcam, updateVelocity } from './hand.ts';
import {
  clearCanvas,
  drawAllEntities,
  drawColorBoxes,
  drawEffectsOnly,
  drawEndScreen,
  drawFingertip,
  drawFrozenEntities,
  drawHandSkeleton,
  drawMenu, drawPauseOverlay,
  drawTrail,
  initRenderer,
} from './renderer.ts';
import { addTrailPoint, clearAll, game, hand, initColorBoxes, initDurationBoxes } from './state.ts';
import './style.css';

// --- DOM elements ---
const video = document.getElementById('webcam') as HTMLVideoElement;
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const scoreEl = document.getElementById('score')!;
const velocityEl = document.getElementById('velocity')!;
const livesEl = document.getElementById('lives')!;
const timerEl = document.getElementById('timer')!;
const hintEl = document.getElementById('hint')!;
const hudEl = document.getElementById('hud')!;

// --- Lives HUD ---
function initLivesHUD() {
  livesEl.innerHTML = '';
  for (let i = 0; i < MAX_LIVES; i++) {
    const span = document.createElement('span');
    span.className = 'heart';
    span.textContent = '\u2764';
    livesEl.appendChild(span);
  }
}

function syncLivesHUD() {
  const hearts = livesEl.querySelectorAll('.heart');
  hearts.forEach((h, i) => h.classList.toggle('lost', i >= game.lives));
}

function showHUD() {
  hudEl.classList.add('visible');
  timerEl.classList.add('visible');
  hintEl.classList.add('visible');
}

function hideHUD() {
  hudEl.classList.remove('visible');
  timerEl.classList.remove('visible');
  hintEl.classList.remove('visible');
}

// --- Game lifecycle ---
function startGame() {
  game.state = 'playing';
  game.score = 0;
  game.lives = MAX_LIVES;
  game.gameStartTime = performance.now();
  game.lastSpawnTime = performance.now();
  game.timeRemaining = game.gameDuration;

  scoreEl.textContent = `Score: ${game.score}`;
  initLivesHUD();
  syncLivesHUD();
  clearAll();

  showHUD();
  hintEl.textContent = 'SPACE to pause | R to restart';
}

function goToMenu() {
  game.state = 'menu';
  hideHUD();
  clearAll();
}

// --- Fingertip handling for a given state ---
function handleFingertip(now: number, canSlash: boolean) {
  const pos = getFingertipPos(canvas.width, canvas.height);
  if (!pos) {
    hand.prevTip = null;
    hand.velocity = 0;
    return;
  }

  updateVelocity(pos.x, pos.y, now);
  addTrailPoint(pos.x, pos.y, now);

  const pinching = isPinching(canvas.width, canvas.height);
  checkColorBoxes(pos.x, pos.y, pinching);

  if (canSlash && !pinching) {
    checkSlashing(pos.x, pos.y);
  }

  drawFingertip(pos.x, pos.y);
}

// --- Main ---
async function main() {
  await startWebcam(video);
  
  // Always render at 1280x720 minimum for crisp text/UI,
  // regardless of webcam resolution. MediaPipe's normalized [0,1]
  // coords map correctly since both video and canvas fill the same container.
  const RENDER_WIDTH = 1280;
  const RENDER_HEIGHT = 720;
  canvas.width = RENDER_WIDTH;
  canvas.height = RENDER_HEIGHT;

  initScale(canvas.height);
  initRenderer(canvas);
  initAudio();
  initLivesHUD();
  initColorBoxes();
  initDurationBoxes(canvas.width, canvas.height);

  let pauseTime = 0;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      if (game.state === 'playing') {
        game.state = 'paused';
        pauseTime = performance.now();
        hintEl.textContent = 'SPACE to resume | R to restart';
      } else if (game.state === 'paused') {
        game.state = 'playing';
        game.gameStartTime += performance.now() - pauseTime;
        game.lastSpawnTime = performance.now();
        hintEl.textContent = 'SPACE to pause | R to restart';
      } else if (game.state === 'gameover' || game.state === 'win') {
        goToMenu();
      }
    } else if (e.code === 'KeyR') {
      if (game.state === 'playing' || game.state === 'paused' || game.state === 'gameover' || game.state === 'win') {
        goToMenu();
      }
    }
  });

  const handLandmarker = await createHandLandmarker();
  let lastVideoTime = -1;
  let lastFrameTime = performance.now();
  let prevLives = game.lives;

  function loop() {
    const now = performance.now();
    const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;

    clearCanvas();

    // Hand detection (runs every new video frame, persists across render frames)
    lastVideoTime = detectHand(handLandmarker, video, now, lastVideoTime);

    // Hand skeleton (always visible)
    if (hand.visible && hand.landmarks) {
      drawHandSkeleton(hand.landmarks);
    }

    // --- State machine ---
    switch (game.state) {
      case 'menu': {
        drawColorBoxes();
        drawMenu();

        if (hand.visible && hand.landmarks) {
          const pos = getFingertipPos(canvas.width, canvas.height);
          if (pos) {
            const pinching = isPinching(canvas.width, canvas.height);
            checkColorBoxes(pos.x, pos.y, pinching);
            if (checkDurationBoxes(pos.x, pos.y, pinching)) {
              startGame();
            }
            drawFingertip(pos.x, pos.y);
          }
        }
        break;
      }

      case 'playing': {
        // Timer
        const elapsed = (now - game.gameStartTime) / 1000;
        game.timeRemaining = Math.max(0, game.gameDuration - elapsed);
        const mins = Math.floor(game.timeRemaining / 60);
        const secs = Math.floor(game.timeRemaining % 60);
        timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

        if (game.timeRemaining <= 0) {
          game.state = 'win';
          hideHUD();
          playWin();
          break;
        }

        // Spawn (interval scales with difficulty)
        if (now - game.lastSpawnTime > getSpawnInterval()) {
          spawnWave(canvas.width, canvas.height);
          game.lastSpawnTime = now;
        }

        // Fingertip + slashing
        handleFingertip(now, true);

        // Update + draw
        updateAllEntities(dt, canvas.height);
        drawAllEntities();
        drawTrail();
        drawColorBoxes();

        // Sync HUD
        scoreEl.textContent = `Score: ${game.score}`;
        velocityEl.textContent = `Velocity: ${Math.round(hand.velocity)} px/s`;

        // Check if lives changed (bomb hit may trigger gameover)
        if (game.lives !== prevLives) {
          syncLivesHUD();
          prevLives = game.lives;
        }
        if ((game.state as string) === 'gameover') {
          hideHUD();
        }
        break;
      }

      case 'paused': {
        drawFrozenEntities();
        drawColorBoxes();
        drawPauseOverlay();

        // Allow color changing while paused
        if (hand.visible && hand.landmarks) {
          const pos = getFingertipPos(canvas.width, canvas.height);
          if (pos) {
            const pinching = isPinching(canvas.width, canvas.height);
            checkColorBoxes(pos.x, pos.y, pinching);
            drawFingertip(pos.x, pos.y);
          }
        }
        break;
      }

      case 'gameover': {
        updateEffectsOnly(dt, canvas.height);
        drawEffectsOnly();
        drawEndScreen('GAME OVER');
        break;
      }

      case 'win': {
        updateEffectsOnly(dt, canvas.height);
        drawEffectsOnly();
        drawEndScreen('YOU WIN!');
        break;
      }
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

main().catch(console.error);