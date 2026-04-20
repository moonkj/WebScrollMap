import { beforeEach, describe, expect, it } from 'vitest';
import {
  loadAdminConfig,
  saveOverride,
  saveEnabled,
  resetStats,
  bumpStatsForTier,
  applyOverride,
} from '@core/adminConfig';
import type { StorageArea } from '@platform/browserApi';

function memory(): StorageArea {
  const data = new Map<string, unknown>();
  return {
    async get(keys) {
      const list = keys === null ? [...data.keys()] : Array.isArray(keys) ? keys : [keys];
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

describe('adminConfig', () => {
  const NOW = new Date(2026, 3, 20, 12, 0, 0).getTime(); // 2026-04-20
  let store: StorageArea;

  beforeEach(() => {
    store = memory();
  });

  it('defaults: override=auto, empty stats, disabled', async () => {
    const cfg = await loadAdminConfig(store, NOW);
    expect(cfg.override).toBe('auto');
    expect(cfg.adminEnabled).toBe(false);
    expect(cfg.stats.freeCount).toBe(0);
    expect(cfg.stats.proCount).toBe(0);
    expect(cfg.stats.year).toBe(2026);
    expect(cfg.stats.month).toBe(4);
  });

  it('applyOverride: auto keeps realTier', () => {
    expect(applyOverride('auto', 'free')).toBe('free');
    expect(applyOverride('auto', 'pro')).toBe('pro');
  });
  it('applyOverride: force-free/pro overrides', () => {
    expect(applyOverride('force-free', 'pro')).toBe('free');
    expect(applyOverride('force-pro', 'free')).toBe('pro');
  });

  it('bumpStatsForTier increments for tier', async () => {
    await bumpStatsForTier(store, 'free', NOW);
    let cfg = await loadAdminConfig(store, NOW);
    expect(cfg.stats.freeCount).toBe(1);
    expect(cfg.stats.proCount).toBe(0);

    // 10min 이상 경과 → 재증가
    await bumpStatsForTier(store, 'pro', NOW + 11 * 60 * 1000);
    cfg = await loadAdminConfig(store, NOW + 11 * 60 * 1000);
    expect(cfg.stats.freeCount).toBe(1);
    expect(cfg.stats.proCount).toBe(1);
  });

  it('bumpStatsForTier skips within session (<10min same tier)', async () => {
    await bumpStatsForTier(store, 'free', NOW);
    await bumpStatsForTier(store, 'free', NOW + 5 * 60 * 1000);
    const cfg = await loadAdminConfig(store, NOW + 5 * 60 * 1000);
    expect(cfg.stats.freeCount).toBe(1);
  });

  it('resetStats zeroes counters', async () => {
    await bumpStatsForTier(store, 'pro', NOW);
    await resetStats(store, NOW);
    const cfg = await loadAdminConfig(store, NOW);
    expect(cfg.stats.proCount).toBe(0);
    expect(cfg.stats.freeCount).toBe(0);
  });

  it('month rollover resets stats', async () => {
    await bumpStatsForTier(store, 'pro', NOW);
    // 다음 달 동일 일
    const nextMonth = new Date(2026, 4, 20, 12, 0, 0).getTime();
    const cfg = await loadAdminConfig(store, nextMonth);
    expect(cfg.stats.year).toBe(2026);
    expect(cfg.stats.month).toBe(5);
    expect(cfg.stats.proCount).toBe(0);
  });

  it('saveOverride + saveEnabled persist', async () => {
    await saveOverride(store, 'force-pro');
    await saveEnabled(store, true);
    const cfg = await loadAdminConfig(store, NOW);
    expect(cfg.override).toBe('force-pro');
    expect(cfg.adminEnabled).toBe(true);
  });
});
