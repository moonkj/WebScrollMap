import { describe, expect, it } from 'vitest';
import { computeIndicatorStyle, MIN_INDICATOR_HEIGHT_PCT } from '@core/indicator';

describe('computeIndicatorStyle', () => {
  it('returns actual height when >= MIN', () => {
    // docH=1000, vpH=400 → 40% height
    const s = computeIndicatorStyle({ scrollY: 100, height: 400, docHeight: 1000 });
    expect(s.heightPct).toBeCloseTo(40, 1);
    expect(s.topPct).toBeCloseTo(10, 1);
  });

  it('enforces MIN height for long pages', () => {
    // docH=10000, vpH=800 → actual 8% height, should grow to 15%
    const s = computeIndicatorStyle({ scrollY: 5000, height: 800, docHeight: 10000 });
    expect(s.heightPct).toBe(MIN_INDICATOR_HEIGHT_PCT);
    // actual center: (5000 + 400) / 10000 = 0.54 → 54%
    // topPct = 54 - 7.5 = 46.5
    expect(s.topPct).toBeCloseTo(46.5, 1);
  });

  it('symmetric shrink at doc start preserves center', () => {
    // scrollY=0, height=800, docH=10000 → centerPct=4%
    const s = computeIndicatorStyle({ scrollY: 0, height: 800, docHeight: 10000 });
    expect(s.topPct).toBe(0);
    // 대칭 shrink: bottom = 2*center = 8 → height=8 (MIN보다 작게 가려 finger=center 유지)
    expect(s.heightPct).toBeCloseTo(8, 1);
    // 시각 중심 = center
    expect(s.topPct + s.heightPct / 2).toBeCloseTo(4, 1);
  });

  it('symmetric shrink at doc end preserves center', () => {
    // scrollY=9200, height=800, docH=10000 → centerPct=96%
    const s = computeIndicatorStyle({ scrollY: 9200, height: 800, docHeight: 10000 });
    // 대칭 shrink: top = 2*96-100 = 92, bottom = 100, height = 8
    expect(s.topPct).toBeCloseTo(92, 1);
    expect(s.heightPct).toBeCloseTo(8, 1);
    // 시각 중심 = center
    expect(s.topPct + s.heightPct / 2).toBeCloseTo(96, 1);
  });

  it('handles docH = 0 gracefully', () => {
    const s = computeIndicatorStyle({ scrollY: 0, height: 800, docHeight: 0 });
    expect(s.topPct).toBeGreaterThanOrEqual(0);
    expect(s.heightPct).toBeGreaterThan(0);
  });
});
