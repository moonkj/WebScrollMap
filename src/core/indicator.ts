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
  const centerPct = actualTopPct + actualHeightPct / 2;

  // 기준 높이: 실제 vpH/docH, 가시성 위해 MIN 적용.
  const baseHeight = Math.max(MIN_INDICATOR_HEIGHT_PCT, actualHeightPct);
  const halfH = baseHeight / 2;

  // Center-preserving 대칭 shrink — 바 경계에서 중심을 항상 보존.
  // (기존엔 top을 shift해 중심이 이동, 핀/손가락과 불일치 유발.)
  let top = centerPct - halfH;
  let bottom = centerPct + halfH;
  if (top < 0) {
    top = 0;
    bottom = Math.max(0, Math.min(100, 2 * centerPct));
  } else if (bottom > 100) {
    bottom = 100;
    top = Math.max(0, Math.min(100, 2 * centerPct - 100));
  }
  const height = bottom - top;

  return {
    topPct: Math.max(0, Math.min(100, top)),
    heightPct: Math.max(1, Math.min(100, height)),
  };
}
