import confetti from 'canvas-confetti';

// canvas-confetti's default export lazily appends its OWN full-screen canvas to
// <body> and only removes it once every particle has settled. On mobile, rapid
// bursts or navigating away mid-animation can leave that canvas orphaned — it
// keeps a fixed, max-z-index element over the whole screen that swallows taps.
//
// To stay in control of that lifecycle we render through a single canvas we own.
// It is permanently `pointer-events: none`, so even if particles are mid-flight
// it can never block touches, and we expose resetConfetti() so the app can clear
// it on route changes.

let instance: confetti.CreateTypes | null = null;

function getConfetti(): confetti.CreateTypes | null {
  if (typeof document === 'undefined') return null;
  if (instance) return instance;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '2147483647';
  document.body.appendChild(canvas);

  instance = confetti.create(canvas, { resize: true, useWorker: true });
  return instance;
}

export function fireEagleConfetti() {
  const fire = getConfetti();
  if (!fire) return;
  fire({ particleCount: 200, spread: 90, origin: { y: 0.6 }, colors: ['#39FF14', '#ffffff', '#ffd700'] });
  setTimeout(() => {
    const again = getConfetti();
    again?.({ particleCount: 100, spread: 60, origin: { y: 0.4 }, colors: ['#39FF14', '#00ffff'] });
  }, 300);
}

export function fireBirdieConfetti() {
  const fire = getConfetti();
  if (!fire) return;
  fire({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#39FF14', '#ffffff'] });
}

// Immediately stop any in-flight animation and clear the canvas. Safe to call
// even if confetti was never fired (no-op until the instance exists).
export function resetConfetti() {
  instance?.reset();
}
