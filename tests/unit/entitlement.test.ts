import { describe, expect, it } from 'vitest';
import {
  createFreeEntitlement,
  createProEntitlement,
  verifyEntitlement,
  isProTier,
} from '@core/entitlement';

describe('entitlement', () => {
  const DEV = 'device-abc';
  const NOW = 1_700_000_000_000;

  it('free entitlement verifies as free', () => {
    const e = createFreeEntitlement(DEV, NOW);
    expect(verifyEntitlement(e, NOW, DEV)).toBe('free');
  });

  it('pro entitlement verifies as pro within grace', () => {
    const e = createProEntitlement(DEV, NOW - 86400000, NOW);
    expect(verifyEntitlement(e, NOW, DEV)).toBe('pro');
    expect(isProTier('pro')).toBe(true);
  });

  it('pro entitlement expires after grace period', () => {
    const e = createProEntitlement(DEV, NOW - 86400000, NOW);
    // 14+1일 경과 시 grace 만료
    const later = NOW + 15 * 24 * 60 * 60 * 1000;
    expect(verifyEntitlement(e, later, DEV)).toBe('free');
  });

  it('rejects different deviceId', () => {
    const e = createProEntitlement(DEV, NOW - 1000, NOW);
    expect(verifyEntitlement(e, NOW, 'other-device')).toBe('free');
  });

  it('rejects tampered signature', () => {
    const e = createProEntitlement(DEV, NOW - 1000, NOW);
    const tampered = { ...e, tier: 'pro' as const, purchasedAt: NOW - 999_999 };
    // 서명 미갱신 → verify 실패
    expect(verifyEntitlement(tampered, NOW, DEV)).toBe('free');
  });

  it('null entitlement = free', () => {
    expect(verifyEntitlement(null, NOW, DEV)).toBe('free');
  });
});
