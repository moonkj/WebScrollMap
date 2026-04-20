// 플로팅 핀 메모장: 페이지 위에 떠있는 핀 리스트.
// - 핀 있을 때 자동 노출, 없으면 자동 숨김.
// - 바 반대편 bottom에 고정 (clutter 최소화).
// - 탭 = 점프, × = 개별 삭제, 상단 ─ 버튼 = 최소화/재확장.
// - 최소화 상태: 작은 원형 핀 아이콘 + 카운트.

import type { Disposable, Pin } from '@core/types';

export interface FloatingPinsApi extends Disposable {
  update(pins: ReadonlyArray<Pin>, docHeight: number): void;
  setSide(side: 'left' | 'right'): void;
  /** 40 | 70 | 100 — 투명도 백분율. Shadow host 내 wrapper opacity에 적용. */
  setOpacity(pct: number): void;
}

export interface FloatingPinsOpts {
  side: 'left' | 'right';
  scheme: 'light' | 'dark';
  onJump(pin: Pin): void;
  onDelete(pinId: string): void;
}

function styleFor(scheme: 'light' | 'dark'): string {
  if (scheme === 'dark') {
    return [
      'background: rgba(15,23,42,0.94)',
      'color: #f8fafc',
      'border: 1px solid #1f2a3d',
    ].join(';');
  }
  return [
    'background: rgba(255,255,255,0.96)',
    'color: #0f172a',
    'border: 1px solid #e2e8f0',
  ].join(';');
}

