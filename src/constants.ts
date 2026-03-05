export const INDEX_FINGERTIP = 8;
export const THUMB_TIP = 4;
export const MAX_LIVES = 3;
export const TRAIL_MAX_LEN = 20;
export const TRAIL_FADE_MS = 300;

// Reference resolution — all pixel values are authored for this height
const REF_HEIGHT = 720;

// Scale factor: set once at init, used by s() to scale pixel values
let _scale = 1;
export function initScale(canvasHeight: number) { _scale = canvasHeight / REF_HEIGHT; }
export function s(px: number): number { return px * _scale; }

// These are reference values (at 720p) — always use s() when consuming them
export const GRAVITY = 1800;
export const MIN_SLASH_VELOCITY = 400;
export const BOMB_RADIUS = 42;
export const PINCH_DISTANCE = 40;

// Combo
export const COMBO_WINDOW_MS = 800; // max ms between slices to keep combo
export const COMBO_MIN = 3;         // minimum streak to show combo text

// Special fruit chances
export const GOLDEN_CHANCE = 0.08;  // 8% of fruits are golden
export const FREEZE_CHANCE = 0.05;  // 5% of fruits are freeze
export const GOLDEN_POINTS = 5;
export const FREEZE_DURATION = 2000; // ms

// Screen shake
export const SHAKE_INTENSITY = 12;  // max px offset
export const SHAKE_DURATION = 300;  // ms

export const FRUIT_COLORS = [
  '#e74c3c', '#f39c12', '#2ecc71',
  '#9b59b6', '#e67e22', '#f1c40f',
];

export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],         // thumb
  [0, 5], [5, 6], [6, 7], [7, 8],         // index
  [5, 9], [9, 10], [10, 11], [11, 12],    // middle
  [9, 13], [13, 14], [14, 15], [15, 16],  // ring
  [13, 17], [17, 18], [18, 19], [19, 20], // pinky
  [0, 17],                                  // palm base
];

export const COLOR_OPTIONS = [
  { color: '#00ff64', fillRgba: 'rgba(0, 255, 100, 0.35)', borderColor: 'rgba(0, 255, 100, 0.8)' },
  { color: '#9b59b6', fillRgba: 'rgba(155, 89, 182, 0.35)', borderColor: 'rgba(155, 89, 182, 0.8)' },
  { color: '#e74c3c', fillRgba: 'rgba(231, 76, 60, 0.35)', borderColor: 'rgba(231, 76, 60, 0.8)' },
  { color: '#3498db', fillRgba: 'rgba(52, 152, 219, 0.35)', borderColor: 'rgba(52, 152, 219, 0.8)' },
];

export const DURATION_OPTIONS = [
  { label: '30s', seconds: 30 },
  { label: '1m', seconds: 60 },
  { label: '2m', seconds: 120 },
];