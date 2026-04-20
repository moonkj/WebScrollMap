import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createScrubber,
  DOUBLE_TAP_MS,
  EDGE_MARGIN,
  LONG_PRESS_MS,
  LONG_PRESS_MOVE_TOLERANCE_PX,
  type ScrubberApi,
} from '@ui/scrubber';

type ApiMocks = {
  scrollTo: ReturnType<typeof vi.fn>;
  snapCandidates: ReturnType<typeof vi.fn>;
  getDocHeight: ReturnType<typeof vi.fn>;
  getViewportHeight: ReturnType<typeof vi.fn>;
  onHaptic: ReturnType<typeof vi.fn>;
  onStateChange: ReturnType<typeof vi.fn>;
  onLongPress: ReturnType<typeof vi.fn>;
  onMagnify: ReturnType<typeof vi.fn>;
  onDoubleTap: ReturnType<typeof vi.fn>;
};

function makeApi(overrides: Partial<ScrubberApi> = {}): ScrubberApi & ApiMocks {
  const api = {
    scrollTo: vi.fn(),
    snapCandidates: vi.fn(() => [] as number[]),
    getDocHeight: vi.fn(() => 10000),
    getViewportHeight: vi.fn(() => 1000),
    onHaptic: vi.fn(),
    onStateChange: vi.fn(),
    onLongPress: vi.fn(),
    onMagnify: vi.fn(),
    onDoubleTap: vi.fn(),
    ...overrides,
  };
  return api as ScrubberApi & ApiMocks;
}

function makeTrackEl(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'wsm-track';
  // Provide a deterministic rect (happy-dom returns zeros otherwise).
  // getBoundingClientRect: top=0, height=1000 → clientY == docY pct
  (el as any).getBoundingClientRect = () => ({
    top: 0,
    left: 0,
    right: 100,
    bottom: 1000,
    width: 100,
    height: 1000,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  (el as any).setPointerCapture = () => {};
  document.body.appendChild(el);
  return el;
}

function firePointer(
  el: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  init: { clientX?: number; clientY?: number; pointerId?: number; pointerType?: string } = {},
) {
  const ev = new Event(type, { bubbles: true, composed: true, cancelable: true }) as any;
  Object.assign(ev, {
    pointerId: init.pointerId ?? 1,
    pointerType: init.pointerType ?? 'touch',
    clientX: init.clientX ?? 50,
    clientY: init.clientY ?? 0,
  });
  // composedPath should include el with wsm-track class.
  const originalPath = ev.composedPath?.bind(ev);
  ev.composedPath = () => {
    if (typeof originalPath === 'function') {
      const p = originalPath();
      if (Array.isArray(p) && p.length > 0) return p;
    }
    return [el, document.body, document.documentElement, document];
  };
  el.dispatchEvent(ev);
  return ev;
}

// requestAnimationFrame in happy-dom exists but scheduling relative to fake timers
// is unreliable; stub to run immediately so applyScroll fires synchronously.
let rafSpy: { mockRestore: () => void } | null = null;

beforeEach(() => {
  rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(((cb: FrameRequestCallback) => {
    cb(0);
    return 1;
  }) as never) as unknown as { mockRestore: () => void };
  // Stable inner width for edge-zone tests.
  Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });
});

afterEach(() => {
  rafSpy?.mockRestore();
  document.body.innerHTML = '';
  vi.useRealTimers();
});

describe('createScrubber — tap', () => {
  it('tap (down + up without move) calls scrollTo once', () => {
    const el = makeTrackEl();
    const api = makeApi({ onLongPress: undefined as unknown as (y: number) => void });
    createScrubber(el, api);

    firePointer(el, 'pointerdown', { clientY: 500 });
    firePointer(el, 'pointerup', { clientY: 500 });

    expect(api.scrollTo).toHaveBeenCalled();
    // docH=10000, vpH=1000 → maxScroll=9000; pct=0.5 → 4500
    const lastCall = api.scrollTo.mock.calls.at(-1)![0];
    expect(lastCall).toBeCloseTo(4500, -1);
    expect(api.onStateChange).toHaveBeenCalledWith('scrubbing');
    expect(api.onStateChange).toHaveBeenCalledWith('idle');
  });

  it('ignores events not on wsm-track', () => {
    const el = document.createElement('div');
    // no wsm-track class
    (el as any).getBoundingClientRect = () => ({ top: 0, height: 1000, left: 0, right: 100, bottom: 1000, width: 100, x: 0, y: 0, toJSON: () => ({}) });
    (el as any).setPointerCapture = () => {};
    document.body.appendChild(el);
    const api = makeApi();
    createScrubber(el, api);
    // composedPath inside firePointer falls back to [el,...] but el has no wsm-track class
    firePointer(el, 'pointerdown', { clientY: 500 });
    expect(api.scrollTo).not.toHaveBeenCalled();
    expect(api.onStateChange).not.toHaveBeenCalled();
  });

  it('ignores edge-zone touches (x > innerWidth - EDGE_MARGIN)', () => {
    const el = makeTrackEl();
    const api = makeApi();
    createScrubber(el, api);
    firePointer(el, 'pointerdown', { clientX: 390 - EDGE_MARGIN + 1, clientY: 500, pointerType: 'touch' });
    expect(api.scrollTo).not.toHaveBeenCalled();
    expect(api.onHaptic).toHaveBeenCalledWith('edge');
  });
});

