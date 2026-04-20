// 매그니파이 프리뷰: 스크럽 중 손가락·커서 근처에 현재 위치 요약 텍스트를 플로팅.
// R2+ UX 제약: blur 금지, transform/opacity만 사용. 프레임당 1ms 이하 유지.

import type { AnchorPoint, ScannerResult } from '@core/types';
import { AnchorKind } from '@core/types';
import { paletteFor } from './palette';

export interface MagnifierApi {
  show(clientY: number, docY: number, result: ScannerResult | null): void;
  hide(): void;
  setSide(side: 'left' | 'right'): void;
  destroy(): void;
}

function labelFor(kind: AnchorKind): string {
  switch (kind) {
    case AnchorKind.Heading1: return 'H1';
    case AnchorKind.Heading2: return 'H2';
    case AnchorKind.Heading3: return 'H3';
    case AnchorKind.Image: return 'IMG';
    case AnchorKind.Video: return 'VIDEO';
    case AnchorKind.StrongText: return 'B';
    case AnchorKind.LinkCluster: return 'LINK';
    default: return '';
  }
}

// docY에 가장 가까운 앵커 반환 (스냅 반경과 무관하게 top-k 후 1개)
function nearestAnchor(docY: number, anchors: ReadonlyArray<AnchorPoint>): AnchorPoint | null {
  if (anchors.length === 0) return null;
  let lo = 0;
  let hi = anchors.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((anchors[mid]?.y ?? 0) < docY) lo = mid + 1;
    else hi = mid;
  }
  const c = [lo - 1, lo, lo + 1];
  let best: AnchorPoint | null = null;
  let bestDist = Infinity;
  for (const i of c) {
    if (i < 0 || i >= anchors.length) continue;
    const a = anchors[i]!;
    const d = Math.abs(a.y - docY);
    if (d < bestDist) {
      bestDist = d;
      best = a;
    }
  }
  return best;
}

export function createMagnifier(
  root: ShadowRoot,
  scheme: 'light' | 'dark',
  initialSide: 'left' | 'right',
): MagnifierApi {
  let side = initialSide;
  const doc = root.ownerDocument ?? document;
  const palette = paletteFor(scheme);

  const el = doc.createElement('div');
  el.setAttribute('role', 'tooltip');
  el.style.cssText = [
    'position: fixed',
    'pointer-events: none',
    'opacity: 0',
    'transform: translateY(-50%)',
    'transition: opacity 120ms ease-out',
    'padding: 6px 8px',
    'font: 600 11px/1.2 -apple-system, system-ui, sans-serif',
    'letter-spacing: 0.02em',
    'border-radius: 6px',
    scheme === 'dark'
      ? 'background: rgba(15,23,42,0.92); color: #f8fafc; box-shadow: 0 1px 3px rgba(0,0,0,0.4)'
      : 'background: rgba(255,255,255,0.96); color: #0f172a; box-shadow: 0 1px 3px rgba(15,23,42,0.18)',
    `border: 1px solid ${palette.heading3}`,
    'max-width: 220px',
    'white-space: nowrap',
    'overflow: hidden',
    'text-overflow: ellipsis',
    'z-index: 1',
  ].join(';');
  root.appendChild(el);

  function place(clientY: number) {
    el.style.top = `${clientY}px`;
    if (side === 'right') {
      el.style.right = '56px';
      el.style.left = '';
    } else {
      el.style.left = '56px';
      el.style.right = '';
    }
  }

  return {
    show(clientY, docY, result) {
      place(clientY);
      // px 숫자는 숨김 (사용자 피드백). 앵커 근처에 헤딩/스트롱이 있을 때만 표시.
      if (!result) {
        el.style.opacity = '0';
        return;
      }
      const a = nearestAnchor(docY, result.anchors);
      if (!a || !a.snippet) {
        el.style.opacity = '0';
        return;
      }
      const kindTxt = labelFor(a.type);
      el.textContent = kindTxt ? `${kindTxt} · ${a.snippet}` : a.snippet;
      el.style.opacity = '1';
    },
    hide() {
      el.style.opacity = '0';
    },
    setSide(next) {
      side = next;
    },
    destroy() {
      el.remove();
    },
  };
}
