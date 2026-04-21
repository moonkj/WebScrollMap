// Background service worker. Settings 저장/조회 + content script로 broadcast relay.

import { isWsmMessage, type WsmMessage, type WsmResponse } from '@core/messages';
import { loadSettings, saveSettings } from '@core/settings';
import { getBrowserApi } from '@platform/browserApi';

const api = getBrowserApi();

async function broadcastSettings(tabs: NonNullable<typeof api.tabs>) {
  const current = await loadSettings(api.storage.local);
  try {
    // 설정 변경은 드문 이벤트 — 모든 탭에 브로드캐스트 유지 (백그라운드 탭 stale 방지).
    // sendMessage는 리스너 없는 탭에서 silent fail — 실제 비용은 수 ms 수준.
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
    case 'haptic': {
      const nativeApi = api as unknown as {
        runtime: { sendNativeMessage?: (appId: string, msg: unknown) => Promise<unknown> };
      };
      const NATIVE_APP_ID = 'com.kjmoon.WebScrollMap';
      if (typeof nativeApi.runtime.sendNativeMessage === 'function') {
        nativeApi.runtime.sendNativeMessage(NATIVE_APP_ID, msg).catch(() => {});
      }
      sendResponse({ ok: true } satisfies WsmResponse);
      return false;
    }
    case 'get-entitlement': {
      // 레거시 호환 — tier 제거됐으므로 pro 반환.
      sendResponse({ ok: true, entitlement: null, tier: 'pro' } satisfies WsmResponse);
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
