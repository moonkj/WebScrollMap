// App Store 단일 가격($0.99) 정책 — Free/Pro 분리 없음.
// 모든 기능 기본 허용. 이 모듈은 legacy API 호환을 위해 유지 (항상 true 반환).

import type { Settings } from './messages';

export type ProFeature =
  | 'pin-drop'
  | 'pin-jump'
  | 'trail'
  | 'magnifier'
  | 'section-badge'
  | 'search'
  | 'floating-panel'
  | 'manual-picker'
  | 'right-side'
  | 'margin-custom'
  | 'bar-width'
  | 'opacity'
  | 'theme'
  | 'smart-filter'
  | 'haptic'
  | 'telemetry';

export function isFeatureAvailable(_tier: unknown, _feature: ProFeature): boolean {
  return true;
}

/** Tier 분리 제거 — settings를 그대로 반환. */
export function applyTierConstraints(_tier: unknown, settings: Settings): Settings {
  return settings;
}

export function lockToastMessage(_feature: ProFeature): string {
  return '';
}
