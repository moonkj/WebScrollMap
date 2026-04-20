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
  | { ok: false; error: string };

export function isWsmMessage(x: unknown): x is WsmMessage {
  if (!x || typeof x !== 'object') return false;
  const t = (x as { type?: unknown }).type;
  return typeof t === 'string';
}
