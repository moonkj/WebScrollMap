// Native messaging bridge for StoreKit IAP + CoreHaptics.
// browser.runtime.sendNativeMessage → Swift host app.

import { getBrowserApi } from './browserApi';
import type { Entitlement } from '@core/entitlement';

const NATIVE_APP_ID = 'com.kjmoon.WebScrollMap.Native';

interface NativeApi {
  runtime: {
    sendNativeMessage?(appId: string, msg: unknown): Promise<unknown>;
  };
}

function nativeAvailable(): boolean {
  const api = getBrowserApi() as unknown as NativeApi;
  return typeof api.runtime.sendNativeMessage === 'function';
}

async function send(msg: unknown): Promise<unknown | null> {
  const api = getBrowserApi() as unknown as NativeApi;
  if (!api.runtime.sendNativeMessage) return null;
  try {
    return await api.runtime.sendNativeMessage(NATIVE_APP_ID, msg);
  } catch {
    return null;
  }
}

export async function fetchEntitlement(): Promise<Entitlement | null> {
  const r = (await send({ type: 'get-entitlement' })) as { entitlement?: Entitlement } | null;
  return r?.entitlement ?? null;
}

export async function purchasePro(): Promise<Entitlement | null> {
  const r = (await send({ type: 'purchase-pro' })) as { entitlement?: Entitlement } | null;
  return r?.entitlement ?? null;
}

export async function restorePurchases(): Promise<Entitlement | null> {
  const r = (await send({ type: 'restore-purchases' })) as { entitlement?: Entitlement } | null;
  return r?.entitlement ?? null;
}

// Fire-and-forget haptic. iOS Safari Web Extension에서는 content→background→native
// 경유가 필요하므로 sendMessage + sendNativeMessage 둘 다 시도.
export function playHaptic(kind: 'snap' | 'pin' | 'edge'): void {
  const api = getBrowserApi();
  // 1) background 경유 (iOS Safari)
  try {
    void api.runtime.sendMessage({ type: 'haptic', kind });
  } catch {
    // noop
  }
  // 2) 직접 native (macOS)
  if (nativeAvailable()) {
    void send({ type: 'haptic', kind });
  }
}

export function isNativeHostAvailable(): boolean {
  return nativeAvailable();
}
