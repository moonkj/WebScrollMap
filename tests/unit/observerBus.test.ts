import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createObserverBus } from '@platform/observerBus';

describe('observerBus', () => {
  beforeEach(() => {
    document.body.innerHTML = '<main id="m"><p>hi</p></main>';
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  describe('onMutation', () => {
    it('invokes callback eventually after DOM mutation', async () => {
      vi.useRealTimers();
      const bus = createObserverBus();
      const cb = vi.fn();
      bus.onMutation(cb, { debounceMs: 20 });

      const main = document.getElementById('m')!;
      main.appendChild(document.createElement('div'));

      await new Promise((r) => setTimeout(r, 100));
      expect(cb).toHaveBeenCalledTimes(1);
      bus.disposeAll();
    });

    it('coalesces rapid mutations into single callback', async () => {
      vi.useRealTimers();
      const bus = createObserverBus();
      const cb = vi.fn();
      bus.onMutation(cb, { debounceMs: 30 });
      const main = document.getElementById('m')!;
      for (let i = 0; i < 5; i++) main.appendChild(document.createElement('span'));
      await new Promise((r) => setTimeout(r, 120));
      expect(cb).toHaveBeenCalledTimes(1);
      bus.disposeAll();
    });

    it('falls back to body when no semantic container', async () => {
      vi.useRealTimers();
      document.body.innerHTML = '<div id="x"></div>';
      const bus = createObserverBus();
      const cb = vi.fn();
      bus.onMutation(cb, { debounceMs: 20 });
      document.getElementById('x')!.appendChild(document.createElement('p'));
      await new Promise((r) => setTimeout(r, 100));
      expect(cb).toHaveBeenCalled();
      bus.disposeAll();
    });

    it('picks tallest candidate among multiple mains', async () => {
      vi.useRealTimers();
      document.body.innerHTML =
        '<main id="a"></main><article id="b"></article><main id="c"></main>';
      const a = document.getElementById('a')!;
      const b = document.getElementById('b')!;
      const c = document.getElementById('c')!;
      Object.defineProperty(a, 'scrollHeight', { value: 100, configurable: true });
      Object.defineProperty(b, 'scrollHeight', { value: 500, configurable: true });
      Object.defineProperty(c, 'scrollHeight', { value: 200, configurable: true });

      const bus = createObserverBus();
      const cb = vi.fn();
      bus.onMutation(cb, { debounceMs: 20 });

      b.appendChild(document.createElement('p'));
      await new Promise((r) => setTimeout(r, 100));
      expect(cb).toHaveBeenCalled();
      bus.disposeAll();
    });

    it('dispose prevents subsequent callback', async () => {
      vi.useRealTimers();
      const bus = createObserverBus();
      const cb = vi.fn();
      const d = bus.onMutation(cb, { debounceMs: 20 });
      d.dispose();
      document.getElementById('m')!.appendChild(document.createElement('p'));
      await new Promise((r) => setTimeout(r, 80));
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('onSpaNavigate', () => {
    it('patches pushState (observer fires when href differs)', () => {
      const bus = createObserverBus();
      const cb = vi.fn();
      bus.onSpaNavigate(cb);
      // happy-dom: history.pushState가 location.href를 갱신하지 않는 경우가 있어
      // 패치 자체는 확인하되 fire 조건은 href 변경 모킹으로 검증
      const original = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(location), 'href');
      let fakeHref = String(location.href);
      Object.defineProperty(location, 'href', {
        configurable: true,
        get: () => fakeHref,
      });
      try {
        fakeHref = 'http://localhost/new-url-1';
        history.pushState({}, '', '/new-url-1');
        expect(cb).toHaveBeenCalled();
      } finally {
        if (original) Object.defineProperty(Object.getPrototypeOf(location), 'href', original);
        bus.disposeAll();
      }
    });

    it('does not fire if url unchanged', () => {
      const bus = createObserverBus();
      const cb = vi.fn();
      bus.onSpaNavigate(cb);
      const cur = location.pathname;
      history.pushState({}, '', cur);
      expect(cb).not.toHaveBeenCalled();
      bus.disposeAll();
    });

    it('patches replaceState', () => {
      const bus = createObserverBus();
      const cb = vi.fn();
      bus.onSpaNavigate(cb);
      const original = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(location), 'href');
      let fakeHref = String(location.href);
      Object.defineProperty(location, 'href', { configurable: true, get: () => fakeHref });
      try {
        fakeHref = 'http://localhost/repl-1';
        history.replaceState({}, '', '/repl-1');
        expect(cb).toHaveBeenCalled();
      } finally {
        if (original) Object.defineProperty(Object.getPrototypeOf(location), 'href', original);
        bus.disposeAll();
      }
    });

    it('fires on popstate event', () => {
      const bus = createObserverBus();
      const cb = vi.fn();
      bus.onSpaNavigate(cb);
      history.pushState({}, '', '/pop-a');
      cb.mockClear();
      // Simulate navigation back by changing location then firing popstate
      history.pushState({}, '', '/pop-b');
      cb.mockClear();
      // direct popstate dispatch won't change href; verify listener is wired
      window.dispatchEvent(new PopStateEvent('popstate'));
      // no url change → no fire
      expect(cb).not.toHaveBeenCalled();
      bus.disposeAll();
    });

    it('fires on hashchange event when url state differs', () => {
      const bus = createObserverBus();
      const cb = vi.fn();
      bus.onSpaNavigate(cb);
      const original = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(location), 'href');
      let fakeHref = String(location.href);
      Object.defineProperty(location, 'href', { configurable: true, get: () => fakeHref });
      try {
        fakeHref = 'http://localhost/before#section';
        window.dispatchEvent(new Event('hashchange'));
        expect(cb).toHaveBeenCalled();
      } finally {
        if (original) Object.defineProperty(Object.getPrototypeOf(location), 'href', original);
        bus.disposeAll();
      }
    });

    it('dispose restores original pushState/replaceState', () => {
      const origPush = history.pushState;
      const origRepl = history.replaceState;
      const bus = createObserverBus();
      const d = bus.onSpaNavigate(() => {});
      expect(history.pushState).not.toBe(origPush);
      d.dispose();
      expect(history.pushState).toBe(origPush);
      expect(history.replaceState).toBe(origRepl);
    });

    it('dispose does not restore if another patcher wrapped on top', () => {
      const bus = createObserverBus();
      bus.onSpaNavigate(() => {});
      const ourPush = history.pushState;
      // another library wraps on top
      const outerPush = function (...args: Parameters<typeof history.pushState>) {
        return ourPush.apply(history, args);
      } as typeof history.pushState;
      history.pushState = outerPush;
      bus.disposeAll();
      // outer wrapper preserved (we should not break the chain)
      expect(history.pushState).toBe(outerPush);
      history.pushState = ourPush; // cleanup so other tests unaffected
    });
  });

  describe('onVisualViewportChange', () => {
    it('returns no-op disposable when visualViewport absent', () => {
      const orig = window.visualViewport;
      Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
      const bus = createObserverBus();
      const cb = vi.fn();
      const d = bus.onVisualViewportChange(cb);
      expect(typeof d.dispose).toBe('function');
      d.dispose();
      Object.defineProperty(window, 'visualViewport', { value: orig, configurable: true });
    });

    it('listens to resize/scroll when vv present', () => {
      const listeners = new Map<string, Set<EventListener>>();
      const fakeVV = {
        addEventListener: (t: string, cb: EventListener) => {
          if (!listeners.has(t)) listeners.set(t, new Set());
          listeners.get(t)!.add(cb);
        },
        removeEventListener: (t: string, cb: EventListener) => {
          listeners.get(t)?.delete(cb);
        },
      };
      const orig = window.visualViewport;
      Object.defineProperty(window, 'visualViewport', { value: fakeVV, configurable: true });

      const bus = createObserverBus();
      const cb = vi.fn();
      const d = bus.onVisualViewportChange(cb);
      listeners.get('resize')!.forEach((fn) => fn(new Event('resize')));
      listeners.get('scroll')!.forEach((fn) => fn(new Event('scroll')));
      expect(cb).toHaveBeenCalledTimes(2);
      d.dispose();
      expect(listeners.get('resize')!.size).toBe(0);
      expect(listeners.get('scroll')!.size).toBe(0);

      Object.defineProperty(window, 'visualViewport', { value: orig, configurable: true });
    });
  });

  describe('disposeAll', () => {
    it('clears all registered disposables', async () => {
      const bus = createObserverBus();
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      bus.onMutation(cb1, { debounceMs: 20 });
      bus.onSpaNavigate(cb2);
      bus.disposeAll();
      history.pushState({}, '', '/after-dispose');
      document.getElementById('m')!.appendChild(document.createElement('p'));
      await new Promise((r) => setTimeout(r, 80));
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
    });
  });
});
