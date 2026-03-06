const POOL_SIZE = 6;

let slicePool: HTMLAudioElement[] = [];
let sliceIndex = 0;

let explosionPool: HTMLAudioElement[] = [];
let explosionIndex = 0;

function createPool(src: string, volume: number): HTMLAudioElement[] {
  return Array.from({ length: POOL_SIZE }, () => {
    const audio = new Audio(src);
    audio.volume = volume;
    return audio;
  });
}

let winSound: HTMLAudioElement;
let loseSound: HTMLAudioElement;

export function initAudio() {
  slicePool = createPool('/sounds/slice.mp3', 0.05);
  explosionPool = createPool('/sounds/explosion.mp3', 0.05);
  winSound = new Audio('/sounds/win.mp3');
  winSound.volume = 0.1;
  loseSound = new Audio('/sounds/lose.mp3');
  loseSound.volume = 0.1;
}

export function playSlice() {
  const audio = slicePool[sliceIndex % slicePool.length];
  audio.currentTime = 0;
  audio.play().catch(() => {});
  sliceIndex++;
}

export function playExplosion() {
  const audio = explosionPool[explosionIndex % explosionPool.length];
  audio.currentTime = 0;
  audio.play().catch(() => {});
  explosionIndex++;
}

export function playWin() {
  winSound.currentTime = 0;
  winSound.play().catch(() => {});
}

export function playLose() {
  loseSound.currentTime = 0;
  loseSound.play().catch(() => {});
}