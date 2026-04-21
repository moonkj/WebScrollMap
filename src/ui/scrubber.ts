// 스크럽 바 터치 핸들러 — 최소 구현.
// 원칙: 사용자 finger 위치 → scroll 직접 매핑. 필터/deadband/force commit 제거.
// 누적된 방어 레이어가 상호 간섭해 점프/인식 실패 유발 → 근본으로 회귀.

import { TUNING } from '@config/tuning';
import { snapToAnchor } from '@core/snap';
import type { Disposable } from '@core/types';

export const SNAP_THRESHOLD = TUNING.snapThresholdPx;
export const EDGE_MARGIN = TUNING.edgeMarginPx;
export const LONG_PRESS_MS = 500;
export const LONG_PRESS_MOVE_TOLERANCE_PX = 10;
export const DOUBLE_TAP_MS = 280;
export const DOUBLE_TAP_MOVE_TOLERANCE_PX = 12;

export interface ScrubberApi {
  scrollTo(y: number): void;
  snapCandidates(): number[];
  getDocHeight(): number;
  getViewportHeight(): number;
  onHaptic?(kind: 'snap' | 'edge' | 'pin'): void;
  onStateChange?(state: 'idle' | 'scrubbing'): void;
  onLongPress?(y: number): void;
  onMagnify?(clientY: number, docY: number): void;
  onDoubleTap?(): void;
  /** 스크럽 중 finger 위치 즉시 전달 — indicator UI 업데이트용 */
  onScrubMove?(scrollY: number): void;
}

// 이벤트가 scrubber의 대상(host 또는 shadow 내 track)에서 발생했는지 확인.
// 플로팅 패널 등 다른 shadow UI의 wsm-fp-* 요소는 제외.
function isTrackEvent(e: Event, hostEl: HTMLElement): boolean {
  const path = e.composedPath();
  // 1) path에 .wsm-track이 있으면 track 터치
  for (const n of path) {
    if (n instanceof Element && n.classList) {
      if (n.classList.contains('wsm-track')) return true;
      // 플로팅 패널/버블/검색창 등은 exclude
      const cn = n.className;
      if (typeof cn === 'string' && (cn.startsWith('wsm-fp-') || cn.startsWith('wsm-search') || cn.includes('wsm-section-badge') || cn.includes('wsm-upgrade-toast'))) {
        return false;
      }
    }
  }
  // 2) target이 host 자체면 track 누락 대응 (iOS composedPath 변수 대응)
  if (path[0] === hostEl) return true;
  return false;
}

