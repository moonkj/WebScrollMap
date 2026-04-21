import { beforeEach, describe, expect, it } from 'vitest';
import { loadSettings, saveSettings } from '@core/settings';
import { DEFAULT_SETTINGS } from '@core/messages';
import type { StorageArea } from '@platform/browserApi';

function memory(): StorageArea {
  const data = new Map<string, unknown>();
  return {
    async get(keys) {
      if (keys === null) return Object.fromEntries(data);
      const list = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const k of list) if (data.has(k)) out[k] = data.get(k);
      return out;
    },
    async set(items) {
      for (const [k, v] of Object.entries(items)) data.set(k, v);
    },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) data.delete(k);
    },
  };
}

describe('settings', () => {
  let store: StorageArea;
  beforeEach(() => {
    store = memory();
  });

  it('returns defaults when empty', async () => {
    const s = await loadSettings(store);
    expect(s).toEqual(DEFAULT_SETTINGS);
  });

  it('merges partial updates', async () => {
    const s1 = await saveSettings(store, { side: 'left' });
    expect(s1.side).toBe('left');
    expect(s1.marginPx).toBe(DEFAULT_SETTINGS.marginPx);
  });

  it('clamps invalid margin to 0 (App Store default)', async () => {
    const s = await saveSettings(store, { marginPx: 99 as unknown as 0 });
    expect(s.marginPx).toBe(0);
  });

  it('clamps invalid side to right', async () => {
    const s = await saveSettings(store, { side: 'weird' as unknown as 'left' });
    expect(s.side).toBe('right');
  });

  it('persists across loads', async () => {
    await saveSettings(store, { enabled: false, side: 'left' });
    const s = await loadSettings(store);
    expect(s.enabled).toBe(false);
    expect(s.side).toBe('left');
  });
});
