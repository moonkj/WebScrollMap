import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSearchPanel, type SearchPanelApi } from '@ui/searchPanel';
import type { SearchHit } from '@core/searchIndex';

function makeShadowRoot(): ShadowRoot {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host.attachShadow({ mode: 'open' });
}

function makeApi(overrides: Partial<SearchPanelApi> = {}): SearchPanelApi {
  return {
    search: vi.fn(() => [] as SearchHit[]),
    onNavigate: vi.fn(),
    onHitsChanged: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('createSearchPanel — open/close', () => {
  it('starts closed', () => {
    const root = makeShadowRoot();
    const ctrl = createSearchPanel(root, 'light', makeApi());
    expect(ctrl.isOpen()).toBe(false);
    const panel = root.querySelector('[role="search"]') as HTMLElement;
    expect(panel.style.display).toBe('none');
    ctrl.dispose();
  });

  it('open() makes panel visible, focuses input, resets hits', () => {
    const root = makeShadowRoot();
    const api = makeApi();
    const ctrl = createSearchPanel(root, 'light', api);
    ctrl.open();
    expect(ctrl.isOpen()).toBe(true);
    const panel = root.querySelector('[role="search"]') as HTMLElement;
    expect(panel.style.display).toBe('flex');
    expect(api.onHitsChanged).toHaveBeenCalledWith([]);
    ctrl.dispose();
  });

  it('close() hides panel and calls onClose', () => {
    const root = makeShadowRoot();
    const api = makeApi();
    const ctrl = createSearchPanel(root, 'light', api);
    ctrl.open();
    ctrl.close();
    const panel = root.querySelector('[role="search"]') as HTMLElement;
    expect(panel.style.display).toBe('none');
    expect(api.onClose).toHaveBeenCalled();
    expect(ctrl.isOpen()).toBe(false);
    ctrl.dispose();
  });

  it('open() twice is idempotent', () => {
    const root = makeShadowRoot();
    const api = makeApi();
    const ctrl = createSearchPanel(root, 'light', api);
    ctrl.open();
    ctrl.open();
    // onHitsChanged([]) called only once for open transitions.
    const resetCalls = (api.onHitsChanged as any).mock.calls.filter((c: any[]) => Array.isArray(c[0]) && c[0].length === 0);
    expect(resetCalls.length).toBe(1);
    ctrl.dispose();
  });
});

describe('createSearchPanel — search debounce + navigation', () => {
  it('debounces input and calls search + navigates to first hit', () => {
    vi.useFakeTimers();
    const root = makeShadowRoot();
    const hits: SearchHit[] = [{ y: 100 }, { y: 200 }, { y: 300 }];
    const api = makeApi({ search: vi.fn(() => hits) });
    const ctrl = createSearchPanel(root, 'light', api);
    ctrl.open();
    const input = root.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'foo';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    // Before debounce, search not called (except for open() internal reset).
    expect(api.search).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(api.search).toHaveBeenCalledWith('foo');
    expect(api.onNavigate).toHaveBeenCalledWith(100);
    expect(api.onHitsChanged).toHaveBeenCalledWith(hits);
    ctrl.dispose();
  });

  it('Enter navigates next, Shift+Enter navigates prev (wraps)', () => {
    vi.useFakeTimers();
    const root = makeShadowRoot();
    const hits: SearchHit[] = [{ y: 100 }, { y: 200 }];
    const api = makeApi({ search: vi.fn(() => hits) });
    const ctrl = createSearchPanel(root, 'light', api);
    ctrl.open();
    const input = root.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'bar';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(150);
    // initial navigate on hit 0 (y=100)
    expect(api.onNavigate).toHaveBeenLastCalledWith(100);
    // Enter → idx 1
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(api.onNavigate).toHaveBeenLastCalledWith(200);
    // Enter again wraps to idx 0
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(api.onNavigate).toHaveBeenLastCalledWith(100);
    // Shift+Enter → idx 1
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true }));
    expect(api.onNavigate).toHaveBeenLastCalledWith(200);
    ctrl.dispose();
  });

  it('Escape closes the panel', () => {
    const root = makeShadowRoot();
    const api = makeApi();
    const ctrl = createSearchPanel(root, 'light', api);
    ctrl.open();
    const input = root.querySelector('input[type="search"]') as HTMLInputElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(ctrl.isOpen()).toBe(false);
    expect(api.onClose).toHaveBeenCalled();
    ctrl.dispose();
  });

  it('prev/next buttons step through hits', () => {
    vi.useFakeTimers();
    const root = makeShadowRoot();
    const hits: SearchHit[] = [{ y: 10 }, { y: 20 }, { y: 30 }];
    const api = makeApi({ search: vi.fn(() => hits) });
    const ctrl = createSearchPanel(root, 'light', api);
    ctrl.open();
    const input = root.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'x';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(150);
    const buttons = root.querySelectorAll('button');
    // Order: prev(↑), next(↓), close(✕)
    const prev = buttons[0] as HTMLButtonElement;
    const next = buttons[1] as HTMLButtonElement;
    next.dispatchEvent(new Event('click', { bubbles: true }));
    expect(api.onNavigate).toHaveBeenLastCalledWith(20);
    prev.dispatchEvent(new Event('click', { bubbles: true }));
    expect(api.onNavigate).toHaveBeenLastCalledWith(10);
    ctrl.dispose();
  });

  it('count shows "0" when query >= 2 chars but no hits', () => {
    vi.useFakeTimers();
    const root = makeShadowRoot();
    const api = makeApi({ search: vi.fn(() => []) });
    const ctrl = createSearchPanel(root, 'light', api);
    ctrl.open();
    const input = root.querySelector('input[type="search"]') as HTMLInputElement;
    input.value = 'ab';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(150);
    const count = root.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(count.textContent).toBe('0');
    ctrl.dispose();
  });

  it('close button closes the panel', () => {
    const root = makeShadowRoot();
    const api = makeApi();
    const ctrl = createSearchPanel(root, 'light', api);
    ctrl.open();
    const closeBtn = root.querySelectorAll('button')[2] as HTMLButtonElement;
    closeBtn.dispatchEvent(new Event('click', { bubbles: true }));
    expect(ctrl.isOpen()).toBe(false);
    ctrl.dispose();
  });
});

describe('createSearchPanel — dispose', () => {
  it('removes panel from shadow root', () => {
    const root = makeShadowRoot();
    const ctrl = createSearchPanel(root, 'dark', makeApi());
    expect(root.querySelector('[role="search"]')).toBeTruthy();
    ctrl.dispose();
    expect(root.querySelector('[role="search"]')).toBeNull();
  });
});
