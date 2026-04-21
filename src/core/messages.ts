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
  marginPx: 0,
  barWidthPx: 10,
  floatingOpacity: 70,
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

export type WsmMessage =
  | { type: 'get-settings' }
  | { type: 'set-settings'; settings: Partial<Settings> }
  | { type: 'get-status' }
  | { type: 'settings-changed'; settings: Settings }
  | { type: 'clear-pins' }
  | { type: 'clear-trail' }
  | { type: 'get-pins' }
  | { type: 'jump-to-pin'; pinId: string }
  | { type: 'delete-pin'; pinId: string }
  | { type: 'get-entitlement' } // legacy, returns pro
  | { type: 'haptic'; kind: 'snap' | 'pin' | 'edge' }
  | { type: 'telemetry-flush' }
  | { type: 'ping' };

export type WsmResponse =
  | {
      ok: true;
      settings?: Settings;
      status?: PageStatus;
      pins?: PinSummary[];
      entitlement?: Entitlement | null;
      tier?: Tier;
    }
  | { ok: false; error: string; entitlement?: Entitlement | null };

const VALID_TYPES = new Set<string>([
  'get-settings', 'set-settings', 'get-status', 'settings-changed',
  'clear-pins', 'clear-trail', 'get-pins', 'jump-to-pin', 'delete-pin',
  'get-entitlement', 'haptic', 'telemetry-flush', 'ping',
]);

export function isWsmMessage(x: unknown): x is WsmMessage {
  if (!x || typeof x !== 'object') return false;
  const msg = x as Record<string, unknown>;
  const t = msg.type;
  if (typeof t !== 'string' || !VALID_TYPES.has(t)) return false;
  switch (t) {
    case 'set-settings':
      return msg.settings !== undefined && typeof msg.settings === 'object' && msg.settings !== null;
    case 'jump-to-pin':
    case 'delete-pin':
      return typeof msg.pinId === 'string' && msg.pinId.length > 0 && msg.pinId.length < 128;
    case 'haptic':
      return msg.kind === 'snap' || msg.kind === 'pin' || msg.kind === 'edge';
    case 'settings-changed':
      return msg.settings !== undefined && typeof msg.settings === 'object' && msg.settings !== null;
    default:
      return true;
  }
}
