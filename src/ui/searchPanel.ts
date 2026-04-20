// 커스텀 검색 패널 (S7): 사용자가 명시적으로 연 경우만 검색 수행. Cmd+F 훅 금지.
// 기본 단축키: Cmd+Shift+F / Ctrl+Shift+F. Esc로 닫힘.

import type { Disposable } from '@core/types';
import type { SearchHit } from '@core/searchIndex';

export interface SearchPanelApi {
  search(query: string): SearchHit[];
  onNavigate(y: number): void;
  onHitsChanged(hits: ReadonlyArray<SearchHit>): void;
  onClose(): void;
}

export interface SearchPanelController extends Disposable {
  open(): void;
  close(): void;
  isOpen(): boolean;
}

export function createSearchPanel(
  root: ShadowRoot,
  scheme: 'light' | 'dark',
  api: SearchPanelApi,
): SearchPanelController {
  const doc = root.ownerDocument ?? document;
  const panel = doc.createElement('div');
  panel.setAttribute('role', 'search');
  panel.setAttribute('aria-label', 'WebScrollMap search');
  panel.style.cssText = [
    'position: fixed',
    'top: 16px',
    'right: 16px',
    'left: auto',
    'display: none',
    'align-items: center',
    'gap: 6px',
    'padding: 6px 8px',
    'border-radius: 8px',
    scheme === 'dark'
      ? 'background: rgba(15,23,42,0.96); color: #f8fafc; border: 1px solid #1f2a3d'
      : 'background: #ffffff; color: #0f172a; border: 1px solid #e2e8f0',
    'box-shadow: 0 4px 12px rgba(15,23,42,0.15)',
    'font: 13px -apple-system, system-ui, sans-serif',
    'pointer-events: auto',
    'z-index: 2',
  ].join(';');

  const input = doc.createElement('input');
  input.type = 'search';
  input.placeholder = 'Search (WebScrollMap)';
  input.setAttribute('aria-label', 'Search text');
  input.autocomplete = 'off';
  input.style.cssText = [
    'appearance: none',
    'border: 0',
    'outline: none',
    'background: transparent',
    'color: inherit',
    'min-width: 180px',
    'font: inherit',
    'padding: 2px 4px',
  ].join(';');

  const count = doc.createElement('span');
  count.setAttribute('aria-live', 'polite');
  count.style.cssText = 'font-variant-numeric: tabular-nums; color: currentColor; opacity: 0.6; min-width: 50px; text-align: right;';

  const prev = doc.createElement('button');
  prev.type = 'button';
  prev.textContent = '↑';
  prev.setAttribute('aria-label', 'Previous match');
  const next = doc.createElement('button');
  next.type = 'button';
  next.textContent = '↓';
  next.setAttribute('aria-label', 'Next match');
  const closeBtn = doc.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Close');
  for (const b of [prev, next, closeBtn]) {
    b.style.cssText = [
      'appearance: none',
      'background: transparent',
      'border: 1px solid currentColor',
      'color: inherit',
      'opacity: 0.7',
      'border-radius: 4px',
      'padding: 2px 6px',
      'cursor: pointer',
      'font: inherit',
    ].join(';');
  }

  panel.append(input, count, prev, next, closeBtn);
  root.appendChild(panel);

  let hits: SearchHit[] = [];
  let idx = -1;
  let open = false;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function updateCount() {
    if (hits.length === 0) count.textContent = input.value.trim().length >= 2 ? '0' : '';
    else count.textContent = `${idx + 1}/${hits.length}`;
  }

  function doSearch() {
    hits = api.search(input.value);
    idx = hits.length > 0 ? 0 : -1;
    api.onHitsChanged(hits);
    updateCount();
    if (idx >= 0) api.onNavigate(hits[idx]!.y);
  }

  function step(delta: number) {
    if (hits.length === 0) return;
    idx = (idx + delta + hits.length) % hits.length;
    updateCount();
    api.onNavigate(hits[idx]!.y);
  }

  input.addEventListener('input', () => {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(doSearch, 120);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) step(-1);
      else step(+1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePanel();
    }
  });
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(+1));
  closeBtn.addEventListener('click', () => closePanel());

  // iOS Safari: URL bar가 스크롤에 따라 축소/확장되어 fixed 요소를 덮는 경우가 있음.
  // visualViewport.offsetTop + offsetLeft + height을 기준으로 동적 재배치.
  function reposition() {
    const vv = window.visualViewport;
    const offsetTop = vv ? vv.offsetTop : 0;
    const pageOffsetY = window.scrollY || 0;
    panel.style.top = `${offsetTop + 16}px`;
    // page 스크롤이 크고 fixed가 layout viewport 기준일 때 보정
    if (vv && Math.abs(vv.offsetTop - pageOffsetY) > 1) {
      // nothing more, offsetTop 이미 반영됨
    }
  }

  // Sev2 fix: 패널 밖 클릭 시 닫힘
  function onOutsideDown(e: PointerEvent) {
    if (!open) return;
    const path = e.composedPath();
    if (!path.includes(panel)) closePanel();
  }

  const onVvChange = () => reposition();
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', onVvChange);
    window.visualViewport.addEventListener('scroll', onVvChange);
  }

  function openPanel() {
    if (open) return;
    open = true;
    panel.style.display = 'flex';
    reposition(); // 열 때 현재 visualViewport 기준으로 고정
    input.value = '';
    hits = [];
    idx = -1;
    api.onHitsChanged([]);
    updateCount();
    input.focus();
    doc.addEventListener('pointerdown', onOutsideDown, true);
  }

  function closePanel() {
    if (!open) return;
    open = false;
    panel.style.display = 'none';
    hits = [];
    idx = -1;
    api.onHitsChanged([]);
    api.onClose();
    doc.removeEventListener('pointerdown', onOutsideDown, true);
  }

  return {
    open: openPanel,
    close: closePanel,
    isOpen: () => open,
    dispose() {
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      doc.removeEventListener('pointerdown', onOutsideDown, true);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', onVvChange);
        window.visualViewport.removeEventListener('scroll', onVvChange);
      }
      panel.remove();
    },
  };
}
