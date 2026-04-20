// RAF throttle + passive touch. scrollTo 즉시 모드 (D6).
// H1 엣지 스와이프: 엣지 0~EDGE_MARGIN 영역은 브라우저 제스처에 양보 (EDGE_MARGIN=16).

import { TUNING } from '@config/tuning';
import { snapToAnchor } from '@core/snap';
import type { Disposable } from '@core/types';

export const SNAP_THRESHOLD = TUNING.snapThresholdPx;
export const EDGE_MARGIN = TUNING.edgeMarginPx;
export const LONG_PRESS_MS = 500;
export const LONG_PRESS_MOVE_TOLERANCE_PX = 6;

export interface ScrubberApi {
  scrollTo(y: number): void;
  snapCandidates(): number[];
  getDocHeight(): number;
  getViewportHeight(): number;
  onHaptic?(kind: 'snap' | 'edge' | 'pin'): void;
  onStateChange?(state: 'idle' | 'scrubbing'): void;
  onLongPress?(y: number): void;
}

export function createScrubber(el: HTMLElement, api: ScrubberApi): Disposable {
  let ticking = false;
  let pendingY: number | null = null;
  let active = false;
  // Sev2 fix: layout thrash 방지. rect는 pointerdown 및 resize에서만 갱신.
  let cachedRect: { top: number; height: number } = { top: 0, height: 0 };
  // Long-press for Pin Drop
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressDownX = 0;
  let longPressDownY = 0;
  let longPressFired = false;
  // Sev1 fix: pin 후보 기간 동안엔 scroll을 보류. 실제 scrub은 move/시간초과 이후.
  let scrollGated = false;

  function clearLongPress() {
    if (longPressTimer !== null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }

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
    longPressFired = false;
    longPressDownX = e.clientX;
    longPressDownY = e.clientY;
    api.onStateChange?.('scrubbing');
    refreshRect();
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // pointerId invalid — ignore
    }

    // Long-press for Pin Drop: pin 후보 기간엔 scroll 보류 (Sev1 fix).
    // 움직이지 않고 타이머 만료 → pin. 움직이면 scrub 전환 + gate 해제.
    if (api.onLongPress) {
      scrollGated = true;
      const targetY = mapEventToY(e.clientY);
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        longPressFired = true;
        api.onHaptic?.('pin');
        api.onLongPress?.(targetY);
        scrollGated = true; // pin 발화 후에도 scroll 계속 보류
      }, LONG_PRESS_MS);
    } else {
      scrollGated = false;
      pendingY = mapEventToY(e.clientY);
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(applyScroll);
      }
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!active) return;
    // Sev2 fix: x/y 합성 거리로 판정
    if (longPressTimer !== null) {
      const dx = e.clientX - longPressDownX;
      const dy = e.clientY - longPressDownY;
      if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_TOLERANCE_PX) {
        clearLongPress();
        scrollGated = false; // scrub 시작
      }
    }
    if (longPressFired) return; // pin fired; don't also scrub
    if (scrollGated) return;
    pendingY = mapEventToY(e.clientY);
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(applyScroll);
    }
  }

  function onPointerUp(e?: PointerEvent) {
    if (!active) return;
    // Tap-to-jump: long-press 타이머 발화 전 + 핀 미발화 + gate 활성 → 사용자 의도는 탭 점프.
    if (longPressTimer !== null && !longPressFired && scrollGated && e) {
      pendingY = mapEventToY(e.clientY);
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(applyScroll);
      }
    }
    clearLongPress();
    active = false;
    longPressFired = false;
    scrollGated = false;
    api.onStateChange?.('idle');
  }

  const onUpEvt = (e: PointerEvent) => onPointerUp(e);
  const onCancelEvt = () => onPointerUp();
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onUpEvt);
  el.addEventListener('pointercancel', onCancelEvt);
  window.addEventListener('resize', refreshRect, { passive: true });

  return {
    dispose() {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onUpEvt);
      el.removeEventListener('pointercancel', onCancelEvt);
      window.removeEventListener('resize', refreshRect);
    },
  };
}
