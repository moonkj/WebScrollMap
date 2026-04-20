// Pro 잠김 토스트. 모달은 과함 (UX 권고).
// 하단 중앙에 3초 표시, 탭 시 popup을 열기 유도.

import type { Disposable } from '@core/types';

export interface UpgradeToastApi extends Disposable {
  show(message: string): void;
}

export function createUpgradeToast(root: ShadowRoot, scheme: 'light' | 'dark'): UpgradeToastApi {
  const doc = root.ownerDocument ?? document;
  const el = doc.createElement('div');
  el.className = 'wsm-upgrade-toast';
  el.style.cssText = [
    'position: fixed',
    'left: 50%',
    'bottom: calc(env(safe-area-inset-bottom, 0px) + 24px)',
    'transform: translateX(-50%) translateY(20px)',
    'padding: 10px 16px',
    'border-radius: 24px',
    'font: 500 13px -apple-system, system-uisans-serif',
    'letter-spacing: 0.01em',
    'opacity: 0',
    'transition: opacity 180ms ease-out, transform 180ms ease-out',
    'pointer-events: none',
    'z-index: 4',
    'white-space: nowrap',
    'max-width: 90vw',
    scheme === 'dark'
      ? 'background: rgba(249,115,22,0.95); color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,0.4)'
      : 'background: rgba(249,115,22,1); color: #fff; box-shadow: 0 8px 24px rgba(249,115,22,0.4)',
  ].join(';');
  root.appendChild(el);

  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  return {
    show(message) {
      el.textContent = message;
      el.style.opacity = '1';
      el.style.transform = 'translateX(-50%) translateY(0)';
      if (hideTimer !== null) clearTimeout(hideTimer);
      // 메시지 길이 기반 동적 duration — 짧은 문장 2.4s, 긴 프랑스어/힌디어 최대 5s.
      // base 2400ms + 문자당 30ms, [2400, 5000] clamp.
      const ms = Math.min(5000, Math.max(2400, 2400 + message.length * 30));
      hideTimer = setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateX(-50%) translateY(20px)';
      }, ms);
    },
    dispose() {
      if (hideTimer !== null) clearTimeout(hideTimer);
      el.remove();
    },
  };
}
