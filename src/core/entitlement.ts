// Pro tier entitlement check. Permissive 정책 (팀 Debugger 권고):
// 클라 HMAC 서명 토큰 검증 + StoreKit Transaction.currentEntitlements 조회.
// 서버 검증 없음 — 1인 운영, $2.99 가격 고려 ROI.
//
// 크래킹은 uBlock/Dark Reader 수준에서 발생하지만, 95% 정직 사용자 커버가 목표.

import { djb2 } from './hash';

export type Tier = 'free' | 'pro';

export interface Entitlement {
  tier: Tier;
  /** Unix ms. Transaction originalPurchaseDate. null = free. */
  purchasedAt: number | null;
  /** grace period 끝나는 시점 (오프라인 대비). Pro일 때만 의미. */
  validUntil: number;
  /** 디바이스 고정 식별자 (native에서 생성). 다른 기기 토큰 재사용 방지. */
  deviceId: string;
  /** 위 필드 전체의 HMAC-like 서명 (djb2 기반, Permissive 방침). */
  signature: number;
}

const SALT = 0x7e_b3_c4_d5;
const GRACE_MS = 14 * 24 * 60 * 60 * 1000; // 14일 오프라인 허용

function signEntitlement(e: Omit<Entitlement, 'signature'>): number {
  const body = `${e.tier}|${e.purchasedAt ?? 0}|${e.validUntil}|${e.deviceId}`;
  return djb2(`${SALT}:${body}`);
}

export function createFreeEntitlement(deviceId: string, now: number): Entitlement {
  const e: Omit<Entitlement, 'signature'> = {
    tier: 'free',
    purchasedAt: null,
    validUntil: now,
    deviceId,
  };
  return { ...e, signature: signEntitlement(e) };
}

export function createProEntitlement(
  deviceId: string,
  purchasedAt: number,
  now: number,
): Entitlement {
  const e: Omit<Entitlement, 'signature'> = {
    tier: 'pro',
    purchasedAt,
    validUntil: now + GRACE_MS,
    deviceId,
  };
  return { ...e, signature: signEntitlement(e) };
}

export function verifyEntitlement(e: Entitlement | null, now: number, deviceId: string): Tier {
  if (!e) return 'free';
  if (e.deviceId !== deviceId) return 'free'; // 타 기기 토큰
  const expected = signEntitlement({
    tier: e.tier,
    purchasedAt: e.purchasedAt,
    validUntil: e.validUntil,
    deviceId: e.deviceId,
  });
  if (expected !== e.signature) return 'free'; // 변조 감지
  if (e.tier === 'pro') {
    // Grace period 만료 전
    if (e.validUntil > now) return 'pro';
    // 만료: native에 재조회 필요하지만 일단 free로 강등
    return 'free';
  }
  return 'free';
}

export function isProTier(tier: Tier): boolean {
  return tier === 'pro';
}
