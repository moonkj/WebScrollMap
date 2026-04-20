import { describe, expect, it } from 'vitest';
import { isFeatureAvailable, applyTierConstraints, lockToastMessage } from '@core/featureGate';
import { DEFAULT_SETTINGS } from '@core/messages';

describe('feature gate', () => {
  it('free tier blocks all pro features', () => {
    const pros = ['pin-drop', 'pin-jump', 'trail', 'magnifier', 'section-badge', 'search', 'floating-panel', 'manual-picker', 'right-side', 'margin-custom', 'bar-width', 'opacity', 'theme', 'smart-filter', 'haptic', 'telemetry'] as const;
    pros.forEach((f) => expect(isFeatureAvailable('free', f)).toBe(false));
  });

  it('pro tier allows all features', () => {
    const pros = ['pin-drop', 'pin-jump', 'trail', 'magnifier', 'section-badge', 'search', 'floating-panel', 'manual-picker', 'right-side', 'margin-custom', 'bar-width', 'opacity', 'theme', 'smart-filter', 'haptic', 'telemetry'] as const;
    pros.forEach((f) => expect(isFeatureAvailable('pro', f)).toBe(true));
  });

  it('applyTierConstraints on free forces defaults', () => {
    const custom = {
      ...DEFAULT_SETTINGS,
      side: 'right' as const,
      marginPx: 32 as const,
      barWidthPx: 20 as const,
      floatingOpacity: 40 as const,
      smartFilter: 'headings' as const,
      theme: 'sunset' as const,
      telemetryOptIn: true,
    };
    const free = applyTierConstraints('free', custom);
    expect(free.side).toBe('left');
    expect(free.marginPx).toBe(16);
    expect(free.barWidthPx).toBe(10);
    expect(free.floatingOpacity).toBe(100);
    expect(free.smartFilter).toBe('all');
    expect(free.theme).toBe('default');
    expect(free.telemetryOptIn).toBe(false);
  });

  it('applyTierConstraints on pro passes through', () => {
    const custom = { ...DEFAULT_SETTINGS, side: 'right' as const, theme: 'ocean' as const };
    const pro = applyTierConstraints('pro', custom);
    expect(pro).toEqual(custom);
  });

  it('lockToastMessage returns user-readable string', () => {
    expect(lockToastMessage('pin-drop')).toMatch(/\$0\.99/);
    expect(lockToastMessage('search')).toMatch(/\$0\.99/);
  });
});
