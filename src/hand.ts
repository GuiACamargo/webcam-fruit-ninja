import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { INDEX_FINGERTIP, PINCH_DISTANCE, s, THUMB_TIP } from './constants.ts';
import { hand } from './state.ts';

export async function createHandLandmarker(numHands: number): Promise<HandLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
  );
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands,
  });
}

export async function startWebcam(video: HTMLVideoElement): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 1280, height: 720, facingMode: 'user' },
  });
  video.srcObject = stream;
  await new Promise<void>((resolve) => {
    video.onloadedmetadata = () => resolve();
  });
  video.play();
}

export function detectHand(
  handLandmarker: HandLandmarker,
  video: HTMLVideoElement,
  now: number,
  lastVideoTime: number,
): number {
  if (video.currentTime === lastVideoTime) return lastVideoTime;

  const results = handLandmarker.detectForVideo(video, now);
  if (results.landmarks && results.landmarks.length > 0) {
    hand.landmarks = results.landmarks[0];
    hand.visible = true;
  } else {
    hand.landmarks = null;
    hand.visible = false;
  }

  if (results.landmarks && results.landmarks.length > 1) {
    hand.secondLandmarks = results.landmarks[1];
    hand.secondVisible = true;
  } else {
    hand.secondLandmarks = null;
    hand.secondVisible = false;
  }

  return video.currentTime;
}

export function isPinching(cw: number, ch: number): boolean {
  if (!hand.landmarks) return false;
  const dx = hand.landmarks[THUMB_TIP].x * cw - hand.landmarks[INDEX_FINGERTIP].x * cw;
  const dy = hand.landmarks[THUMB_TIP].y * ch - hand.landmarks[INDEX_FINGERTIP].y * ch;
  return Math.sqrt(dx * dx + dy * dy) < s(PINCH_DISTANCE);
}

export function isSecondPinching(cw: number, ch: number): boolean {
  if (!hand.secondLandmarks) return false;
  const dx = hand.secondLandmarks[THUMB_TIP].x * cw - hand.secondLandmarks[INDEX_FINGERTIP].x * cw;
  const dy = hand.secondLandmarks[THUMB_TIP].y * ch - hand.secondLandmarks[INDEX_FINGERTIP].y * ch;
  return Math.sqrt(dx * dx + dy * dy) < s(PINCH_DISTANCE);
}

export function getFingertipPos(cw: number, ch: number): { x: number; y: number } | null {
  if (!hand.landmarks) return null;
  return {
    x: hand.landmarks[INDEX_FINGERTIP].x * cw,
    y: hand.landmarks[INDEX_FINGERTIP].y * ch,
  };
}

export function getSecondFingertipPos(cw: number, ch: number): { x: number; y: number } | null {
  if (!hand.secondLandmarks) return null;
  return {
    x: hand.secondLandmarks[INDEX_FINGERTIP].x * cw,
    y: hand.secondLandmarks[INDEX_FINGERTIP].y * ch,
  };
}

export function updateVelocity(x: number, y: number, t: number) {
  if (hand.prevTip) {
    const dx = x - hand.prevTip.x;
    const dy = y - hand.prevTip.y;
    const dt = (t - hand.prevTip.t) / 1000;
    if (dt > 0) {
      const raw = Math.sqrt(dx * dx + dy * dy) / dt;
      hand.velocity = hand.velocity * 0.3 + raw * 0.7;
    }
  }
  hand.prevTip = { x, y, t };
}

export function updateSecondVelocity(x: number, y: number, t: number) {
  if (hand.secondPrevTip) {
    const dx = x - hand.secondPrevTip.x;
    const dy = y - hand.secondPrevTip.y;
    const dt = (t - hand.secondPrevTip.t) / 1000;
    if (dt > 0) {
      const raw = Math.sqrt(dx * dx + dy * dy) / dt;
      hand.secondVelocity = hand.secondVelocity * 0.3 + raw * 0.7;
    }
  }
  hand.secondPrevTip = { x, y, t };
}