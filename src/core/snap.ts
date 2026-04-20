import { TUNING } from '@config/tuning';

// 입력 y에 가장 가까운 앵커 y를 찾고 threshold 이내면 그 좌표를 반환. 밖이면 원본.
export function snapToAnchor(
  y: number,
  sortedAnchorYs: ReadonlyArray<number>,
  threshold: number = TUNING.snapThresholdPx,
): { y: number; snapped: boolean; anchorIndex: number } {
  if (sortedAnchorYs.length === 0) return { y, snapped: false, anchorIndex: -1 };

  // binary search for closest
  let lo = 0;
  let hi = sortedAnchorYs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((sortedAnchorYs[mid] ?? 0) < y) lo = mid + 1;
    else hi = mid;
  }
  const cand = [lo - 1, lo, lo + 1];
  let best = -1;
  let bestDist = Infinity;
  for (const i of cand) {
    if (i < 0 || i >= sortedAnchorYs.length) continue;
    const d = Math.abs((sortedAnchorYs[i] ?? 0) - y);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  if (best >= 0 && bestDist <= threshold) {
    return { y: sortedAnchorYs[best] ?? y, snapped: true, anchorIndex: best };
  }
  return { y, snapped: false, anchorIndex: -1 };
}
