// Viewport indicator 위치/크기 계산 — 최소 높이 강제로 긴 페이지에서도 가시성 확보.
// 핵심: 실제 viewport 중심을 유지하면서 높이만 min까지 확장.

import type { ViewportRect } from './types';

export const MIN_INDICATOR_HEIGHT_PCT = 15;

export interface IndicatorStyle {
  topPct: number;    // 0..100
  heightPct: number; // 0..100 (이미 MIN 적용됨)
}

export function computeIndicatorStyle(viewport: ViewportRect): IndicatorStyle {
  const docH = viewport.docHeight > 0 ? viewport.docHeight : 1;
  const actualTopPct = (viewport.scrollY / docH) * 100;
  const actualHeightPct = (viewport.height / docH) * 100;

  if (actualHeightPct >= MIN_INDICATOR_HEIGHT_PCT) {
    return {
      topPct: Math.max(0, Math.min(100, actualTopPct)),
      heightPct: Math.max(1, Math.min(100, actualHeightPct)),
    };
  }

  // 실제 viewport 중심을 유지, 높이를 MIN으로 확장, 바 경계 clamp
  const centerPct = actualTopPct + actualHeightPct / 2;
  const halfMin = MIN_INDICATOR_HEIGHT_PCT / 2;
  let topPct = centerPct - halfMin;
  const heightPct = MIN_INDICATOR_HEIGHT_PCT;

  if (topPct < 0) topPct = 0;
  if (topPct + heightPct > 100) topPct = 100 - heightPct;

  return { topPct, heightPct };
}
