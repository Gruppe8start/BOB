// Runs on the BOB web app. Relays requests from the page to the extension's service worker.
// Only messages the page explicitly tagged as coming from BOB are forwarded.
// Guarded because background.js also injects it into BOB tabs that were open before install.
if (!window.__bobBridgeInstalled) {
  window.__bobBridgeInstalled = true;
  window.addEventListener('message', async event => {
    if (event.source !== window || event.data?.source !== 'bob-app') return;
    const { id, type, payload } = event.data;
    let reply = null;
    try {
      reply = await chrome.runtime.sendMessage({ type, payload });
    } catch {
      // Extension was reloaded; the page will retry.
    }
    window.postMessage({ source: 'bob-extension', id, reply }, '*');
  });
}
