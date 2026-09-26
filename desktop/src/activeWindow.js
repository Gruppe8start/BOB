// Reads the foreground window on Windows through user32/kernel32 (via koffi, no native build step).
// Returns { title, exe, path, rect } or null. Everything stays on this computer.
const koffi = require('koffi');

const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000;

let api = null;

function load() {
  if (api) return api;
  const user32 = koffi.load('user32.dll');
  const kernel32 = koffi.load('kernel32.dll');
  const RECT = koffi.struct('KIP_RECT', { left: 'int32', top: 'int32', right: 'int32', bottom: 'int32' });
  api = {
    GetForegroundWindow: user32.func('__stdcall', 'GetForegroundWindow', 'void *', []),
    GetWindowTextW: user32.func('__stdcall', 'GetWindowTextW', 'int', ['void *', 'void *', 'int']),
    GetWindowThreadProcessId: user32.func('__stdcall', 'GetWindowThreadProcessId', 'uint32', ['void *', 'void *']),
    GetWindowRect: user32.func('__stdcall', 'GetWindowRect', 'int', ['void *', koffi.out(koffi.pointer(RECT))]),
    OpenProcess: kernel32.func('__stdcall', 'OpenProcess', 'void *', ['uint32', 'int', 'uint32']),
    QueryFullProcessImageNameW: kernel32.func('__stdcall', 'QueryFullProcessImageNameW', 'int', ['void *', 'uint32', 'void *', 'void *']),
    CloseHandle: kernel32.func('__stdcall', 'CloseHandle', 'int', ['void *']),
  };
  return api;
}

function processPath(a, pid) {
  const handle = a.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid);
  if (!handle) return '';
  try {
    const buf = Buffer.alloc(2048);
    const size = Buffer.alloc(4);
    size.writeUInt32LE(1024);
    if (!a.QueryFullProcessImageNameW(handle, 0, buf, size)) return '';
    return buf.toString('utf16le', 0, size.readUInt32LE(0) * 2);
  } finally {
    a.CloseHandle(handle);
  }
}

function activeWindow() {
  if (process.platform !== 'win32') return null;
  const a = load();
  const hwnd = a.GetForegroundWindow();
  if (!hwnd) return null;

  const titleBuf = Buffer.alloc(1024);
  const length = a.GetWindowTextW(hwnd, titleBuf, 512);
  const title = titleBuf.toString('utf16le', 0, length * 2);

  const pidBuf = Buffer.alloc(4);
  a.GetWindowThreadProcessId(hwnd, pidBuf);
  const path = processPath(a, pidBuf.readUInt32LE(0));

  const rect = {};
  a.GetWindowRect(hwnd, rect);

  return {
    title,
    path,
    exe: path.split('\\').pop().toLowerCase(),
    rect: { x: rect.left, y: rect.top, width: rect.right - rect.left, height: rect.bottom - rect.top },
  };
}

module.exports = { activeWindow };
