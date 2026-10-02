// Builds Kip's sprite sheet (assets/kip-sprites.png + .json) from the still image assets/kip.png.
// Run with `npm run sprites`. The still is a bust without legs, so this draws cartoon frog legs
// under him and animates them. To use hand-drawn art instead, replace kip-sprites.png and keep
// the .json in sync (same frame size, one animation per row, frames left to right, facing right).
const fs = require('fs');
const path = require('path');
const { app, BrowserWindow } = require('electron');

const ASSETS = path.join(__dirname, '..', 'assets');
const FRAME = 256;
const ANIMATIONS = {
  idle: { row: 0, frames: 4, fps: 3 },
  walk: { row: 1, frames: 8, fps: 10 },
};

// Runs inside a hidden page, which has a canvas.
async function drawSheet(src, frame, animations) {
  const img = new Image();
  img.src = src;
  await img.decode();

  const columns = Math.max(...Object.values(animations).map(a => a.frames));
  const canvas = document.createElement('canvas');
  canvas.width = frame * columns;
  canvas.height = frame * Object.keys(animations).length;
  const g = canvas.getContext('2d');

  // Take Kip's green from his cheek so the legs match the art.
  const probe = document.createElement('canvas');
  probe.width = img.width;
  probe.height = img.height;
  const pg = probe.getContext('2d');
  pg.drawImage(img, 0, 0);
  const [r, gr, b] = pg.getImageData(Math.round(img.width * 0.2), Math.round(img.height * 0.45), 1, 1).data;
  const green = `rgb(${r},${gr},${b})`;
  const farGreen = `rgb(${Math.round(r * 0.78)},${Math.round(gr * 0.78)},${Math.round(b * 0.78)})`;
  const outline = '#1b2410';

  const BODY = 200;
  const LEGS = 30;

  function leg(hipX, hipY, footX, footY, color) {
    g.lineCap = 'round';
    g.strokeStyle = outline;
    g.lineWidth = 19;
    g.beginPath();
    g.moveTo(hipX, hipY);
    g.lineTo(footX, footY);
    g.stroke();
    g.strokeStyle = color;
    g.lineWidth = 13;
    g.stroke();
    // Webbed foot pointing right, with three toes.
    g.lineWidth = 3;
    g.fillStyle = color;
    for (const [dx, dy] of [[17, -4], [20, 1], [17, 6]]) {
      g.beginPath();
      g.arc(footX + dx, footY + dy, 4.5, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    g.beginPath();
    g.ellipse(footX + 5, footY + 1, 15, 7, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }

  function kip(ox, oy, { bob = 0, tilt = 0, squash = 1, feet }) {
    const cx = ox + frame / 2;
    const ground = oy + frame - 16;
    const bodyBottom = ground - LEGS + 8 + bob;
    const hipY = bodyBottom - 14;
    // Far leg first (darker), then the near one; the body covers the hips.
    leg(cx + 20, hipY, feet[1].x + cx, ground - feet[1].lift - 3, farGreen);
    leg(cx - 20, hipY, feet[0].x + cx, ground - feet[0].lift - 3, green);
    g.save();
    g.translate(cx, bodyBottom);
    g.rotate(tilt);
    g.scale(1 / Math.sqrt(squash), squash);
    g.drawImage(img, -BODY / 2, -BODY, BODY, BODY);
    g.restore();
  }

  for (const [name, a] of Object.entries(animations)) {
    for (let i = 0; i < a.frames; i++) {
      const p = (i / a.frames) * Math.PI * 2;
      const ox = i * frame;
      const oy = a.row * frame;
      if (name === 'walk') {
        // Each foot: pushes back while planted (sin >= 0), swings forward lifted (sin < 0).
        const foot = phase => ({ x: Math.cos(phase) * 22, lift: Math.max(0, -Math.sin(phase)) * 14 });
        const a0 = foot(p);
        const a1 = foot(p + Math.PI);
        kip(ox, oy, {
          bob: -Math.abs(Math.sin(p)) * 7,
          tilt: Math.sin(p) * 0.045,
          squash: 1 - Math.abs(Math.cos(p)) * 0.02,
          feet: [{ x: a0.x - 22, lift: a0.lift }, { x: a1.x + 6, lift: a1.lift }],
        });
      } else {
        kip(ox, oy, {
          squash: 1 + Math.sin(p) * 0.018,
          feet: [{ x: -30, lift: 0 }, { x: 12, lift: 0 }],
        });
      }
    }
  }
  return { png: canvas.toDataURL('image/png'), columns };
}

app.whenReady().then(async () => {
  try {
    const src = `data:image/png;base64,${fs.readFileSync(path.join(ASSETS, 'kip.png')).toString('base64')}`;
    const win = new BrowserWindow({ show: false });
    await win.loadURL('about:blank');
    const { png, columns } = await win.webContents.executeJavaScript(
      `(${drawSheet.toString()})(${JSON.stringify(src)}, ${FRAME}, ${JSON.stringify(ANIMATIONS)})`
    );
    fs.writeFileSync(path.join(ASSETS, 'kip-sprites.png'), Buffer.from(png.split(',')[1], 'base64'));
    fs.writeFileSync(
      path.join(ASSETS, 'kip-sprites.json'),
      `${JSON.stringify({ frame: FRAME, columns, rows: Object.keys(ANIMATIONS).length, animations: ANIMATIONS }, null, 2)}\n`
    );
    console.log('Wrote assets/kip-sprites.png and assets/kip-sprites.json');
  } catch (err) {
    console.error(err);
    process.exitCode = 1;
  }
  app.quit();
});
