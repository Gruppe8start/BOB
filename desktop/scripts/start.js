// Starts Kip with Electron. VS Code (itself an Electron app) sets ELECTRON_RUN_AS_NODE=1 in its
// terminals, which would make Electron behave like plain Node, so it is removed here.
const path = require('path');
const { spawn } = require('child_process');
const electron = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electron, ['.'], { cwd: path.join(__dirname, '..'), env, stdio: 'inherit' });
child.on('exit', code => process.exit(code ?? 0));
