// Alt+click 수동 피커: 사용자가 내부 스크롤 컨테이너를 직접 선택.
// H5 자동 감지 실패 사이트용 폴백.

import type { Disposable } from '@core/types';

export interface ManualPickerApi {
  onPicked(el: HTMLElement): void;
}

const OUTLINE_STYLE_ID = 'wsm-picker-outline';

export function createManualPicker(api: ManualPickerApi): Disposable {
  let active = false;
  let currentTarget: HTMLElement | null = null;
  // Sev2 fix: 오래 활성되면 자동 취소 (10s)
  const AUTO_CANCEL_MS = 10_000;
  let autoTimer: ReturnType<typeof setTimeout> | null = null;

  function ensureStyle() {
    if (document.getElementById(OUTLINE_STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = OUTLINE_STYLE_ID;
    s.textContent = `.wsm-picker-hl { outline: 2px dashed #2563eb !important; outline-offset: -2px !important; }`;
    document.head.appendChild(s);
  }

  function highlight(el: HTMLElement | null) {
    if (currentTarget && currentTarget !== el) {
      currentTarget.classList.remove('wsm-picker-hl');
    }
    if (el) el.classList.add('wsm-picker-hl');
    currentTarget = el;
  }

  function onMouseMove(e: MouseEvent) {
    if (!active) return;
    const el = e.target instanceof HTMLElement ? e.target : null;
    highlight(el);
  }

  function onClick(e: MouseEvent) {
    if (!active) return;
    if (!e.altKey) return; // Alt 누르고 있어야 확정
    const el = e.target instanceof HTMLElement ? e.target : null;
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    deactivate();
    api.onPicked(el);
  }

  function onKey(e: KeyboardEvent) {
    if (!active) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      deactivate();
    }
  }

  function activate() {
    if (active) return;
    active = true;
    ensureStyle();
    document.addEventListener('mousemove', onMouseMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('blur', deactivate);
    autoTimer = setTimeout(() => {
      autoTimer = null;
      deactivate();
    }, AUTO_CANCEL_MS);
  }

  function deactivate() {
    active = false;
    highlight(null);
    if (autoTimer !== null) {
      clearTimeout(autoTimer);
      autoTimer = null;
    }
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('blur', deactivate);
  }

  activate();

  return {
    dispose: deactivate,
  };
}
