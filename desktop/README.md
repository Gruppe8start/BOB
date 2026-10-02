# Kip for Windows (desktop prototype)

A separate app from the Kip phone app (the Expo project in the repo root). It has its own
`package.json`, its own `node_modules` and its own copy of Kip's artwork. Nothing is shared with
or imported from the phone app, and the phone app's bundler (Metro) and TypeScript ignore this folder.

Kip walks along the bottom of your screen. When a distracting site or program comes to the front,
he walks over to it and counts down. If it's still open when the countdown ends, he sits on the
window and yells until you switch away. Same rules as the phone: countdown, pause when you leave,
cooldown so reopening right away rings immediately.

## Run it

```powershell
cd desktop
npm install
npm start
```

(`npm install` may say install scripts need approval. Electron needs its script to download the
runtime; if `npm start` complains that Electron failed to install, run `node node_modules/electron/install.js`.)

Kip lives in the taskbar tray (the frog icon): pause 15 min / 1 h, settings, start with Windows, quit.

## How it detects distractions

- Once a second it reads the foreground window's title and program (`src/activeWindow.js`, Win32 via koffi).
- Websites are matched by the browser tab title, only in browsers (`src/rules.js`).
- Programs are matched by their `.exe` name.
- Full-screen windows that aren't on the list (presentations, games) make Kip hide when they cover his monitor.
- With several monitors, Kip runs to whichever one the distracting window is on, and now and then
  wanders over to the monitor next to his (left/right neighbours only).
- Everything stays on this computer. Settings are in `%APPDATA%\kip-desktop\settings.json`.

## Kip's animation

Kip is drawn from a sprite sheet, `assets/kip-sprites.png`, described by `assets/kip-sprites.json`
(frame size, and per animation its row, frame count and speed). Frames face right; Kip is mirrored when
he walks left. The current sheet is generated from the still `assets/kip.png` with `npm run sprites`,
which draws animated legs under him. To use hand-drawn frames, replace the PNG and update the JSON to match
(rows `idle` and `walk` are required).

## Not yet

- Account / syncing with the phone app (needs the backend).
- macOS version, installer and code signing.
- Hand-drawn walk frames (the generated legs are a stand-in until there's real art).
- Monitors stacked above/below each other: Kip runs to them for distractions but doesn't wander there.
