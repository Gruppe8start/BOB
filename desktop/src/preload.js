const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kip', {
  onInit: cb => ipcRenderer.on('init', (_e, data) => cb(data)),
  onStatus: cb => ipcRenderer.on('status', (_e, data) => cb(data)),
  onSettings: cb => ipcRenderer.on('settings', (_e, data) => cb(data)),
  setHover: hovering => ipcRenderer.send('kip-hover', hovering),
  line: kind => ipcRenderer.invoke('kip-line', kind),
  openSettings: () => ipcRenderer.send('open-settings'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: settings => ipcRenderer.invoke('save-settings', settings),
});
