import confetti from 'canvas-confetti';

export function fireEagleConfetti() {
  confetti({ particleCount: 200, spread: 90, origin: { y: 0.6 }, colors: ['#39FF14', '#ffffff', '#ffd700'] });
  setTimeout(() => confetti({ particleCount: 100, spread: 60, origin: { y: 0.4 }, colors: ['#39FF14', '#00ffff'] }), 300);
}

export function fireBirdieConfetti() {
  confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#39FF14', '#ffffff'] });
}