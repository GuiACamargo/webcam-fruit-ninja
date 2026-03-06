import { initAudio, playWin } from './audio.ts';
import { MAX_LIVES, initScale } from './constants.ts';
import { checkColorBoxes, checkDurationBoxes, checkSlashing, getSpawnInterval, spawnWave, updateAllEntities, updateEffectsOnly } from './entities.ts';
import {
  createHandLandmarker,
  detectHand,
  getFingertipPos, getSecondFingertipPos,
  isPinching, isSecondPinching,
  startWebcam,
  updateSecondVelocity,
  updateVelocity,
} from './hand.ts';
import {
  applyShake,
  clearCanvas,
  drawAllEntities,
  drawColorBoxes,
  drawEffectsOnly,
  drawEndScreen,
  drawFingertip,
  drawFreezeOverlay,
  drawFrozenEntities,
  drawHandSkeleton,
  drawMenu, drawPauseOverlay,
  drawSecondTrail,
  drawTrail,
  initRenderer,
  resetShake,
} from './renderer.ts';
import { addSecondTrailPoint, addTrailPoint, clearAll, game, hand, initColorBoxes, initDurationBoxes, saveHighScore } from './state.ts';
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

// --- Two-hand toggle box (in canvas coords) ---
const TOGGLE_BOX = { y: 0.68, h: 0.08 }; // relative to canvas height

function isInToggleArea(x: number, y: number): boolean {
  const top = canvas.height * TOGGLE_BOX.y;
  const bot = canvas.height * (TOGGLE_BOX.y + TOGGLE_BOX.h);
  const left = canvas.width * 0.2;
  const right = canvas.width * 0.8;
  return x >= left && x <= right && y >= top && y <= bot;
}

// --- Game lifecycle ---
let handLandmarker: Awaited<ReturnType<typeof createHandLandmarker>>;

async function initHandLandmarker() {
  handLandmarker = await createHandLandmarker(game.twoHands ? 2 : 1);
}

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
  if (game.state === 'win' || game.state === 'gameover') {
    saveHighScore(game.score);
  }
  game.state = 'menu';
  hideHUD();
  clearAll();
}

// --- Fingertip handling ---
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
    checkSlashing(pos.x, pos.y, hand.velocity);
  }

  drawFingertip(pos.x, pos.y);
}

function handleSecondFingertip(now: number, canSlash: boolean) {
  if (!game.twoHands || !hand.secondVisible) {
    hand.secondPrevTip = null;
    hand.secondVelocity = 0;
    return;
  }

  const pos = getSecondFingertipPos(canvas.width, canvas.height);
  if (!pos) {
    hand.secondPrevTip = null;
    hand.secondVelocity = 0;
    return;
  }

  updateSecondVelocity(pos.x, pos.y, now);
  addSecondTrailPoint(pos.x, pos.y, now);

  const pinching = isSecondPinching(canvas.width, canvas.height);
  if (canSlash && !pinching) {
    checkSlashing(pos.x, pos.y, hand.secondVelocity);
  }

  drawFingertip(pos.x, pos.y);
}

// --- Main ---
async function main() {
  await startWebcam(video);

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

  await initHandLandmarker();

  let pauseTime = 0;
  let pendingHandSwitch = false;
  let demoMode = false;

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyP') {
      demoMode = !demoMode;
      if (demoMode) hideHUD();
      return;
    }
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

  let lastVideoTime = -1;
  let lastFrameTime = performance.now();
  let prevLives = game.lives;

  function loop() {
    const now = performance.now();
    const dt = Math.min((now - lastFrameTime) / 1000, 0.05);
    lastFrameTime = now;

    clearCanvas();

    // Apply screen shake
    applyShake();

    // Hand detection
    lastVideoTime = detectHand(handLandmarker, video, now, lastVideoTime);

    // Hand skeletons
    if (hand.visible && hand.landmarks) drawHandSkeleton(hand.landmarks);
    if (game.twoHands && hand.secondVisible && hand.secondLandmarks) drawHandSkeleton(hand.secondLandmarks);

    // --- Demo mode: only webcam + hand tracking ---
    if (demoMode) {
      if (hand.visible && hand.landmarks) {
        const pos = getFingertipPos(canvas.width, canvas.height);
        if (pos) {
          updateVelocity(pos.x, pos.y, now);
          addTrailPoint(pos.x, pos.y, now);
          drawFingertip(pos.x, pos.y);
        }
      }
      drawTrail();
      resetShake();
      requestAnimationFrame(loop);
      return;
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

            // Two-hand toggle
            if (pinching && isInToggleArea(pos.x, pos.y) && !pendingHandSwitch) {
              pendingHandSwitch = true;
              game.twoHands = !game.twoHands;
              initHandLandmarker(); // re-init with new numHands
            }
            if (!pinching) pendingHandSwitch = false;

            if (checkDurationBoxes(pos.x, pos.y, pinching)) {
              startGame();
            }
            drawFingertip(pos.x, pos.y);
          }
        }
        break;
      }

      case 'playing': {
        const elapsed = (now - game.gameStartTime) / 1000;
        game.timeRemaining = Math.max(0, game.gameDuration - elapsed);
        const mins = Math.floor(game.timeRemaining / 60);
        const secs = Math.floor(game.timeRemaining % 60);
        timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

        if (game.timeRemaining <= 0) {
          game.state = 'win';
          saveHighScore(game.score);
          hideHUD();
          playWin();
          break;
        }

        if (now - game.lastSpawnTime > getSpawnInterval()) {
          spawnWave(canvas.width, canvas.height);
          game.lastSpawnTime = now;
        }

        handleFingertip(now, true);
        handleSecondFingertip(now, true);

        updateAllEntities(dt, canvas.height);
        drawAllEntities();
        drawTrail();
        if (game.twoHands) drawSecondTrail();
        drawFreezeOverlay();
        drawColorBoxes();

        scoreEl.textContent = `Score: ${game.score}`;
        velocityEl.textContent = `Velocity: ${Math.round(hand.velocity)} px/s`;

        if (game.lives !== prevLives) {
          syncLivesHUD();
          prevLives = game.lives;
        }
        if ((game.state as string) === 'gameover') {
          saveHighScore(game.score);
          hideHUD();
        }
        break;
      }

      case 'paused': {
        drawFrozenEntities();
        drawColorBoxes();
        drawPauseOverlay();

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

    // Reset shake transform at end of frame
    resetShake();

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

main().catch(console.error);