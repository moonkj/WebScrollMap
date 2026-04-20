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
    case 'get-entitlement':
    case 'purchase-pro':
    case 'restore-purchases': {
      // Native host로 직접 전달 (Safari Web Extension: sendNativeMessage)
      const nativeApi = api as unknown as {
        runtime: { sendNativeMessage?: (appId: string, msg: unknown) => Promise<unknown> };
      };
      const NATIVE_APP_ID = 'com.kjmoon.WebScrollMap.Native';
      if (typeof nativeApi.runtime.sendNativeMessage === 'function') {
        nativeApi.runtime
          .sendNativeMessage(NATIVE_APP_ID, msg)
          .then((r) => {
            const native = r as { ok?: boolean; entitlement?: unknown };
            if (native?.ok) {
              // verifyEntitlement는 content 쪽에서 재처리. 여기선 tier 판정은 스킵.
              sendResponse({ ok: true, entitlement: native.entitlement as never } satisfies WsmResponse);
              // 모든 탭에 entitlement-changed 브로드캐스트
              if (api.tabs) {
                api.tabs.query({}).then((tabs) => {
                  for (const t of tabs) {
                    if (typeof t.id === 'number') {
                      api.tabs!.sendMessage(t.id, {
                        type: 'entitlement-changed',
                        entitlement: native.entitlement,
                        tier: (native.entitlement as { tier?: string } | null)?.tier ?? 'free',
                      }).catch(() => {});
                    }
                  }
                }).catch(() => {});
              }
            } else {
              sendResponse({ ok: false, error: 'native not available' } satisfies WsmResponse);
            }
          })
          .catch((e: unknown) => sendResponse({ ok: false, error: String(e) } satisfies WsmResponse));
        return true;
      }
      sendResponse({ ok: false, error: 'native messaging unavailable' } satisfies WsmResponse);
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
