// BOB browser extension: the browser-side version of the Android distraction watcher.
//
// Tracks time on the distracting sites the user chose in BOB and runs the same alarm rules:
//  - Focusing a distracting site starts a countdown.
//  - Leaving before it ends pauses it (no alarm).
//  - Still there when it ends -> full-page overlay + alarm sound until the user leaves the site.
//  - Cooldown: within N minutes of an alarm, returning rings again immediately; within N
//    minutes of leaving mid-countdown, the countdown resumes instead of restarting.
//
// MV3 service workers are suspended at will, so all state lives in chrome.storage.

const TICK_ALARM = 'bob-tick';
const COUNTDOWN_ALARM = 'bob-countdown';
const OVERLAY_ID = 'bob-alarm-overlay';

const DEFAULT_STATE = {
  config: {
    domains: [],
    labels: {},
    countdownSeconds: 180,
    cooldownMinutes: 10,
    alarmEnabled: false,
    alarmTitle: 'Close it.',
    alarmBody: 'Bob said close {app}.',
  },
  usage: { day: '', perDomain: {} },
  current: null, // { domain, tabId, since }
  countdownEndsAt: null,
  pausedRemainingMs: null,
  pausedAt: 0,
  lastFiredAt: 0,
  ringingTabId: null,
};

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

async function loadState() {
  const { state } = await chrome.storage.local.get('state');
  return { ...DEFAULT_STATE, ...state, config: { ...DEFAULT_STATE.config, ...state?.config } };
}

function saveState(state) {
  return chrome.storage.local.set({ state });
}

// Serialize all updates: events arrive in bursts (tab switch = activated + focus + updated).
let queue = Promise.resolve();
function withState(fn) {
  const run = queue.then(async () => {
    const state = await loadState();
    const result = await fn(state);
    await saveState(state);
    return result;
  });
  queue = run.catch(() => {});
  return run;
}

function matchDomain(url, domains) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    return domains.find(d => host === d || host.endsWith(`.${d}`)) ?? null;
  } catch {
    return null;
  }
}

async function activeDistraction(config) {
  if (config.domains.length === 0) return null;
  if ((await chrome.idle.queryState(60)) === 'locked') return null;
  const win = await chrome.windows.getLastFocused().catch(() => null);
  if (!win?.focused) return null;
  const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
  if (!tab?.url) return null;
  const domain = matchDomain(tab.url, config.domains);
  return domain ? { domain, tabId: tab.id } : null;
}

function addUsage(state, now) {
  if (state.usage.day !== today()) state.usage = { day: today(), perDomain: {} };
  const cur = state.current;
  if (cur) {
    const ms = Math.max(0, now - Math.max(cur.since, new Date().setHours(0, 0, 0, 0)));
    state.usage.perDomain[cur.domain] = (state.usage.perDomain[cur.domain] ?? 0) + ms;
  }
}

async function evaluate() {
  return withState(async state => {
    const now = Date.now();
    addUsage(state, now);
    const hit = await activeDistraction(state.config);
    state.current = hit ? { ...hit, since: now } : null;

    const { config } = state;
    const cooldownMs = config.cooldownMinutes * 60_000;

    if (hit && config.alarmEnabled) {
      if (state.ringingTabId !== null) {
        if (state.ringingTabId !== hit.tabId) {
          state.ringingTabId = hit.tabId;
          await showOverlay(hit.tabId, config, hit.domain);
        }
      } else if (state.countdownEndsAt !== null) {
        if (now >= state.countdownEndsAt) await fire(state, hit, now);
      } else if (now - state.lastFiredAt < cooldownMs) {
        await fire(state, hit, now);
      } else if (state.pausedRemainingMs !== null && now - state.pausedAt < cooldownMs) {
        startCountdown(state, now + state.pausedRemainingMs);
      } else {
        startCountdown(state, now + config.countdownSeconds * 1000);
      }
    } else {
      if (state.countdownEndsAt !== null) {
        state.pausedRemainingMs = Math.max(0, state.countdownEndsAt - now);
        state.pausedAt = now;
        state.countdownEndsAt = null;
        await chrome.alarms.clear(COUNTDOWN_ALARM);
      }
      if (state.ringingTabId !== null) await stopRinging(state);
    }
  });
}

function startCountdown(state, endsAt) {
  state.countdownEndsAt = endsAt;
  state.pausedRemainingMs = null;
  // Chrome fires one-shot alarms no sooner than ~30 s out, which is fine for 1+ minute countdowns.
  chrome.alarms.create(COUNTDOWN_ALARM, { when: endsAt });
}

async function fire(state, hit, now) {
  state.countdownEndsAt = null;
  state.pausedRemainingMs = null;
  state.lastFiredAt = now;
  state.ringingTabId = hit.tabId;
  await showOverlay(hit.tabId, state.config, hit.domain);
  await startSound();
}

