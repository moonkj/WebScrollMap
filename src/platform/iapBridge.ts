// Native messaging bridge for StoreKit IAP + CoreHaptics.
// browser.runtime.sendNativeMessage → Swift host app.

import { getBrowserApi } from './browserApi';
import type { Entitlement } from '@core/entitlement';

// Safari Web Extension sendNativeMessage의 applicationIdentifier는
// containing app의 bundle ID. Apple 문서 기준.
const NATIVE_APP_ID = 'com.kjmoon.WebScrollMap';

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

export function isNativeHostAvailable(): boolean {
  return nativeAvailable();
}
