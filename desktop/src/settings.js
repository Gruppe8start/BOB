const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Stored locally in %APPDATA%\kip-desktop\settings.json. Nothing is uploaded.
const DEFAULTS = {
  name: '',
  mode: 'Firm', // Chill | Firm | Brutal
  countdownSeconds: 60,
  cooldownMinutes: 10,
  alarmSound: true,
  presets: ['youtube', 'instagram', 'tiktok', 'netflix', 'reddit', 'twitter'],
  customSites: [],
  customApps: [],
  pausedUntil: 0,
  startWithWindows: false,
};

function file() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file(), 'utf8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(settings) {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(settings, null, 2));
}

module.exports = { DEFAULTS, loadSettings, saveSettings };
