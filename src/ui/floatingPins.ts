// 플로팅 핀 메모장: 페이지 위에 떠있는 핀 리스트.
// - 핀 있을 때 자동 노출, 없으면 자동 숨김.
// - 바 반대편 bottom에 고정 (clutter 최소화).
// - 탭 = 점프, × = 개별 삭제, 상단 ─ 버튼 = 최소화/재확장.
// - 최소화 상태: 작은 원형 핀 아이콘 + 카운트.

import type { Disposable, Pin } from '@core/types';

export interface FloatingPinsApi extends Disposable {
  update(pins: ReadonlyArray<Pin>, docHeight: number): void;
  setSide(side: 'left' | 'right'): void;
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
  ].join(';');
  const title = doc.createElement('span');
  title.textContent = '핀';
  title.style.cssText = 'font-weight: 600; font-size: 12px; letter-spacing: 0.02em;';
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

  // 최소화 상태 원형 버튼
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
    'cursor: pointer',
    'box-shadow: 0 4px 12px rgba(249,115,22,0.4)',
    'display: none',
    'align-items: center',
    'justify-content: center',
  ].join(';');

  wrapper.append(panel, bubble);
  root.appendChild(wrapper);

  function applySide() {
    // 바 반대편 bottom 코너
    const horizontal = side === 'right' ? 'left' : 'right';
    wrapper.style.setProperty('left', side === 'right' ? '16px' : 'auto');
    wrapper.style.setProperty('right', side === 'right' ? 'auto' : '16px');
    void horizontal;
  }
  applySide();

  function render(pins: ReadonlyArray<Pin>, docHeight: number) {
    list.textContent = '';
    const cap = docHeight > 0 ? docHeight : 1;
    pins.forEach((p, i) => {
      const li = doc.createElement('li');
      li.style.cssText = [
        'display: flex',
        'align-items: center',
        'gap: 8px',
        'padding: 6px 8px',
        'border-radius: 6px',
        'cursor: pointer',
      ].join(';');

      const dot = doc.createElement('span');
      dot.style.cssText = `flex:0 0 auto;width:10px;height:10px;border-radius:50%;background:${p.color ?? 'rgba(249,115,22,1)'};box-shadow:0 0 6px ${p.color ?? 'rgba(249,115,22,0.6)'};`;

      const info = doc.createElement('span');
      info.style.cssText = 'flex:1;font-variant-numeric:tabular-nums;font-size:12px;';
      const pct = Math.round((p.y / cap) * 100);
      info.textContent = `#${i + 1} · ${pct}%`;

      const del = doc.createElement('button');
      del.type = 'button';
      del.setAttribute('aria-label', `Delete pin ${i + 1}`);
      del.textContent = '×';
      del.style.cssText = [
        'appearance: none',
        'background: transparent',
        'border: 0',
        'color: inherit',
        'opacity: 0.55',
        'cursor: pointer',
        'padding: 2px 6px',
        'border-radius: 4px',
        'font: 14px -apple-system, system-ui, sans-serif',
      ].join(';');
      del.addEventListener('click', (e) => {
        e.stopPropagation();
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
  bubble.addEventListener('click', () => {
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
    dispose() {
      wrapper.remove();
    },
  };
}
