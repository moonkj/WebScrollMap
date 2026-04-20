// Settings persistence via browser.storage.local.
// 기본값 merge + validation.

import { DEFAULT_SETTINGS, type Settings } from './messages';
import type { StorageArea } from '@platform/browserApi';

const KEY = 'wsm:settings:v1';

function sanitize(raw: unknown): Settings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>;
  const opacity = src.floatingOpacity === 40 || src.floatingOpacity === 70 ? src.floatingOpacity : 100;
  return {
    enabled: typeof src.enabled === 'boolean' ? src.enabled : DEFAULT_SETTINGS.enabled,
    side: src.side === 'left' ? 'left' : 'right',
    marginPx: src.marginPx === 0 || src.marginPx === 24 ? src.marginPx : 16,
    floatingOpacity: opacity,
    telemetryOptIn: typeof src.telemetryOptIn === 'boolean' ? src.telemetryOptIn : false,
    onboardingCompleted:
      typeof src.onboardingCompleted === 'boolean' ? src.onboardingCompleted : false,
  };
}

export async function loadSettings(storage: StorageArea): Promise<Settings> {
  try {
    const rec = await storage.get(KEY);
    return sanitize(rec[KEY]);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(
  storage: StorageArea,
  patch: Partial<Settings>,
): Promise<Settings> {
  const current = await loadSettings(storage);
  const next = sanitize({ ...current, ...patch });
  await storage.set({ [KEY]: next });
  return next;
}
