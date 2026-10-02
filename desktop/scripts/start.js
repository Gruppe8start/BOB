// Starts Kip with Electron. VS Code (itself an Electron app) sets ELECTRON_RUN_AS_NODE=1 in its
// terminals, which would make Electron behave like plain Node, so it is removed here.
// `node scripts/start.js some-script.js` runs another Electron entry point (e.g. the sprite maker).
const path = require('path');
const { spawn } = require('child_process');
const electron = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const args = process.argv.length > 2 ? process.argv.slice(2) : ['.'];
const child = spawn(electron, args, { cwd: path.join(__dirname, '..'), env, stdio: 'inherit' });
child.on('exit', code => process.exit(code ?? 0));
