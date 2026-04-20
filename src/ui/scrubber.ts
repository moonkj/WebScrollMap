// RAF throttle + passive touch. scrollTo 즉시 모드 (D6).
// H1 엣지 스와이프: 엣지 0~EDGE_MARGIN 영역은 브라우저 제스처에 양보 (EDGE_MARGIN=16).

import { TUNING } from '@config/tuning';
import { snapToAnchor } from '@core/snap';
import type { Disposable } from '@core/types';

export const SNAP_THRESHOLD = TUNING.snapThresholdPx;
export const EDGE_MARGIN = TUNING.edgeMarginPx;
export const LONG_PRESS_MS = 500;
// iOS 터치 흔들림 현실 반영: 10px 이내는 같은 지점으로 간주.
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
}

// 이벤트가 실제 미니맵 track(.wsm-track) 위에서 발생했는지 확인.
// 플로팅 패널/검색 패널 등 shadow 내 다른 UI에 대한 터치는 스크러버를 건너뛴다.
function isTrackEvent(e: Event): boolean {
  const path = e.composedPath();
  for (const n of path) {
    if (n instanceof Element && n.classList && n.classList.contains('wsm-track')) {
      return true;
    }
  }
  return false;
}

// iOS 터치 좌표는 ±1~2px jitter가 있음. 긴 페이지(docH 20,000+)에서 이 노이즈가
// 20배 증폭돼 "따닥따닥" 현상 발생. 아래 임계로 흡수.
const JITTER_PX = 2;

export function createScrubber(el: HTMLElement, api: ScrubberApi): Disposable {
  let ticking = false;
  let pendingY: number | null = null;
  let lastAppliedClientY = Number.NEGATIVE_INFINITY;
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
  // Double tap 감지
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
    const w = window.innerWidth;
    return clientX > w - EDGE_MARGIN;
  }

  // 탭/스크럽용: pct × maxScroll 스크롤 좌표. setScrollY에 직접 전달.
  // 결과: indicator 중심이 탭 위치와 정렬 (min-height 적용 후에도 유지).
  function mapEventToY(clientY: number): number {
    const h = cachedRect.height || 1;
    const pct = Math.max(0, Math.min(1, (clientY - cachedRect.top) / h));
    const docH = api.getDocHeight();
    const vpH = api.getViewportHeight();
    const maxScroll = Math.max(0, docH - vpH);
    return pct * maxScroll;
  }

  // 핀용: 문서 좌표 (pct × docH). 렌더러가 y/docH*100%로 마커 배치하므로
  // 누른 바 위치와 마커가 정확 일치.
  function mapEventToDocY(clientY: number): number {
    const h = cachedRect.height || 1;
    const pct = Math.max(0, Math.min(1, (clientY - cachedRect.top) / h));
    return pct * api.getDocHeight();
  }

  // 스크럽 중엔 snap 없이 자유 스크롤 (사용자 피드백: "작은 움직임이 같은 위치 왔다갔다")
  // 스냅은 pointerup(손 뗄 때)에만 적용 → applyFinalSnap
  function applyScroll() {
    if (pendingY === null) {
      ticking = false;
      return;
    }
    // 정수 픽셀로 반올림 → 브라우저 반올림 차이로 인한 왕복 제거
    api.scrollTo(Math.round(pendingY));
    pendingY = null;
    ticking = false;
  }

  function applyFinalSnap(clientY: number) {
    const docY = mapEventToY(clientY);
    const candidates = api.snapCandidates();
    const snapped = snapToAnchor(docY, candidates);
    if (snapped.snapped) {
      api.onHaptic?.('snap');
    }
    api.scrollTo(snapped.y);
  }

  function onPointerDown(e: PointerEvent) {
    // 플로팅 패널/검색 패널 등 track이 아닌 shadow 요소에 대한 포인터는 무시
    if (!isTrackEvent(e)) return;
    if (e.pointerType === 'touch' && inEdgeZone(e.clientX)) {
      // 엣지 양보 (뒤로가기 제스처 우선)
      api.onHaptic?.('edge');
      return;
    }
    active = true;
    moved = false;
    longPressFired = false;
    longPressDownX = e.clientX;
    longPressDownY = e.clientY;
    lastAppliedClientY = Number.NEGATIVE_INFINITY; // 새 제스처는 jitter 필터 리셋
    refreshRect();
    api.onStateChange?.('scrubbing');
    api.onMagnify?.(e.clientY, mapEventToY(e.clientY));
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // pointerId invalid — ignore
    }

    // Long-press for Pin Drop: pin 후보 기간엔 scroll 보류 (Sev1 fix).
    // 움직이지 않고 타이머 만료 → pin. 움직이면 scrub 전환 + gate 해제.
    if (api.onLongPress) {
      scrollGated = true;
      // 핀은 문서 좌표 — 렌더러 마커와 정확 일치.
      const targetDocY = mapEventToDocY(e.clientY);
      longPressTimer = setTimeout(() => {
        longPressTimer = null;
        longPressFired = true;
        api.onHaptic?.('pin');
        api.onLongPress?.(targetDocY);
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
    const mdx = e.clientX - longPressDownX;
    const mdy = e.clientY - longPressDownY;
    if (Math.hypot(mdx, mdy) > DOUBLE_TAP_MOVE_TOLERANCE_PX) moved = true;
    if (longPressFired) return; // pin fired; don't also scrub
    if (scrollGated) return;
    // iOS 터치 jitter 흡수: 이전 적용 clientY에서 JITTER_PX 미만이면 무시
    if (Math.abs(e.clientY - lastAppliedClientY) < JITTER_PX) return;
    lastAppliedClientY = e.clientY;
    pendingY = mapEventToY(e.clientY);
    api.onMagnify?.(e.clientY, pendingY);
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
    // 스크럽 종료 시 마지막 위치 스냅 (드래그 중엔 자유 스크롤이었음)
    if (e && !longPressFired && !scrollGated) {
      applyFinalSnap(e.clientY);
    }
    // Double-tap 감지: 움직이지 않은 짧은 탭이 연속 2번 + 핀 미발화
    if (e && !moved && !longPressFired) {
      const now = performance.now();
      const dx = Math.abs(e.clientX - lastTapX);
      const dy = Math.abs(e.clientY - lastTapY);
      if (
        now - lastTapAt < DOUBLE_TAP_MS &&
        dx < DOUBLE_TAP_MOVE_TOLERANCE_PX * 2 &&
        dy < DOUBLE_TAP_MOVE_TOLERANCE_PX * 4
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
  // iOS: touchstart preventDefault로 네이티브 텍스트 선택/콜아웃 차단. passive:false 필수.
  // track에서만 막음 — 플로팅 패널/검색 패널에서의 탭은 그대로 통과.
  const onTouchStart = (e: TouchEvent) => {
    if (!isTrackEvent(e)) return;
    if (e.cancelable) e.preventDefault();
  };
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointermove', onPointerMove);
  el.addEventListener('pointerup', onUpEvt);
  el.addEventListener('pointercancel', onCancelEvt);
  el.addEventListener('touchstart', onTouchStart, { passive: false });
  el.addEventListener('touchmove', onTouchStart, { passive: false });
  window.addEventListener('resize', refreshRect, { passive: true });

  return {
    dispose() {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onUpEvt);
      el.removeEventListener('pointercancel', onCancelEvt);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchStart);
      window.removeEventListener('resize', refreshRect);
    },
  };
}
