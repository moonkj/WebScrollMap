// content ↔ popup ↔ background 공용 메시지 프로토콜.
// browser.runtime.sendMessage 기반, TypeScript discriminated union.

export type FloatingOpacity = 40 | 70 | 100;
export type SmartFilter = 'all' | 'headings' | 'media';
export type ThemeName = 'default' | 'sunset' | 'ocean' | 'forest' | 'mono';

export interface Settings {
  enabled: boolean;
  side: 'left' | 'right';
  marginPx: 0 | 8 | 16 | 24 | 32;
  barWidthPx: 4 | 10 | 20;
  floatingOpacity: FloatingOpacity;
  smartFilter: SmartFilter;
  theme: ThemeName;
  telemetryOptIn: boolean;
  onboardingCompleted: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  side: 'right',
  marginPx: 16,
  barWidthPx: 10,
  floatingOpacity: 100,
  smartFilter: 'all',
  theme: 'default',
  telemetryOptIn: false,
  onboardingCompleted: false,
};

export interface PageStatus {
  activatable: boolean;
  anchorCount: number;
  docHeight: number;
  containerKind: 'window' | 'element' | 'none';
  pinCount: number;
}

export interface PinSummary {
  id: string;
  y: number;
  pct: number; // 0..100 (y / docHeight)
  color?: string;
  /** 핀 찍힐 당시 근처 heading snippet (있으면) */
  label?: string;
}

import type { Entitlement, Tier } from './entitlement';
import type { AdminConfig } from './adminConfig';

export type WsmMessage =
  | { type: 'get-settings' }
  | { type: 'set-settings'; settings: Partial<Settings> }
  | { type: 'get-status' } // to content script only
  | { type: 'settings-changed'; settings: Settings } // broadcast from background
  | { type: 'clear-pins' }
  | { type: 'clear-trail' }
  | { type: 'get-pins' }
  | { type: 'jump-to-pin'; pinId: string }
  | { type: 'delete-pin'; pinId: string }
  | { type: 'get-entitlement' }
  | { type: 'purchase-pro' }
  | { type: 'restore-purchases' }
  | { type: 'entitlement-changed'; entitlement: Entitlement | null; tier: Tier }
  | { type: 'haptic'; kind: 'snap' | 'pin' | 'edge' }
  | { type: 'telemetry-flush' }
  | { type: 'get-admin-config' }
  | { type: 'set-admin-override'; override: 'auto' | 'force-free' | 'force-pro' }
  | { type: 'set-admin-enabled'; enabled: boolean }
  | { type: 'reset-admin-stats' }
  | { type: 'admin-override-changed' } // content script re-evaluate tier
  | { type: 'ping' };

export type WsmResponse =
  | {
      ok: true;
      settings?: Settings;
      status?: PageStatus;
      pins?: PinSummary[];
      entitlement?: Entitlement | null;
      tier?: Tier;
      adminConfig?: AdminConfig;
    }
  | { ok: false; error: string; entitlement?: Entitlement | null };

// S6: 타입별 payload까지 엄격 검증 — 악의적 page script가 spoofing할 때
// 단순 `type` 문자열만 있으면 통과하던 느슨함 제거.
const VALID_TYPES = new Set<string>([
  'get-settings', 'set-settings', 'get-status', 'settings-changed',
  'clear-pins', 'clear-trail', 'get-pins', 'jump-to-pin', 'delete-pin',
  'get-entitlement', 'purchase-pro', 'restore-purchases', 'entitlement-changed',
  'haptic', 'telemetry-flush',
  'get-admin-config', 'set-admin-override', 'set-admin-enabled', 'reset-admin-stats',
  'admin-override-changed', 'ping',
]);

export function isWsmMessage(x: unknown): x is WsmMessage {
  if (!x || typeof x !== 'object') return false;
  const msg = x as Record<string, unknown>;
  const t = msg.type;
  if (typeof t !== 'string' || !VALID_TYPES.has(t)) return false;
  // 페이로드 타입 검증 — 민감한 mutating 메시지 위주.
  switch (t) {
    case 'set-settings':
      return msg.settings !== undefined && typeof msg.settings === 'object' && msg.settings !== null;
    case 'jump-to-pin':
    case 'delete-pin':
      return typeof msg.pinId === 'string' && msg.pinId.length > 0 && msg.pinId.length < 128;
    case 'set-admin-override':
      return msg.override === 'auto' || msg.override === 'force-free' || msg.override === 'force-pro';
    case 'set-admin-enabled':
      return typeof msg.enabled === 'boolean';
    case 'haptic':
      return msg.kind === 'snap' || msg.kind === 'pin' || msg.kind === 'edge';
    case 'settings-changed':
      return msg.settings !== undefined && typeof msg.settings === 'object' && msg.settings !== null;
    case 'entitlement-changed': {
      if (msg.tier !== 'free' && msg.tier !== 'pro') return false;
      if (msg.entitlement === null) return true;
      if (typeof msg.entitlement !== 'object') return false;
      // entitlement 객체라면 필수 필드 존재 확인 (공격자가 임의 객체 밀어 넣는 것 방지).
      const e = msg.entitlement as Record<string, unknown>;
      return (
        (e.tier === 'free' || e.tier === 'pro') &&
        typeof e.deviceId === 'string' && e.deviceId.length > 0 &&
        typeof e.validUntil === 'number' &&
        typeof e.signature === 'string'
      );
    }
    default:
      // get-*/clear-*/ping 등 payload 없는 메시지
      return true;
  }
}