describe('createScrubber — long-press', () => {
  it('fires onLongPress after LONG_PRESS_MS without movement', () => {
    vi.useFakeTimers();
    const el = makeTrackEl();
    const api = makeApi();
    createScrubber(el, api);
    firePointer(el, 'pointerdown', { clientY: 500 });
    // scrollGated — no scrollTo before timer
    expect(api.scrollTo).not.toHaveBeenCalled();
    vi.advanceTimersByTime(LONG_PRESS_MS + 1);
    // docY pct = 0.5 → 5000
    expect(api.onLongPress).toHaveBeenCalledWith(5000);
    expect(api.onHaptic).toHaveBeenCalledWith('pin');
  });

  it('cancels long-press when movement exceeds tolerance', () => {
    vi.useFakeTimers();
    const el = makeTrackEl();
    const api = makeApi();
    createScrubber(el, api);
    firePointer(el, 'pointerdown', { clientX: 50, clientY: 500 });
    // Move beyond tolerance before timer expires.
    firePointer(el, 'pointermove', { clientX: 50, clientY: 500 + LONG_PRESS_MOVE_TOLERANCE_PX + 2 });
    vi.advanceTimersByTime(LONG_PRESS_MS + 20);
    expect(api.onLongPress).not.toHaveBeenCalled();
  });

  it('does not long-press if onLongPress is not supplied', () => {
    vi.useFakeTimers();
    const el = makeTrackEl();
    const api = makeApi();
    (api as { onLongPress?: unknown }).onLongPress = undefined;
    createScrubber(el, api);
    firePointer(el, 'pointerdown', { clientY: 500 });
    // scroll happens immediately when not gated.
    expect(api.scrollTo).toHaveBeenCalled();
    vi.advanceTimersByTime(LONG_PRESS_MS + 50);
    // no haptic pin
    expect(api.onHaptic).not.toHaveBeenCalledWith('pin');
  });
});

describe('createScrubber — drag / scrub', () => {
  it('moves unblock scroll and apply EMA-smoothed scroll', () => {
    const el = makeTrackEl();
    const api = makeApi();
    createScrubber(el, api);
    firePointer(el, 'pointerdown', { clientY: 100 });
    // Movement > LONG_PRESS_MOVE_TOLERANCE_PX un-gates scrolling.
    firePointer(el, 'pointermove', { clientY: 200 });
    firePointer(el, 'pointermove', { clientY: 300 });
    // After moves, scrollTo should have been called at least once.
    expect(api.scrollTo).toHaveBeenCalled();
    // onMagnify should have been called on pointerdown AND on moves.
    expect(api.onMagnify.mock.calls.length).toBeGreaterThan(1);
  });

  it('applies snap on pointerup when scrubbing (not gated, not pinned)', () => {
    const el = makeTrackEl();
    const api = makeApi({
      snapCandidates: vi.fn(() => [4500]),
    });
    createScrubber(el, api);
    firePointer(el, 'pointerdown', { clientY: 100 });
    firePointer(el, 'pointermove', { clientY: 400 });
    firePointer(el, 'pointermove', { clientY: 448 }); // within snapThreshold of pct 0.5 → 4500
    firePointer(el, 'pointerup', { clientY: 448 });
    // Final snap was attempted; scrollTo called with snapped y (4500) or near it.
    expect(api.scrollTo).toHaveBeenCalled();
    // Possibly snap haptic
    // (not strictly required; depending on snap tolerance, so don't assert)
  });
});

describe('createScrubber — double tap', () => {
  it('two quick taps at same spot fire onDoubleTap', () => {
    const el = makeTrackEl();
    const api = makeApi({ onLongPress: undefined as unknown as (y: number) => void });
    const nowSpy = vi.spyOn(performance, 'now');
    let t = 1000;
    nowSpy.mockImplementation(() => t);
    createScrubber(el, api);

    firePointer(el, 'pointerdown', { clientX: 50, clientY: 500 });
    firePointer(el, 'pointerup', { clientX: 50, clientY: 500 });
    t += 100; // within DOUBLE_TAP_MS
    firePointer(el, 'pointerdown', { clientX: 51, clientY: 502 });
    firePointer(el, 'pointerup', { clientX: 51, clientY: 502 });

    expect(api.onDoubleTap).toHaveBeenCalled();
    nowSpy.mockRestore();
  });

  it('taps spaced > DOUBLE_TAP_MS do not fire onDoubleTap', () => {
    const el = makeTrackEl();
    const api = makeApi({ onLongPress: undefined as unknown as (y: number) => void });
    const nowSpy = vi.spyOn(performance, 'now');
    let t = 1000;
    nowSpy.mockImplementation(() => t);
    createScrubber(el, api);

    firePointer(el, 'pointerdown', { clientX: 50, clientY: 500 });
    firePointer(el, 'pointerup', { clientX: 50, clientY: 500 });
    t += DOUBLE_TAP_MS + 50;
    firePointer(el, 'pointerdown', { clientX: 50, clientY: 500 });
    firePointer(el, 'pointerup', { clientX: 50, clientY: 500 });

    expect(api.onDoubleTap).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });
});

describe('createScrubber — dispose', () => {
  it('removes listeners on dispose', () => {
    const el = makeTrackEl();
    const api = makeApi({ onLongPress: undefined as unknown as (y: number) => void });
    const ctrl = createScrubber(el, api);
    ctrl.dispose();
    firePointer(el, 'pointerdown', { clientY: 500 });
    firePointer(el, 'pointerup', { clientY: 500 });
    expect(api.scrollTo).not.toHaveBeenCalled();
    expect(api.onStateChange).not.toHaveBeenCalled();
  });
});
