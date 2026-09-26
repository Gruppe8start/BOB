// Metro bundles the phone/web app. It must never pick up the separate desktop app in desktop/
// (its own Electron dependencies would clash with React Native's).
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const desktopDir = path.resolve(__dirname, 'desktop').replace(/[/\\]/g, '[/\\\\]').replace(/[.*+?^${}()|]/g, '\\$&');
const blockDesktop = new RegExp(`^${desktopDir}([/\\\\].*)?$`);
const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  blockDesktop,
];

module.exports = config;
