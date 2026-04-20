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

// Fire-and-forget haptic — await 하지 않고 바로 반환. Performance 권고.
export function playHaptic(kind: 'snap' | 'pin' | 'edge'): void {
  if (!nativeAvailable()) return;
  void send({ type: 'haptic', kind });
}

export function isNativeHostAvailable(): boolean {
  return nativeAvailable();
}