async function stopRinging(state) {
  const tabId = state.ringingTabId;
  state.ringingTabId = null;
  chrome.runtime.sendMessage({ target: 'offscreen', type: 'stop' }).catch(() => {});
  if (tabId !== null) {
    chrome.scripting
      .executeScript({ target: { tabId }, func: id => document.getElementById(id)?.remove(), args: [OVERLAY_ID] })
      .catch(() => {});
  }
}

async function startSound() {
  const contexts = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (contexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: ['AUDIO_PLAYBACK'],
      justification: 'Distraction alarm sound',
    });
  }
  await chrome.runtime.sendMessage({ target: 'offscreen', type: 'ring' }).catch(() => {});
}

async function showOverlay(tabId, config, domain) {
  const label = config.labels[domain] ?? domain;
  await chrome.scripting
    .executeScript({
      target: { tabId },
      args: [
        OVERLAY_ID,
        config.alarmTitle.replace('{app}', label),
        config.alarmBody.replaceAll('{app}', label),
        chrome.runtime.getURL('bob.png'),
      ],
      func: (id, title, body, bobUrl) => {
        if (document.getElementById(id)) return;
        const el = document.createElement('div');
        el.id = id;
        el.style.cssText =
          'position:fixed;inset:0;z-index:2147483647;background:rgba(13,13,13,.97);color:#fff;' +
          'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;' +
          'font-family:system-ui,sans-serif;text-align:center;padding:24px';
        const face = document.createElement('img');
        face.src = bobUrl;
        face.alt = 'Bob';
        face.style.cssText = 'width:160px;height:160px;border-radius:36px;box-shadow:0 10px 40px rgba(0,0,0,.6)';
        const h = document.createElement('div');
        h.textContent = title;
        h.style.cssText = 'font-size:34px;font-weight:800';
        const p = document.createElement('div');
        p.textContent = body;
        p.style.cssText = 'font-size:17px;color:#a5c5a8;max-width:520px;line-height:1.5';
        const btn = document.createElement('button');
        btn.textContent = 'Close this tab';
        btn.style.cssText =
          'margin-top:12px;background:#4caf50;color:#fff;border:0;border-radius:12px;' +
          'padding:14px 28px;font-size:16px;font-weight:800;cursor:pointer';
        btn.onclick = () => chrome.runtime.sendMessage({ type: 'closeTab' });
        el.append(face, h, p, btn);
        document.documentElement.append(el);
      },
    })
    .catch(() => {});
}

// ---- Events ---------------------------------------------------------------

chrome.runtime.onInstalled.addListener(async () => {
  chrome.alarms.create(TICK_ALARM, { periodInMinutes: 0.5 });
  evaluate();
  // Content scripts only reach pages loaded after install; connect BOB tabs that are already open.
  const tabs = await chrome.tabs.query({ url: ['http://localhost/*', 'http://127.0.0.1/*'] });
  for (const tab of tabs) {
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['bridge.js'] }).catch(() => {});
  }
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create(TICK_ALARM, { periodInMinutes: 0.5 });
  evaluate();
});

chrome.alarms.onAlarm.addListener(() => evaluate());
chrome.tabs.onActivated.addListener(() => evaluate());
chrome.tabs.onUpdated.addListener((_id, change) => {
  if (change.url || change.status === 'complete') evaluate();
});
chrome.tabs.onRemoved.addListener(() => evaluate());
chrome.windows.onFocusChanged.addListener(() => evaluate());
chrome.idle.onStateChanged.addListener(() => evaluate());

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'offscreen') return false;

  const handle = async () => {
    switch (message.type) {
      case 'ping':
        return { version: chrome.runtime.getManifest().version };
      case 'getUsage': {
        await evaluate(); // bank time on the current site first
        const state = await loadState();
        const perDomain = state.usage.day === today() ? state.usage.perDomain : {};
        return Object.fromEntries(Object.entries(perDomain).map(([d, ms]) => [d, ms / 60_000]));
      }
      case 'setConfig':
        await withState(state => {
          state.config = { ...state.config, ...message.payload };
        });
        await evaluate();
        return { ok: true };
      case 'testAlarm': {
        // Rings on the BOB tab itself so the alarm can be tried without visiting a site.
        const tabId = sender.tab?.id;
        if (tabId === undefined) return { ok: false };
        await withState(async state => {
          state.ringingTabId = tabId;
          await showOverlay(tabId, { ...state.config, alarmTitle: 'Test alarm.', alarmBody: 'This is what staying on {app} feels like. Switch tabs to stop it.' }, 'a distracting site');
          await startSound();
        });
        return { ok: true };
      }
      case 'closeTab':
        if (sender.tab?.id !== undefined) await chrome.tabs.remove(sender.tab.id);
        return { ok: true };
      default:
        return null;
    }
  };
  handle().then(sendResponse, () => sendResponse(null));
  return true;
});
