// Offscreen document: the only place an MV3 extension can play sound without a page.
let ctx = null;
let timer = null;

function beep() {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.25, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.35);
}

chrome.runtime.onMessage.addListener(message => {
  if (message.target !== 'offscreen') return;
  if (message.type === 'ring' && !timer) {
    ctx = ctx ?? new AudioContext();
    beep();
    timer = setInterval(beep, 600);
  }
  if (message.type === 'stop') {
    clearInterval(timer);
    timer = null;
  }
});
