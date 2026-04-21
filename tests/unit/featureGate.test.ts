import { describe, expect, it } from 'vitest';
import { isFeatureAvailable, applyTierConstraints, lockToastMessage } from '@core/featureGate';
import { DEFAULT_SETTINGS } from '@core/messages';

// App Store 단일 가격 전환 후: 모든 기능 항상 허용, tier 분리 제거.
describe('feature gate (App Store single-price)', () => {
  it('isFeatureAvailable always returns true', () => {
    const all = ['pin-drop', 'pin-jump', 'trail', 'magnifier', 'section-badge', 'search', 'floating-panel', 'manual-picker', 'right-side', 'margin-custom', 'bar-width', 'opacity', 'theme', 'smart-filter', 'haptic', 'telemetry'] as const;
    for (const f of all) {
      expect(isFeatureAvailable('free', f)).toBe(true);
      expect(isFeatureAvailable('pro', f)).toBe(true);
    }
  });

  it('applyTierConstraints returns settings as-is (no forced constraints)', () => {
    const custom = {
      ...DEFAULT_SETTINGS,
      side: 'left' as const,
      marginPx: 32 as const,
      barWidthPx: 20 as const,
      floatingOpacity: 40 as const,
      smartFilter: 'headings' as const,
      theme: 'sunset' as const,
      telemetryOptIn: true,
    };
    expect(applyTierConstraints('free', custom)).toEqual(custom);
    expect(applyTierConstraints('pro', custom)).toEqual(custom);
  });

  it('lockToastMessage returns empty string (no lock messaging)', () => {
    expect(lockToastMessage('pin-drop')).toBe('');
    expect(lockToastMessage('search')).toBe('');
  });
});
