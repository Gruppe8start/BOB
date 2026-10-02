const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, screen } = require('electron');
const { activeWindow } = require('./activeWindow');
const { PRESETS, matchWindow } = require('./rules');
const { line } = require('./lines');
const { loadSettings, saveSettings } = require('./settings');

// Kip desktop companion (Windows prototype). Separate app from the Kip phone app.
//
// Alarm rules, same as the phone:
//  - A distracting app/site comes to the front -> countdown starts.
//  - Leave before it ends -> countdown pauses (no alarm).
//  - Still there when it ends -> alarm: Kip sits on the window and yells until you leave.
//  - Cooldown: coming back within N minutes after an alarm rings again at once; after a
//    paused countdown it resumes instead of restarting.

const ASSETS = path.join(__dirname, '..', 'assets');
const TICK_MS = 1000;
const SPRITES = {
  url: pathToFileURL(path.join(ASSETS, 'kip-sprites.png')).href,
  meta: JSON.parse(fs.readFileSync(path.join(ASSETS, 'kip-sprites.json'), 'utf8')),
};

// One transparent overlay per monitor. Kip is on exactly one of them (kipDisplayId) at a time.
const overlays = new Map();
let kipDisplayId = null;
let greeted = false;
let settingsWindow = null;
let tray = null;
let settings = null;
let lastWindow = null;

const watch = {
  countdownEndsAt: null,
  pausedRemainingMs: null,
  pausedAt: 0,
  lastFiredAt: 0,
  ringing: false,
  wasBusy: false,
};

if (!app.requestSingleInstanceLock()) app.quit();
// Starting Kip while he's already running opens his settings.
app.on('second-instance', () => openSettings());

/** The monitor directly left/right of `display` (sharing some height with it), if any. */
function neighbor(display, side) {
  const b = display.bounds;
  // Mixed DPI can leave small gaps/overlaps between monitors in DIP coordinates.
  const SLACK = 16;
  const beside = screen.getAllDisplays().filter(d =>
    d.id !== display.id &&
    d.bounds.y < b.y + b.height && d.bounds.y + d.bounds.height > b.y &&
    (side === 'right' ? d.bounds.x >= b.x + b.width - SLACK : d.bounds.x + d.bounds.width <= b.x + SLACK)
  );
  const gap = d => (side === 'right' ? d.bounds.x - (b.x + b.width) : b.x - (d.bounds.x + d.bounds.width));
  return beside.sort((p, q) => gap(p) - gap(q))[0] ?? null;
}

function displayById(id) {
  return screen.getAllDisplays().find(d => d.id === id) ?? null;
}

function kipOverlay() {
  return overlays.get(kipDisplayId) ?? null;
}

