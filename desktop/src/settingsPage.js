const MODES = [
  { id: 'Chill', hint: 'gentle' },
  { id: 'Firm', hint: 'regular' },
  { id: 'Brutal', hint: 'no mercy' },
];

const $ = id => document.getElementById(id);
let state = null;

function chip(label, on, onClick) {
  const el = document.createElement('button');
  el.className = `chip${on ? ' on' : ''}`;
  el.textContent = label;
  el.addEventListener('click', onClick);
  return el;
}

function render(presets) {
  const modes = $('modes');
  modes.replaceChildren(...MODES.map(m => chip(`${m.id} · ${m.hint}`, state.mode === m.id, () => {
    state.mode = m.id;
    render(presets);
  })));
  const list = $('presets');
  list.replaceChildren(...presets.map(p => chip(p.label, state.presets.includes(p.id), () => {
    state.presets = state.presets.includes(p.id) ? state.presets.filter(x => x !== p.id) : [...state.presets, p.id];
    render(presets);
  })));
}

const lines = text => text.split('\n').map(s => s.trim()).filter(Boolean);

window.kip.getSettings().then(({ settings, presets }) => {
  state = { ...settings };
  $('name').value = state.name;
  $('sites').value = state.customSites.join('\n');
  $('apps').value = state.customApps.join('\n');
  $('countdown').value = state.countdownSeconds;
  $('cooldown').value = state.cooldownMinutes;
  $('sound').checked = state.alarmSound;
  $('startup').checked = state.startWithWindows;
  render(presets);

  $('save').addEventListener('click', async () => {
    state.name = $('name').value.trim();
    state.customSites = lines($('sites').value);
    state.customApps = lines($('apps').value);
    state.countdownSeconds = Math.min(1800, Math.max(10, Number($('countdown').value) || 60));
    state.cooldownMinutes = Math.min(120, Math.max(0, Number($('cooldown').value) || 0));
    state.alarmSound = $('sound').checked;
    state.startWithWindows = $('startup').checked;
    state = await window.kip.saveSettings(state);
    $('saved').textContent = 'Saved. Kip is on it.';
    setTimeout(() => ($('saved').textContent = ''), 2500);
  });
});
