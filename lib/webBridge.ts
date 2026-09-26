import { Platform } from 'react-native';

// Talks to the BOB browser extension (browser-extension/) through its content script.
let nextId = 0;

export function callExtension<T>(type: string, payload?: unknown, timeoutMs = 800): Promise<T | null> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return Promise.resolve(null);
  const id = `bob-${Date.now()}-${nextId++}`;
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      resolve(null);
    }, timeoutMs);
    function onMessage(event: MessageEvent) {
      if (event.source !== window || event.data?.source !== 'bob-extension' || event.data.id !== id) return;
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(event.data.reply ?? null);
    }
    window.addEventListener('message', onMessage);
    window.postMessage({ source: 'bob-app', id, type, payload }, '*');
  });
}

export async function extensionInstalled() {
  return (await callExtension<{ version: string }>('ping')) !== null;
}
