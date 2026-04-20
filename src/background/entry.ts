// Background service worker. Settings 저장/조회 + content script로 broadcast relay.

import { isWsmMessage, type WsmMessage, type WsmResponse } from '@core/messages';
import { loadSettings, saveSettings } from '@core/settings';
import { getBrowserApi } from '@platform/browserApi';

const api = getBrowserApi();

async function broadcastSettings(tabs: NonNullable<typeof api.tabs>) {
  const current = await loadSettings(api.storage.local);
  try {
    const all = await tabs.query({});
    for (const t of all) {
      if (typeof t.id === 'number') {
        tabs.sendMessage(t.id, { type: 'settings-changed', settings: current }).catch(() => {});
      }
    }
  } catch {
    // tabs.query 실패 — silent
  }
}

api.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
  if (!isWsmMessage(raw)) {
    sendResponse({ ok: false, error: 'invalid message' } satisfies WsmResponse);
    return false;
  }
  const msg = raw as WsmMessage;
  switch (msg.type) {
    case 'get-settings': {
      loadSettings(api.storage.local)
        .then((settings) => sendResponse({ ok: true, settings } satisfies WsmResponse))
        .catch((e: unknown) =>
          sendResponse({ ok: false, error: String(e) } satisfies WsmResponse),
        );
      return true;
    }
    case 'set-settings': {
      saveSettings(api.storage.local, msg.settings)
        .then(async (settings) => {
          if (api.tabs) await broadcastSettings(api.tabs);
          sendResponse({ ok: true, settings } satisfies WsmResponse);
        })
        .catch((e: unknown) =>
          sendResponse({ ok: false, error: String(e) } satisfies WsmResponse),
        );
      return true;
    }
    case 'ping': {
      sendResponse({ ok: true } satisfies WsmResponse);
      return false;
    }
    default: {
      // relay to active tab (popup → content 전달 등)
      if (api.tabs) {
        api.tabs
          .query({ active: true, currentWindow: true })
          .then(async (ts) => {
            const id = ts[0]?.id;
            if (typeof id !== 'number') {
              sendResponse({ ok: false, error: 'no active tab' } satisfies WsmResponse);
              return;
            }
            try {
              const r = (await api.tabs!.sendMessage(id, msg)) as WsmResponse;
              sendResponse(r ?? { ok: true });
            } catch (e) {
              sendResponse({ ok: false, error: String(e) } satisfies WsmResponse);
            }
          })
          .catch((e: unknown) =>
            sendResponse({ ok: false, error: String(e) } satisfies WsmResponse),
          );
        return true;
      }
      sendResponse({ ok: false, error: 'unsupported' } satisfies WsmResponse);
      return false;
    }
  }
});
