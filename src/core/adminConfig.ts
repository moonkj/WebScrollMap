// 관리자 모드: override + 월간 통계.
// browser.storage.local 저장. 월 경계에서 자동 리셋.

import type { StorageArea } from '@platform/browserApi';
import type { Tier } from './entitlement';

export type AdminOverride = 'auto' | 'force-free' | 'force-pro';

export interface AdminStats {
  year: number;
  month: number; // 1..12
  freeCount: number;
  proCount: number;
  /** 최근 세션에서 기록한 tier — 같은 bootstrap 내 이중 카운트 방지 */
  lastSessionTier: Tier | null;
  lastSessionAt: number; // Unix ms
}

export interface AdminConfig {
  override: AdminOverride;
  stats: AdminStats;
  adminEnabled: boolean; // 5-click unlock 상태
}

const OVERRIDE_KEY = 'wsm:admin:override:v1';
const STATS_KEY = 'wsm:admin:stats:v1';
const ENABLED_KEY = 'wsm:admin:enabled:v1';

function currentYearMonth(now: number): { year: number; month: number } {
  const d = new Date(now);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function emptyStats(now: number): AdminStats {
  const { year, month } = currentYearMonth(now);
  return { year, month, freeCount: 0, proCount: 0, lastSessionTier: null, lastSessionAt: 0 };
}

function sanitizeOverride(v: unknown): AdminOverride {
  if (v === 'force-free' || v === 'force-pro') return v;
  return 'auto';
}

function sanitizeStats(v: unknown, now: number): AdminStats {
  const s = (v && typeof v === 'object' ? v : {}) as Partial<AdminStats>;
  const { year, month } = currentYearMonth(now);
  const sameMonth = s.year === year && s.month === month;
  if (!sameMonth) return emptyStats(now);
  return {
    year: year,
    month: month,
    freeCount: typeof s.freeCount === 'number' ? s.freeCount : 0,
    proCount: typeof s.proCount === 'number' ? s.proCount : 0,
    lastSessionTier: s.lastSessionTier === 'pro' || s.lastSessionTier === 'free' ? s.lastSessionTier : null,
    lastSessionAt: typeof s.lastSessionAt === 'number' ? s.lastSessionAt : 0,
  };
}

export async function loadAdminConfig(storage: StorageArea, now: number): Promise<AdminConfig> {
  try {
    const rec = await storage.get([OVERRIDE_KEY, STATS_KEY, ENABLED_KEY]);
    return {
      override: sanitizeOverride(rec[OVERRIDE_KEY]),
      stats: sanitizeStats(rec[STATS_KEY], now),
      adminEnabled: rec[ENABLED_KEY] === true,
    };
  } catch {
    return { override: 'auto', stats: emptyStats(now), adminEnabled: false };
  }
}

export async function saveOverride(storage: StorageArea, override: AdminOverride): Promise<void> {
  await storage.set({ [OVERRIDE_KEY]: override });
}

export async function saveEnabled(storage: StorageArea, enabled: boolean): Promise<void> {
  await storage.set({ [ENABLED_KEY]: enabled });
}

export async function resetStats(storage: StorageArea, now: number): Promise<AdminStats> {
  const fresh = emptyStats(now);
  await storage.set({ [STATS_KEY]: fresh });
  return fresh;
}

/**
 * bootstrap마다 호출. 같은 세션에서 중복 카운트되지 않도록 lastSessionAt 10분 간격으로 제한.
 * 월 경계 넘으면 자동 리셋.
 */
export async function bumpStatsForTier(
  storage: StorageArea,
  tier: Tier,
  now: number,
  minIntervalMs: number = 10 * 60 * 1000,
): Promise<AdminStats> {
  const rec = await storage.get(STATS_KEY);
  let current = sanitizeStats(rec[STATS_KEY], now);
  // 같은 세션 중복 방지
  if (current.lastSessionTier === tier && now - current.lastSessionAt < minIntervalMs) {
    return current;
  }
  current = {
    ...current,
    [tier === 'pro' ? 'proCount' : 'freeCount']: (tier === 'pro' ? current.proCount : current.freeCount) + 1,
    lastSessionTier: tier,
    lastSessionAt: now,
  };
  await storage.set({ [STATS_KEY]: current });
  return current;
}

/**
 * override 적용. force-pro면 합성 entitlement 생성 — native 호출 없이 tier 결정.
 */
export function applyOverride(
  override: AdminOverride,
  realTier: Tier,
): Tier {
  if (override === 'force-free') return 'free';
  if (override === 'force-pro') return 'pro';
  return realTier;
}