export function createFloatingPins(root: ShadowRoot, opts: FloatingPinsOpts): FloatingPinsApi {
  const doc = root.ownerDocument ?? document;
  let side = opts.side;
  let minimized = false;
  let lastCount = 0;

  const wrapper = doc.createElement('div');
  wrapper.className = 'wsm-floating-pins';
  wrapper.style.cssText = [
    'position: fixed',
    'bottom: calc(env(safe-area-inset-bottom, 0px) + 80px)', // iOS Safari 하단 툴바 회피
    'z-index: 3',
    'font: 12px -apple-system, system-ui, sans-serif',
    'pointer-events: auto',
    'display: none',
    'user-select: none',
    '-webkit-user-select: none',
    '-webkit-touch-callout: none',
  ].join(';');

  // 확장 상태 패널
  const panel = doc.createElement('div');
  panel.className = 'wsm-fp-panel';
  panel.style.cssText = [
    styleFor(opts.scheme),
    'border-radius: 12px',
    'box-shadow: 0 6px 20px rgba(0,0,0,0.25)',
    'width: 180px',
    'max-height: 260px',
    'overflow: hidden',
    'display: flex',
    'flex-direction: column',
  ].join(';');

  const header = doc.createElement('div');
  header.className = 'wsm-fp-header';
  header.style.cssText = [
    'display: flex',
    'align-items: center',
    'justify-content: space-between',
    'padding: 8px 10px',
    'border-bottom: 1px solid currentColor',
    'opacity: 0.95',
    'gap: 6px',
    'cursor: move',
    'touch-action: none',
    '-webkit-user-select: none',
    'user-select: none',
  ].join(';');
  const title = doc.createElement('span');
  title.textContent = '⋮⋮ 핀';
  title.style.cssText = 'font-weight: 600; font-size: 12px; letter-spacing: 0.02em; pointer-events: none;';
  const minBtn = doc.createElement('button');
  minBtn.type = 'button';
  minBtn.setAttribute('aria-label', 'Minimize');
  minBtn.textContent = '—';
  minBtn.style.cssText = [
    'appearance: none',
    'background: transparent',
    'border: 0',
    'color: inherit',
    'cursor: pointer',
    'font: inherit',
    'opacity: 0.7',
    'padding: 2px 6px',
    'border-radius: 4px',
  ].join(';');
  header.append(title, minBtn);

  const list = doc.createElement('ul');
  list.className = 'wsm-fp-list';
  list.style.cssText = [
    'list-style: none',
    'margin: 0',
    'padding: 4px 4px',
    'overflow-y: auto',
    'flex: 1',
  ].join(';');

  panel.append(header, list);

  // 최소화 상태 원형 버튼 — 드래그 가능 (버블 탭=확장, 드래그=이동)
  const bubble = doc.createElement('button');
  bubble.type = 'button';
  bubble.className = 'wsm-fp-bubble';
  bubble.setAttribute('aria-label', 'Expand pins');
  bubble.style.cssText = [
    'appearance: none',
    'border: 0',
    'width: 44px',
    'height: 44px',
    'border-radius: 50%',
    'background: rgba(249,115,22,1)',
    'color: #fff',
    'font: 700 13px -apple-system, system-ui, sans-serif',
    'cursor: move',
    'box-shadow: 0 4px 12px rgba(249,115,22,0.4)',
    'display: none',
    'align-items: center',
    'justify-content: center',
    'touch-action: none',
    '-webkit-user-select: none',
    'user-select: none',
  ].join(';');

  wrapper.append(panel, bubble);
  root.appendChild(wrapper);

  // 사용자 드래그 위치 저장 (세션 단위).
  let userDraggedPos: { top: number; left: number } | null = null;
  const STORAGE_KEY = 'wsm:fp:pos:v1';
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.top === 'number' && typeof parsed.left === 'number') {
        userDraggedPos = parsed;
      }
    }
  } catch {
    // noop
  }

  function clampToViewport(top: number, left: number): { top: number; left: number } {
    const w = wrapper.offsetWidth || 200;
    const h = wrapper.offsetHeight || 100;
    const maxLeft = Math.max(0, window.innerWidth - w - 4);
    const maxTop = Math.max(0, window.innerHeight - h - 4);
    return {
      top: Math.max(4, Math.min(maxTop, top)),
      left: Math.max(4, Math.min(maxLeft, left)),
    };
  }

  function applyDraggedPos() {
    if (!userDraggedPos) return;
    const c = clampToViewport(userDraggedPos.top, userDraggedPos.left);
    wrapper.style.setProperty('top', `${c.top}px`);
    wrapper.style.setProperty('left', `${c.left}px`);
    wrapper.style.setProperty('right', 'auto');
    wrapper.style.setProperty('bottom', 'auto');
  }

  function applySide() {
    if (userDraggedPos) {
      applyDraggedPos();
      return;
    }
    // 기본: 바 반대편 bottom 코너
    wrapper.style.setProperty('bottom', 'calc(env(safe-area-inset-bottom, 0px) + 80px)');
    wrapper.style.setProperty('top', 'auto');
    wrapper.style.setProperty('left', side === 'right' ? '16px' : 'auto');
    wrapper.style.setProperty('right', side === 'right' ? 'auto' : '16px');
  }
  applySide();

  // 헤더 드래그 처리.
  let dragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let startTop = 0;
  let startLeft = 0;
  let dragPointerId: number | null = null;

  function onHeaderPointerDown(e: PointerEvent) {
    // 삭제/최소화 버튼에서 시작된 경우는 드래그 시작하지 않음.
    const target = e.target as HTMLElement | null;
    if (target && target.tagName === 'BUTTON') return;
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const rect = wrapper.getBoundingClientRect();
    startTop = rect.top;
    startLeft = rect.left;
    // 즉시 top/left 기반으로 전환 (right/bottom 해제)
    wrapper.style.setProperty('top', `${startTop}px`);
    wrapper.style.setProperty('left', `${startLeft}px`);
    wrapper.style.setProperty('right', 'auto');
    wrapper.style.setProperty('bottom', 'auto');
    dragPointerId = e.pointerId;
    try {
      header.setPointerCapture(e.pointerId);
    } catch {
      // noop
    }
    e.preventDefault();
  }
  function onHeaderPointerMove(e: PointerEvent) {
    if (!dragging) return;
    if (dragPointerId !== null && e.pointerId !== dragPointerId) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    const c = clampToViewport(startTop + dy, startLeft + dx);
    wrapper.style.setProperty('top', `${c.top}px`);
    wrapper.style.setProperty('left', `${c.left}px`);
  }
  function onHeaderPointerUp() {
    if (!dragging) return;
    dragging = false;
    dragPointerId = null;
    // 현재 위치 저장
    const rect = wrapper.getBoundingClientRect();
    userDraggedPos = { top: rect.top, left: rect.left };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(userDraggedPos));
    } catch {
      // noop
    }
  }
  header.addEventListener('pointerdown', onHeaderPointerDown);
  header.addEventListener('pointermove', onHeaderPointerMove);
  header.addEventListener('pointerup', onHeaderPointerUp);
  header.addEventListener('pointercancel', onHeaderPointerUp);

  function render(pins: ReadonlyArray<Pin>, docHeight: number) {
    list.textContent = '';
    const cap = docHeight > 0 ? docHeight : 1;
    pins.forEach((p, i) => {
      const li = doc.createElement('li');
      li.style.cssText = [
        'display: flex',
        'align-items: center',
        'gap: 8px',
        'padding: 2px 2px 2px 8px', // 우측 패딩 축소 — × 버튼이 자체 패딩 보유
        'border-radius: 6px',
        'cursor: pointer',
        'touch-action: manipulation',
      ].join(';');

      const dot = doc.createElement('span');
      dot.style.cssText = `flex:0 0 auto;width:10px;height:10px;border-radius:50%;background:${p.color ?? 'rgba(249,115,22,1)'};box-shadow:0 0 6px ${p.color ?? 'rgba(249,115,22,0.6)'};`;

      const info = doc.createElement('span');
      info.style.cssText = 'flex:1;font-variant-numeric:tabular-nums;font-size:12px;min-width:0;';
      const pct = Math.round((p.y / cap) * 100);
      info.textContent = `#${i + 1} · ${pct}%`;

      const del = doc.createElement('button');
      del.type = 'button';
      del.setAttribute('aria-label', `Delete pin ${i + 1}`);
      del.textContent = '×';
      // 히트 영역 확장 — iOS HIG 권장 44pt 근접. li의 우측 영역 분명히 점유.
      del.style.cssText = [
        'appearance: none',
        'background: transparent',
        'border: 0',
        'color: inherit',
        'opacity: 0.85',
        'cursor: pointer',
        'padding: 10px 12px',
        'border-radius: 6px',
        'font: 18px -apple-system, system-ui, sans-serif',
        'line-height: 1',
        'min-width: 40px',
        'min-height: 40px',
        'display: flex',
        'align-items: center',
        'justify-content: center',
        'touch-action: manipulation',
        'flex: 0 0 auto',
        'pointer-events: auto',
      ].join(';');

      // 포인터 단계부터 전파 차단 — li click (onJump) 침범 방지
      const stop = (e: Event) => e.stopPropagation();
      del.addEventListener('pointerdown', stop);
      del.addEventListener('pointerup', stop);
      del.addEventListener('touchstart', stop);
      del.addEventListener('touchend', stop);
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
        opts.onDelete(p.id);
      });

      li.append(dot, info, del);
      li.addEventListener('click', () => opts.onJump(p));
      list.appendChild(li);
    });
  }

  function renderBubble(count: number) {
    bubble.textContent = `📍 ${count}`;
  }

  function applyMinimized() {
    panel.style.display = minimized ? 'none' : 'flex';
    bubble.style.display = minimized ? 'flex' : 'none';
  }

  minBtn.addEventListener('click', () => {
    minimized = true;
    applyMinimized();
  });

  // Bubble 드래그 / 탭 구분
  let bubbleDragging = false;
  let bubbleMoved = false;
  let bubbleStartX = 0;
  let bubbleStartY = 0;
  let bubbleElStartTop = 0;
  let bubbleElStartLeft = 0;
  const BUBBLE_DRAG_THRESHOLD = 6;

  function onBubblePointerDown(e: PointerEvent) {
    bubbleDragging = true;
    bubbleMoved = false;
    bubbleStartX = e.clientX;
    bubbleStartY = e.clientY;
    const rect = wrapper.getBoundingClientRect();
    bubbleElStartTop = rect.top;
    bubbleElStartLeft = rect.left;
    try {
      bubble.setPointerCapture(e.pointerId);
    } catch {
      // noop
    }
  }
  function onBubblePointerMove(e: PointerEvent) {
    if (!bubbleDragging) return;
    const dx = e.clientX - bubbleStartX;
    const dy = e.clientY - bubbleStartY;
    if (!bubbleMoved && Math.hypot(dx, dy) > BUBBLE_DRAG_THRESHOLD) {
      bubbleMoved = true;
      wrapper.style.setProperty('top', `${bubbleElStartTop}px`);
      wrapper.style.setProperty('left', `${bubbleElStartLeft}px`);
      wrapper.style.setProperty('right', 'auto');
      wrapper.style.setProperty('bottom', 'auto');
    }
    if (bubbleMoved) {
      const c = clampToViewport(bubbleElStartTop + dy, bubbleElStartLeft + dx);
      wrapper.style.setProperty('top', `${c.top}px`);
      wrapper.style.setProperty('left', `${c.left}px`);
      e.preventDefault();
    }
  }
  function onBubblePointerUp() {
    if (!bubbleDragging) return;
    bubbleDragging = false;
    if (bubbleMoved) {
      const rect = wrapper.getBoundingClientRect();
      userDraggedPos = { top: rect.top, left: rect.left };
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(userDraggedPos));
      } catch {
        // noop
      }
    }
  }
  bubble.addEventListener('pointerdown', onBubblePointerDown);
  bubble.addEventListener('pointermove', onBubblePointerMove);
  bubble.addEventListener('pointerup', onBubblePointerUp);
  bubble.addEventListener('pointercancel', onBubblePointerUp);

  bubble.addEventListener('click', (e) => {
    // 드래그 후 발생한 click은 무시
    if (bubbleMoved) {
      bubbleMoved = false;
      e.preventDefault();
      return;
    }
    minimized = false;
    applyMinimized();
  });

  return {
    update(pins, docHeight) {
      const count = pins.length;
      // 첫 핀이 들어오면 자동으로 확장 상태로 등장
      if (lastCount === 0 && count > 0) {
        minimized = false;
        applyMinimized();
      }
      lastCount = count;
      if (count === 0) {
        wrapper.style.display = 'none';
        return;
      }
      wrapper.style.display = 'block';
      render(pins, docHeight);
      renderBubble(count);
    },
    setSide(next) {
      side = next;
      applySide();
    },
    setOpacity(pct) {
      const clamped = Math.max(20, Math.min(100, pct)) / 100;
      wrapper.style.setProperty('opacity', String(clamped));
    },
    dispose() {
      header.removeEventListener('pointerdown', onHeaderPointerDown);
      header.removeEventListener('pointermove', onHeaderPointerMove);
      header.removeEventListener('pointerup', onHeaderPointerUp);
      header.removeEventListener('pointercancel', onHeaderPointerUp);
      bubble.removeEventListener('pointerdown', onBubblePointerDown);
      bubble.removeEventListener('pointermove', onBubblePointerMove);
      bubble.removeEventListener('pointerup', onBubblePointerUp);
      bubble.removeEventListener('pointercancel', onBubblePointerUp);
      wrapper.remove();
    },
  };
}
