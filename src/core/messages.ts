// content ↔ popup ↔ background 공용 메시지 프로토콜.
// browser.runtime.sendMessage 기반, TypeScript discriminated union.

export interface Settings {
  enabled: boolean;
  side: 'left' | 'right';
  marginPx: 0 | 16 | 24;
  telemetryOptIn: boolean;
  onboardingCompleted: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  side: 'right',
  marginPx: 16,
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
}

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
  | { type: 'ping' };

export type WsmResponse =
  | { ok: true; settings?: Settings; status?: PageStatus; pins?: PinSummary[] }
  | { ok: false; error: string };

export function isWsmMessage(x: unknown): x is WsmMessage {
  if (!x || typeof x !== 'object') return false;
  const t = (x as { type?: unknown }).type;
  return typeof t === 'string';
}
