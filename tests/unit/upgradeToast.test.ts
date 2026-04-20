import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { createUpgradeToast } from '@ui/upgradeToast';

function mkRoot(): ShadowRoot {
  document.body.innerHTML = '';
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host.attachShadow({ mode: 'open' });
}

describe('createUpgradeToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('mounts a toast element into shadow root with light scheme', () => {
    const root = mkRoot();
    const api = createUpgradeToast(root, 'light');
    const el = root.querySelector('.wsm-upgrade-toast') as HTMLElement;
    expect(el).toBeTruthy();
    expect(el.style.opacity).toBe('0');
    expect(el.style.cssText.replace(/\s+/g, '')).toContain('rgba(249,115,22,1)');
    api.dispose();
  });

  it('mounts a toast element with dark scheme styling', () => {
    const root = mkRoot();
    const api = createUpgradeToast(root, 'dark');
    const el = root.querySelector('.wsm-upgrade-toast') as HTMLElement;
    expect(el.style.cssText.replace(/\s+/g, '')).toContain('rgba(249,115,22,0.95)');
    api.dispose();
  });

  it('show() sets textContent and opacity 1', () => {
    const root = mkRoot();
    const api = createUpgradeToast(root, 'light');
    api.show('Upgrade to Pro');
    const el = root.querySelector('.wsm-upgrade-toast') as HTMLElement;
    expect(el.textContent).toBe('Upgrade to Pro');
    expect(el.style.opacity).toBe('1');
    expect(el.style.transform).toBe('translateX(-50%) translateY(0)');
    api.dispose();
  });

  it('show() auto-hides after dynamic duration (min 2400ms + 30ms/char, ≤5000ms)', () => {
    const root = mkRoot();
    const api = createUpgradeToast(root, 'light');
    api.show('hello'); // 5 chars → 2400 + 150 = 2550ms
    const el = root.querySelector('.wsm-upgrade-toast') as HTMLElement;
    expect(el.style.opacity).toBe('1');
    vi.advanceTimersByTime(2400);
    // 아직 2550ms 전 → visible
    expect(el.style.opacity).toBe('1');
    vi.advanceTimersByTime(200); // 총 2600ms → 숨김
    expect(el.style.opacity).toBe('0');
    expect(el.style.transform).toBe('translateX(-50%) translateY(20px)');
    api.dispose();
  });

  it('show() does not hide before 2400ms elapses', () => {
    const root = mkRoot();
    const api = createUpgradeToast(root, 'light');
    api.show('hello');
    const el = root.querySelector('.wsm-upgrade-toast') as HTMLElement;
    vi.advanceTimersByTime(2000);
    expect(el.style.opacity).toBe('1');
    api.dispose();
  });

  it('multiple show() calls reset hide timer', () => {
    const root = mkRoot();
    const api = createUpgradeToast(root, 'light');
    api.show('first');
    vi.advanceTimersByTime(2000);
    api.show('second');
    const el = root.querySelector('.wsm-upgrade-toast') as HTMLElement;
    expect(el.textContent).toBe('second');
    vi.advanceTimersByTime(2000);
    // still visible since timer reset
    expect(el.style.opacity).toBe('1');
    // 'second' = 6 chars → 2400 + 180 = 2580ms base. 여유를 두고 600ms 추가.
    vi.advanceTimersByTime(600);
    expect(el.style.opacity).toBe('0');
    api.dispose();
  });

  it('dispose() removes element from root', () => {
    const root = mkRoot();
    const api = createUpgradeToast(root, 'light');
    expect(root.querySelector('.wsm-upgrade-toast')).toBeTruthy();
    api.dispose();
    expect(root.querySelector('.wsm-upgrade-toast')).toBeNull();
  });

  it('dispose() clears pending timer safely', () => {
    const root = mkRoot();
    const api = createUpgradeToast(root, 'light');
    api.show('msg');
    api.dispose();
    expect(() => vi.advanceTimersByTime(3000)).not.toThrow();
  });

  it('dispose() before show() is a no-op on timer', () => {
    const root = mkRoot();
    const api = createUpgradeToast(root, 'light');
    expect(() => api.dispose()).not.toThrow();
  });

  it('show() with empty message still operates', () => {
    const root = mkRoot();
    const api = createUpgradeToast(root, 'light');
    api.show('');
    const el = root.querySelector('.wsm-upgrade-toast') as HTMLElement;
    expect(el.textContent).toBe('');
    expect(el.style.opacity).toBe('1');
    api.dispose();
  });
});