export function createScrubber(el: HTMLElement, api: ScrubberApi): Disposable {
  let active = false;
  let ticking = false;
  let pendingY: number | null = null;
  let cachedRect = { top: 0, height: 0 };

  // Long-press for Pin Drop
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressDownX = 0;
  let longPressDownY = 0;
  let longPressFired = false;
  let scrollGated = false;

  // Double-tap state
  let lastTapAt = 0;
  let lastTapX = 0;
  let lastTapY = 0;
  let moved = false;

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
    return clientX > window.innerWidth - EDGE_MARGIN;
  }

  function mapEventToY(clientY: number): number {
    const h = cachedRect.height || 1;
    const pct = Math.max(0, Math.min(1, (clientY - cachedRect.top) / h));
    const docH = api.getDocHeight();
    const vpH = api.getViewportHeight();
    // 손가락 = viewport 중앙 = 인디케이터 중앙. clamp 없음 — 바 경계에서도 중앙 유지.
    // 브라우저가 scrollTop을 [0, docH-vpH]로 자연 clamp. 인디케이터는 center-preserving shrink.
    return pct * docH - vpH / 2;
  }

  function mapEventToDocY(clientY: number): number {
    const h = cachedRect.height || 1;
    const pct = Math.max(0, Math.min(1, (clientY - cachedRect.top) / h));
    return pct * api.getDocHeight();
  }

  function applyScroll() {
    const snapshot = pendingY;
    pendingY = null;
    ticking = false;
    if (snapshot === null) return;
    api.scrollTo(Math.round(snapshot));
      
  }

  function schedule() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(applyScroll);
  }

  function onPointerDown(e: PointerEvent) {
    if (!isTrackEvent(e, el)) return;
    // 엣지 존 체크 제거 — 바 우측 경계(innerWidth-16)와 edge zone(>innerWidth-16)이
    // 겹쳐 정당한 바 터치가 차단되는 버그. 뒤로가기 제스처는 iOS가 알아서 처리.
    active = true;
    moved = false;
    longPressFired = false;
    longPressDownX = e.clientX;
    longPressDownY = e.clientY;
    refreshRect();
    api.onStateChange?.('scrubbing');
    const initialY = mapEventToY(e.clientY);
    api.onMagnify?.(e.clientY, initialY);
    // 초기 터치 즉시 indicator를 finger 위치로 이동 — long-press hold 중에도
    // indicator가 손가락 따라감. 이전엔 움직이기 전까지 stale scrollY 표시.
    api.onScrubMove?.(initialY);
    // setPointerCapture 제거 — document 레벨 리스너가 있으므로 capture 없어도 OK.
    // iOS에서 capture가 document 이벤트 전파를 방해하는 가능성 차단.

    if (api.onLongPress) {
      scrollGated = true;
      const targetDocY = mapEventToDocY(e.clientY);
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        longPressFired = true;
        api.onHaptic?.('pin');
        api.onLongPress?.(targetDocY);
      }, LONG_PRESS_MS);
    } else {
      scrollGated = false;
      pendingY = initialY;
      schedule();
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (!active) return;
    if (e.isPrimary === false) return;
    const dx = e.clientX - longPressDownX;
    const dy = e.clientY - longPressDownY;
    const dist = Math.hypot(dx, dy);
    if (longPressTimer !== null && dist > LONG_PRESS_MOVE_TOLERANCE_PX) {
      clearLongPress();
      scrollGated = false;
      // long-press 취소 직후 첫 move에서 indicator를 즉시 finger로 동기화.
      // 이전엔 이 프레임에서 onScrubMove 호출 누락 → indicator가 stale scrollY로 그려져
      // "finger가 indicator 하단에 있음" 증상 유발.
      const y = mapEventToY(e.clientY);
      pendingY = y;
      api.onScrubMove?.(y);
      api.onMagnify?.(e.clientY, y);
      schedule();
      return;
    }
    if (dist > DOUBLE_TAP_MOVE_TOLERANCE_PX) moved = true;
    if (longPressFired) return;
    if (scrollGated) return;
     

    // 원칙: clientY → scroll 직접 매핑. 필터 없음. rAF throttle로 paint 정렬.
    const y = mapEventToY(e.clientY);
    pendingY = y;
    api.onScrubMove?.(y);
    api.onMagnify?.(e.clientY, y);
    schedule();
  }

  function onPointerUp(e?: PointerEvent) {
    if (!active) return;
    // Tap-to-jump: long-press 타이머 발화 전 + 핀 미발화 + gate 활성
    if (longPressTimer !== null && !longPressFired && scrollGated && e) {
      const y = mapEventToY(e.clientY);
      pendingY = y;
      // indicator 즉시 이동 (scroll 반영 지연 방지)
      api.onScrubMove?.(y);
      schedule();
    }
    // Final snap haptic (scroll은 이미 사용자가 원하는 위치에 있음)
    if (e && !longPressFired && !scrollGated) {
      const docY = mapEventToY(e.clientY);
      const snapped = snapToAnchor(docY, api.snapCandidates());
      if (snapped.snapped) api.onHaptic?.('snap');
    }
    // Double-tap
    if (e && !moved && !longPressFired) {
      const now = performance.now();
      const adx = Math.abs(e.clientX - lastTapX);
      const ady = Math.abs(e.clientY - lastTapY);
      if (
        now - lastTapAt < DOUBLE_TAP_MS &&
        adx < DOUBLE_TAP_MOVE_TOLERANCE_PX * 2 &&
        ady < DOUBLE_TAP_MOVE_TOLERANCE_PX * 4
      ) {
        api.onDoubleTap?.();
        lastTapAt = 0;
      } else {
        lastTapAt = now;
        lastTapX = e.clientX;
        lastTapY = e.clientY;
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
  const onTouchStart = (e: TouchEvent) => {
    if (!isTrackEvent(e, el)) return;
    if (e.cancelable) e.preventDefault();
  };

  // iOS Safari fallback: pointer events가 발화 안 되는 경우 touch events로 대체.
  // 같은 핸들러 로직 재사용 — PointerEvent와 TouchEvent를 공통 인터페이스로 처리.
  interface PointLike { clientX: number; clientY: number; pointerId: number; pointerType: string; isPrimary: boolean; composedPath(): EventTarget[] }
  function touchToPointLike(e: TouchEvent, t: Touch): PointLike {
    return {
      clientX: t.clientX,
      clientY: t.clientY,
      pointerId: t.identifier,
      pointerType: 'touch',
      isPrimary: true,
      composedPath: () => e.composedPath(),
    };
  }
  const onTouchMove = (e: TouchEvent) => {
     
    if (!active) return;
    const t = e.touches[0];
    if (!t) return;
    onPointerMove(touchToPointLike(e, t) as unknown as PointerEvent);
  };
  const onTouchEnd = (e: TouchEvent) => {
     
    if (!active) return;
    const t = e.changedTouches[0];
    if (!t) { onPointerUp(); return; }
    onPointerUp(touchToPointLike(e, t) as unknown as PointerEvent);
  };

  // document 레벨 touchmove 차단 제거 — iOS에서 touchmove preventDefault가
  // pointer events 발화를 막는 현상 의심 (드래그 무반응 버그).
  // iOS 네이티브 scroll fight는 host의 touch-action:none + touchmove 로컬 block으로 대응.

  // pointerdown은 host 기준 (isTrackEvent 필터 통과 시 active=true).
  // move/up은 document 기준 — host 경계 밖으로 드리프트해도 capture 유지.
  el.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onUpEvt);
  document.addEventListener('pointercancel', onCancelEvt);
  el.addEventListener('touchstart', onTouchStart, { passive: false });
  // iOS fallback: touch events로 동일 흐름 구동 (pointer events 미발화 대응).
  document.addEventListener('touchmove', onTouchMove, { passive: true });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
  document.addEventListener('touchcancel', onTouchEnd, { passive: true });
  const onWinResize = () => { if (!active) refreshRect(); };
  window.addEventListener('resize', onWinResize, { passive: true });

  return {
    dispose() {
      el.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onUpEvt);
      document.removeEventListener('pointercancel', onCancelEvt);
      el.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
      window.removeEventListener('resize', onWinResize);
    },
  };
}
