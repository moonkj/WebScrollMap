// Settings persistence via browser.storage.local.
// 기본값 merge + validation.

import { DEFAULT_SETTINGS, type Settings } from './messages';
import type { StorageArea } from '@platform/browserApi';

const KEY = 'wsm:settings:v1';

function sanitize(raw: unknown): Settings {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Partial<Settings>;
  const opacity = src.floatingOpacity === 40 || src.floatingOpacity === 70 ? src.floatingOpacity : 100;
  const margin = [0, 8, 16, 24, 32].includes(src.marginPx as number) ? (src.marginPx as Settings['marginPx']) : 16;
  const barW = [4, 10, 20].includes(src.barWidthPx as number) ? (src.barWidthPx as Settings['barWidthPx']) : 10;
  const filter = ['all', 'headings', 'media'].includes(src.smartFilter as string) ? (src.smartFilter as Settings['smartFilter']) : 'all';
  const theme = ['default', 'sunset', 'ocean', 'forest', 'mono'].includes(src.theme as string) ? (src.theme as Settings['theme']) : 'default';
  return {
    enabled: typeof src.enabled === 'boolean' ? src.enabled : DEFAULT_SETTINGS.enabled,
    side: src.side === 'left' ? 'left' : 'right',
    marginPx: margin,
    barWidthPx: barW,
    floatingOpacity: opacity,
    smartFilter: filter,
    theme: theme,
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