function createOverlay(display) {
  const { x, y, width, height } = display.bounds;
  const overlay = new BrowserWindow({
    x, y, width, height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    fullscreenable: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  overlay.setAlwaysOnTop(true, 'screen-saver');
  // Clicks go through Kip's invisible stage to the apps below; the renderer turns this
  // off only while the mouse is over Kip himself.
  overlay.setIgnoreMouseEvents(true, { forward: true });
  overlay.loadFile(path.join(__dirname, 'overlay.html'));
  overlay.webContents.on('did-finish-load', () => {
    const wa = display.workArea;
    const here = display.id === kipDisplayId;
    overlay.webContents.send('init', {
      ground: { x: wa.x - x, y: wa.y - y, width: wa.width, height: wa.height },
      neighbors: { left: !!neighbor(display, 'left'), right: !!neighbor(display, 'right') },
      sheetUrl: SPRITES.url,
      sheetMeta: SPRITES.meta,
      here,
      greet: here && !greeted,
      settings,
    });
    if (here) greeted = true;
  });
  overlay.webContents.on('console-message', event => {
    if (event.level === 'warning' || event.level === 'error') console.log('[overlay]', event.message);
  });
  return overlay;
}

/** (Re)creates one overlay per monitor. Kip stays on his monitor if it's still connected. */
function createOverlays() {
  for (const win of overlays.values()) if (!win.isDestroyed()) win.destroy();
  overlays.clear();
  const displays = screen.getAllDisplays();
  if (!displays.some(d => d.id === kipDisplayId)) kipDisplayId = screen.getPrimaryDisplay().id;
  for (const display of displays) overlays.set(display.id, createOverlay(display));
}

let rebuildTimer = null;
function rebuildOverlaysSoon() {
  // Plugging in a monitor fires several events in a row; rebuild once they settle.
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(createOverlays, 800);
}

/** Moves Kip to another monitor. He walks in from the side facing the one he left. */
function moveKipTo(displayId) {
  if (displayId === kipDisplayId || !overlays.has(displayId)) return;
  const from = displayById(kipDisplayId);
  const to = displayById(displayId);
  const old = kipOverlay();
  if (old && !old.isDestroyed()) {
    old.webContents.send('leave');
    old.setIgnoreMouseEvents(true, { forward: true });
  }
  kipDisplayId = displayId;
  let side = 'top';
  if (from && to) {
    if (to.bounds.x >= from.bounds.x + from.bounds.width - 16) side = 'left';
    else if (to.bounds.x + to.bounds.width <= from.bounds.x + 16) side = 'right';
  }
  kipOverlay().webContents.send('enter', { from: side });
}

/** Windows won't let a background app take focus; pinning on top for a moment brings it forward. */
function bringToFront(win) {
  if (win.isMinimized()) win.restore();
  win.show();
  win.setAlwaysOnTop(true);
  win.focus();
  setTimeout(() => !win.isDestroyed() && win.setAlwaysOnTop(false), 400);
}

function openSettings() {
  if (settingsWindow) {
    bringToFront(settingsWindow);
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 480,
    height: 720,
    title: 'Kip settings',
    icon: path.join(ASSETS, 'icon256.png'),
    autoHideMenuBar: true,
    backgroundColor: '#0d0d0d',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  settingsWindow.loadFile(path.join(__dirname, 'settings.html'));
  settingsWindow.once('ready-to-show', () => bringToFront(settingsWindow));
  settingsWindow.on('closed', () => (settingsWindow = null));
}

/**
 * Autostart. While running from source (not installed), Windows must start Electron *with this
 * app's folder*; otherwise it would open an empty Electron window instead of Kip.
 */
function setStartWithWindows(on) {
  app.setLoginItemSettings(app.isPackaged
    ? { openAtLogin: on }
    : { openAtLogin: on, path: process.execPath, args: [app.getAppPath()] });
}

function pauseFor(minutes) {
  settings.pausedUntil = minutes ? Date.now() + minutes * 60_000 : 0;
  saveSettings(settings);
  refreshTray();
  tick();
}

function refreshTray() {
  const paused = Date.now() < settings.pausedUntil;
  tray.setToolTip(paused ? 'Kip (paused)' : 'Kip is watching');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: paused ? `Paused until ${new Date(settings.pausedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Kip is watching', enabled: false },
    { type: 'separator' },
    { label: 'Pause 15 minutes', click: () => pauseFor(15) },
    { label: 'Pause 1 hour', click: () => pauseFor(60) },
    { label: 'Resume', enabled: paused, click: () => pauseFor(0) },
    { type: 'separator' },
    { label: 'Settings…', click: openSettings },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: settings.startWithWindows,
      click: item => {
        settings.startWithWindows = item.checked;
        setStartWithWindows(item.checked);
        saveSettings(settings);
      },
    },
    { type: 'separator' },
    { label: 'Quit Kip', click: () => app.quit() },
  ]));
}

/** The monitor a window (physical-pixel rect) is mostly on, and the rect in that monitor's DIP. */
function locate(rect) {
  const dip = screen.screenToDipRect(null, rect);
  return { dip, display: screen.getDisplayMatching(dip) };
}

/** Window rect in overlay coordinates (DIP), clamped onto its monitor's overlay. */
function toOverlayRect({ dip, display }) {
  const b = display.bounds;
  const x = Math.max(0, Math.min(b.width - 80, dip.x - b.x));
  const y = Math.max(0, Math.min(b.height - 80, dip.y - b.y));
  return { x, y, width: Math.min(dip.width, b.width - x), height: Math.min(dip.height, b.height - y) };
}

/** True when a full-screen app (not on the list) covers the monitor Kip is on. */
function coversKip(win) {
  // The desktop itself (explorer.exe) spans the whole screen but isn't a full-screen app.
  if (!win || win.exe === 'explorer.exe' || !win.title) return false;
  const { dip, display } = locate(win.rect);
  const d = display.bounds;
  return display.id === kipDisplayId &&
    dip.x <= d.x && dip.y <= d.y && dip.x + dip.width >= d.x + d.width && dip.y + dip.height >= d.y + d.height;
}

let lastLoggedPhase = null;
function send(status) {
  // One console line per state change (visible in the terminal that runs `npm start`).
  if (status.phase !== lastLoggedPhase) {
    lastLoggedPhase = status.phase;
    console.log(`[kip] ${new Date().toLocaleTimeString()} ${status.phase}${status.app ? ` (${status.app})` : ''}`);
  }
  const overlay = kipOverlay();
  if (overlay && !overlay.isDestroyed()) overlay.webContents.send('status', status);
}

function tick() {
  if (!kipOverlay()) return;
  const now = Date.now();

  if (now < settings.pausedUntil) {
    watch.ringing = false;
    watch.countdownEndsAt = null;
    send({ phase: 'paused', text: line('paused') });
    return;
  }
  if (tray && settings.pausedUntil && now >= settings.pausedUntil) {
    settings.pausedUntil = 0;
    refreshTray();
  }

  let win = null;
  try {
    win = activeWindow();
  } catch {
    win = null;
  }
  // Kip's own windows (settings, clicking Kip) don't change what you're doing.
  if (win && win.path === process.execPath) win = lastWindow;
  lastWindow = win;

  const rule = matchWindow(win, settings);
  const vars = { name: settings.name, app: rule?.label ?? '' };
  const base = { mode: settings.mode, sound: settings.alarmSound };

  if (!rule) {
    if (watch.countdownEndsAt !== null) {
      watch.pausedRemainingMs = Math.max(0, watch.countdownEndsAt - now);
      watch.pausedAt = now;
      watch.countdownEndsAt = null;
    }
    const justLeft = watch.wasBusy;
    watch.ringing = false;
    watch.wasBusy = false;
    // Presentations, games and full-screen video that aren't on the list: Kip hides.
    if (coversKip(win)) send({ ...base, phase: 'hidden' });
    else send({ ...base, phase: 'idle', text: justLeft ? line('left', settings.mode, vars) : null });
    return;
  }

  watch.wasBusy = true;
  const cooldownMs = settings.cooldownMinutes * 60_000;
  if (!watch.ringing) {
    if (watch.countdownEndsAt !== null) {
      if (now >= watch.countdownEndsAt) fire(now);
    } else if (now - watch.lastFiredAt < cooldownMs) {
      fire(now);
    } else if (watch.pausedRemainingMs !== null && now - watch.pausedAt < cooldownMs) {
      watch.countdownEndsAt = now + watch.pausedRemainingMs;
      watch.pausedRemainingMs = null;
    } else {
      watch.countdownEndsAt = now + settings.countdownSeconds * 1000;
    }
  }

  // Kip goes to whichever monitor the distracting window is on.
  const where = locate(win.rect);
  moveKipTo(where.display.id);
  const target = toOverlayRect(where);
  if (watch.ringing) {
    send({ ...base, phase: 'alarm', app: rule.label, target, text: line('alarm', settings.mode, vars) });
  } else {
    const secondsLeft = Math.max(0, Math.ceil((watch.countdownEndsAt - now) / 1000));
    const time = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;
    send({ ...base, phase: 'countdown', app: rule.label, target, secondsLeft, text: line('noticed', settings.mode, { ...vars, time }) });
  }
}

function fire(now) {
  watch.ringing = true;
  watch.countdownEndsAt = null;
  watch.pausedRemainingMs = null;
  watch.lastFiredAt = now;
}

ipcMain.on('kip-hover', (e, hovering) => {
  BrowserWindow.fromWebContents(e.sender)?.setIgnoreMouseEvents(!hovering, { forward: true });
});
// Kip wandered off the left/right edge of his monitor: continue on the monitor next to it.
ipcMain.on('kip-exit', (e, side) => {
  const overlay = kipOverlay();
  if (!overlay || e.sender !== overlay.webContents) return;
  const next = neighbor(displayById(kipDisplayId), side);
  if (next) moveKipTo(next.id);
  else overlay.webContents.send('enter', { from: side }); // monitor was unplugged meanwhile: walk back in
});
ipcMain.on('open-settings', () => openSettings());
ipcMain.handle('kip-line', (_e, kind) =>
  ['wander', 'poke'].includes(kind) ? line(kind, settings.mode, { name: settings.name }) : ''
);
ipcMain.handle('get-settings', () => ({ settings, presets: PRESETS.map(({ id, label }) => ({ id, label })) }));
ipcMain.handle('save-settings', (_e, next) => {
  settings = { ...settings, ...next };
  saveSettings(settings);
  setStartWithWindows(settings.startWithWindows);
  for (const overlay of overlays.values()) overlay.webContents.send('settings', settings);
  refreshTray();
  return settings;
});

app.whenReady().then(() => {
  settings = loadSettings();
  // Re-register autostart each launch so the entry always points at this copy of Kip.
  if (settings.startWithWindows) setStartWithWindows(true);
  createOverlays();
  for (const event of ['display-added', 'display-removed', 'display-metrics-changed']) screen.on(event, rebuildOverlaysSoon);
  tray = new Tray(nativeImage.createFromPath(path.join(ASSETS, 'icon16.png')));
  tray.on('click', openSettings);
  refreshTray();
  if (!settings.name) openSettings(); // first run: say hi and set things up
  setInterval(tick, TICK_MS);
});

// Kip lives in the tray; closing the settings window must not quit him.
app.on('window-all-closed', e => e.preventDefault());
