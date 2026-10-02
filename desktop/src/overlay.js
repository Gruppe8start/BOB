// Kip on the desktop. There is one overlay per monitor; Kip is only "here" on one of them at a time.
// Main process sends a status every second; this file turns it into movement.
const SIZE = 130;
const WALK_SPEED = 90; // px/s while wandering
const RUSH_SPEED = 420; // px/s when heading for a distracting window
const ALARM_SCALE = { Chill: 1.5, Firm: 1.9, Brutal: 2.5 };
const WANDER_AWAY_CHANCE = 0.12; // chance a new wander target is the next monitor over

const kipEl = document.getElementById('kip');
const spriteEl = document.getElementById('sprite');
const bubble = document.getElementById('bubble');

let ground = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
let neighbors = { left: false, right: false };
let here = false;
let status = { phase: 'idle', mode: 'Firm', sound: true };
const frog = { x: 200, y: 0, scale: 1, facing: 1, tx: 200, ty: 0, restUntil: 0, leaving: null };
let bubbleUntil = 0;
let nextQuipAt = Date.now() + 90_000;

const floorY = () => ground.y + ground.height - SIZE;

function say(text, kind = '', ms = 4500) {
  if (!text) return;
  bubble.textContent = text;
  bubble.className = `show ${kind}`;
  bubbleUntil = ms === Infinity ? Infinity : Date.now() + ms;
}

// ---- sprite sheet (assets/kip-sprites.png, see scripts/make-sprites.js) ----
let sheet = null;
const anim = { name: 'idle', time: 0 };

function useSheet(url, meta) {
  sheet = meta;
  spriteEl.style.backgroundImage = `url("${url}")`;
  spriteEl.style.backgroundSize = `${meta.columns * SIZE}px ${meta.rows * SIZE}px`;
}

/** Advances the current animation; `rate` speeds it up (e.g. running). */
function animate(name, dt, rate = 1) {
  if (!sheet) return;
  if (anim.name !== name) {
    anim.name = name;
    anim.time = 0;
  }
  anim.time += dt * rate;
  const a = sheet.animations[name];
  const index = Math.floor(anim.time * a.fps) % a.frames;
  spriteEl.style.backgroundPosition = `${-index * SIZE}px ${-a.row * SIZE}px`;
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

// ---- arriving on / leaving this monitor ----
function arrive(from) {
  here = true;
  frog.leaving = null;
  frog.scale = 1;
  frog.ty = floorY();
  if (from === 'left' || from === 'right') {
    // Walk in from the edge that faces the monitor he came from.
    frog.x = from === 'left' ? ground.x - SIZE : ground.x + ground.width;
    frog.y = floorY();
    frog.tx = from === 'left' ? ground.x + 120 : ground.x + ground.width - SIZE - 120;
  } else {
    // No monitor side by side (stacked, or first start): drop in from above.
    frog.x = frog.tx = from === 'start' ? ground.x + ground.width * 0.75 : ground.x + Math.random() * (ground.width - SIZE);
    frog.y = from === 'start' ? floorY() : ground.y - SIZE;
  }
  frog.restUntil = Date.now() + 1500;
  kipEl.classList.remove('hidden');
}

function depart() {
  here = false;
  frog.leaving = null;
  stopBeeping();
  bubbleUntil = 0;
  bubble.classList.remove('show');
  kipEl.classList.add('hidden');
  window.kip.setHover(false);
}

// ---- messages from main ----
window.kip.onInit(({ ground: g, neighbors: n, sheetUrl, sheetMeta, here: isHere, greet }) => {
  ground = g;
  neighbors = n;
  useSheet(sheetUrl, sheetMeta);
  if (isHere) {
    arrive('start');
    if (greet) say('Hi. I’ll be down here. Watching.', '', 5000);
  }
});

window.kip.onEnter(({ from }) => arrive(from));
window.kip.onLeave(() => depart());

window.kip.onStatus(next => {
  if (!here) return;
  const prev = status.phase;
  status = next;
  if (next.phase !== 'idle') frog.leaving = null; // something came up: stay on this monitor

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
spriteEl.addEventListener('mouseenter', () => window.kip.setHover(true));
spriteEl.addEventListener('mouseleave', () => window.kip.setHover(false));
spriteEl.addEventListener('dblclick', () => window.kip.openSettings());
spriteEl.addEventListener('click', async () => {
  if (status.phase === 'idle') say(await window.kip.line('poke'), '', 3000);
});

// ---- movement loop ----
let last = performance.now();
function frame(nowPerf) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (nowPerf - last) / 1000);
  last = nowPerf;
  if (!here) return;
  const now = Date.now();
  const arrived = Math.abs(frog.tx - frog.x) < 2 && Math.abs(frog.ty - frog.y) < 2;

  if (frog.leaving && arrived) {
    // Walked off the edge: main hands Kip to the monitor on that side.
    const side = frog.leaving;
    depart();
    window.kip.exit(side);
    return;
  }
  if (status.phase === 'idle' && now > frog.restUntil && arrived) {
    // Pick a new spot on the floor (sometimes on the next monitor), then rest there a bit.
    const sides = ['left', 'right'].filter(s => neighbors[s]);
    if (sides.length && Math.random() < WANDER_AWAY_CHANCE) {
      frog.leaving = sides[Math.floor(Math.random() * sides.length)];
      frog.tx = frog.leaving === 'left' ? ground.x - SIZE - 4 : ground.x + ground.width + 4;
    } else {
      frog.tx = ground.x + Math.random() * Math.max(1, ground.width - SIZE);
    }
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
    if (Math.abs(dx) > 1) frog.facing = dx < 0 ? -1 : 1;
  }

  const walking = moving && status.phase !== 'paused';
  animate(walking ? 'walk' : 'idle', dt, walking ? Math.min(2.5, speed / WALK_SPEED) : 1);
  kipEl.classList.toggle('tap', !moving && status.phase === 'countdown');
  kipEl.classList.toggle('angry', status.phase === 'alarm');
  kipEl.classList.toggle('sleep', status.phase === 'paused');
  // The sheet faces right; mirror him when he walks left.
  kipEl.style.transform = `translate(${frog.x}px, ${frog.y}px) scale(${frog.scale * frog.facing}, ${frog.scale})`;

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
}
requestAnimationFrame(frame);
