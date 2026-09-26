// Kip on the desktop. Main process sends a status every second; this file turns it into movement.
const SIZE = 110;
const WALK_SPEED = 90; // px/s while wandering
const RUSH_SPEED = 420; // px/s when heading for a distracting window
const ALARM_SCALE = { Chill: 1.5, Firm: 1.9, Brutal: 2.5 };

const kipEl = document.getElementById('kip');
const imgEl = document.getElementById('kipImg');
const bubble = document.getElementById('bubble');

let ground = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
let status = { phase: 'idle', mode: 'Firm', sound: true };
const frog = { x: 200, y: 0, scale: 1, tx: 200, ty: 0, restUntil: 0 };
let bubbleUntil = 0;
let nextQuipAt = Date.now() + 90_000;

const floorY = () => ground.y + ground.height - SIZE;

function say(text, kind = '', ms = 4500) {
  if (!text) return;
  bubble.textContent = text;
  bubble.className = `show ${kind}`;
  bubbleUntil = ms === Infinity ? Infinity : Date.now() + ms;
}

// ---- alarm sound (Web Audio, no files) ----
let audio = null;
let beepTimer = null;
function startBeeping() {
  if (beepTimer || !status.sound) return;
  audio = audio || new AudioContext();
  const beep = () => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.18, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.3);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.3);
  };
  beep();
  beepTimer = setInterval(beep, 650);
}
function stopBeeping() {
  clearInterval(beepTimer);
  beepTimer = null;
}

// ---- status from main ----
window.kip.onInit(({ ground: g, kipUrl }) => {
  ground = g;
  imgEl.src = kipUrl;
  frog.x = frog.tx = g.x + g.width * 0.75;
  frog.y = frog.ty = floorY();
  kipEl.classList.remove('hidden');
  say('Hi. I’ll be down here. Watching.', '', 5000);
});

window.kip.onStatus(next => {
  const prev = status.phase;
  status = next;

  if (next.phase === 'alarm') {
    const t = next.target;
    frog.tx = t.x + t.width / 2 - SIZE / 2;
    frog.ty = Math.min(floorY(), t.y + t.height / 2 - SIZE / 2);
    frog.scale = ALARM_SCALE[next.mode] || 1.9;
    if (prev !== 'alarm') say(next.text, 'alarm', Infinity);
    startBeeping();
  } else {
    stopBeeping();
    frog.scale = 1;
  }

  if (next.phase === 'countdown') {
    const t = next.target;
    // Stand on the bottom edge of the distracting window (or the floor if it's lower).
    frog.tx = t.x + t.width / 2 - SIZE / 2;
    frog.ty = Math.min(floorY(), t.y + t.height - SIZE);
    say(next.text, '', Infinity);
  }

  if (next.phase === 'idle') {
    if (prev === 'countdown' || prev === 'alarm') {
      frog.ty = floorY();
      frog.restUntil = Date.now() + 2500;
      if (next.text) say(next.text, '', 3500);
      else bubbleUntil = 0;
    }
  }

  if (next.phase === 'paused') {
    frog.tx = ground.x + ground.width - SIZE - 24;
    frog.ty = floorY();
    if (prev !== 'paused') say(next.text, 'sleep', Infinity);
  } else if (prev === 'paused') {
    bubbleUntil = 0;
  }

  kipEl.classList.toggle('hidden', next.phase === 'hidden');
});

// ---- hover / poke: only Kip himself catches the mouse ----
imgEl.addEventListener('mouseenter', () => window.kip.setHover(true));
imgEl.addEventListener('mouseleave', () => window.kip.setHover(false));
imgEl.addEventListener('dblclick', () => window.kip.openSettings());
imgEl.addEventListener('click', async () => {
  if (status.phase === 'idle') say(await window.kip.line('poke'), '', 3000);
});

// ---- movement loop ----
let last = performance.now();
function frame(nowPerf) {
  const dt = Math.min(0.05, (nowPerf - last) / 1000);
  last = nowPerf;
  const now = Date.now();

  if (status.phase === 'idle' && now > frog.restUntil && Math.abs(frog.tx - frog.x) < 2 && Math.abs(frog.ty - frog.y) < 2) {
    // Pick a new spot on the floor, then rest there a bit.
    frog.tx = ground.x + Math.random() * Math.max(1, ground.width - SIZE);
    frog.ty = floorY();
    frog.restUntil = now + 2000 + Math.random() * 5000;
  }
  if (status.phase === 'idle' && now > nextQuipAt && bubbleUntil < now) {
    // Now and then Kip mutters something while wandering.
    nextQuipAt = now + 180_000 + Math.random() * 180_000;
    window.kip.line('wander').then(text => say(text, '', 4000));
  }

  const speed = status.phase === 'idle' ? WALK_SPEED : RUSH_SPEED;
  const dx = frog.tx - frog.x;
  const dy = frog.ty - frog.y;
  const dist = Math.hypot(dx, dy);
  const moving = dist > 2;
  if (moving) {
    const step = Math.min(dist, speed * dt);
    frog.x += (dx / dist) * step;
    frog.y += (dy / dist) * step;
  }

  kipEl.classList.toggle('walk', moving && status.phase !== 'paused');
  kipEl.classList.toggle('tap', !moving && status.phase === 'countdown');
  kipEl.classList.toggle('angry', status.phase === 'alarm');
  kipEl.classList.toggle('sleep', status.phase === 'paused');
  kipEl.style.transform = `translate(${frog.x}px, ${frog.y}px) scale(${frog.scale})`;

  // Bubble sits above Kip (below him if he's near the top of the screen).
  if (bubbleUntil !== Infinity && now > bubbleUntil) bubble.classList.remove('show');
  const bw = bubble.offsetWidth;
  const bh = bubble.offsetHeight;
  const headY = frog.y + SIZE - SIZE * frog.scale;
  let bx = frog.x + SIZE / 2 - bw / 2;
  let by = headY - bh - 10;
  if (by < 8) by = frog.y + SIZE + 10;
  bx = Math.max(8, Math.min(window.innerWidth - bw - 8, bx));
  bubble.style.left = `${bx}px`;
  bubble.style.top = `${by}px`;

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
