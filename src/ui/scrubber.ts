// RAF throttle + passive touch. scrollTo 즉시 모드 (D6).
// H1 엣지 스와이프: 엣지 0~EDGE_MARGIN 영역은 브라우저 제스처에 양보 (EDGE_MARGIN=16).

import { TUNING } from '@config/tuning';
import { snapToAnchor } from '@core/snap';
import type { Disposable } from '@core/types';

export const SNAP_THRESHOLD = TUNING.snapThresholdPx;
export const EDGE_MARGIN = TUNING.edgeMarginPx;

export interface ScrubberApi {
  scrollTo(y: number): void;
  snapCandidates(): number[];
  getDocHeight(): number;
  getViewportHeight(): number;
  onHaptic?(kind: 'snap' | 'edge'): void;
  onStateChange?(state: 'idle' | 'scrubbing'): void;
}

export function createScrubber(el: HTMLElement, api: ScrubberApi): Disposable {
  let ticking = false;
  let pendingY: number | null = null;
  let active = false;
  // Sev2 fix: layout thrash 방지. rect는 pointerdown 및 resize에서만 갱신.
  let cachedRect: { top: number; height: number } = { top: 0, height: 0 };

  function refreshRect() {
    const r = el.getBoundingClientRect();
    cachedRect = { top: r.top, height: r.height };
  }

  function inEdgeZone(clientX: number): boolean {
    const w = window.innerWidth;
    return clientX > w - EDGE_MARGIN;
  }

  function mapEventToY(clientY: number): number {
    const h = cachedRect.height || 1;
    const pct = Math.max(0, Math.min(1, (clientY - cachedRect.top) / h));
    const docH = api.getDocHeight();
    const vpH = api.getViewportHeight();
    const maxScroll = Math.max(0, docH - vpH);
    return pct * maxScroll;
  }

  function applyScroll() {
    if (pendingY === null) {
      ticking = false;
      return;
    }
    const candidates = api.snapCandidates();
    const snapped = snapToAnchor(pendingY, candidates);
    if (snapped.snapped) {
      api.onHaptic?.('snap');
    }
    api.scrollTo(snapped.y);
    pendingY = null;
    ticking = false;
  }

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'touch' && inEdgeZone(e.clientX)) {
      // 엣지 양보 (뒤로가기 제스처 우선)
      api.onHaptic?.('edge');
      return;
    }
    active = true;
    api.onStateChange?.('scrubbing');
    refreshRect();
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // pointerId invalid — ignore
    }
    pendingY = mapEventToY(e.clientY);
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(applyScroll);
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!active) return;
    pendingY = mapEventToY(e.clientY);
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(applyScroll);
    }
  }

  function onPointerUp() {
    if (!active) return;
    active = false;
    api.onStateChange?.('idle');
  }

  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);
  window.addEventListener('resize', refreshRect, { passive: true });

  return {
    dispose() {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('resize', refreshRect);
    },
  };
}
