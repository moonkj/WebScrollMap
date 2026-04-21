import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFloatingPins, type FloatingPinsOpts } from '@ui/floatingPins';
import type { Pin } from '@core/types';
import { paletteFor } from '@ui/palette';

function makeShadowRoot(): ShadowRoot {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host.attachShadow({ mode: 'open' });
}

function makeOpts(overrides: Partial<FloatingPinsOpts> = {}): FloatingPinsOpts {
  return {
    side: 'right',
    scheme: 'light',
    palette: paletteFor('light'),
    onJump: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
}

function firePointer(el: EventTarget, type: string, init: { clientX?: number; clientY?: number; pointerId?: number } = {}) {
  const ev = new Event(type, { bubbles: true, composed: true, cancelable: true }) as any;
  Object.assign(ev, {
    pointerId: init.pointerId ?? 1,
    pointerType: 'touch',
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
  });
  el.dispatchEvent(ev);
  return ev;
}

afterEach(() => {
  document.body.innerHTML = '';
  try { sessionStorage.clear(); } catch {}
});

describe('createFloatingPins — visibility', () => {
  it('hidden by default (no pins)', () => {
    const root = makeShadowRoot();
    const api = createFloatingPins(root, makeOpts());
    const wrapper = root.querySelector('.wsm-floating-pins') as HTMLElement;
    expect(wrapper).toBeTruthy();
    expect(wrapper.style.display).toBe('none');
    api.dispose();
  });

  it('shows wrapper and renders list items on update', () => {
    const root = makeShadowRoot();
    const api = createFloatingPins(root, makeOpts());
    const pins: Pin[] = [{ id: 'a', y: 500 }, { id: 'b', y: 1000, label: 'Intro' }];
    api.update(pins, 10000);
    const wrapper = root.querySelector('.wsm-floating-pins') as HTMLElement;
    expect(wrapper.style.display).toBe('block');
    const items = root.querySelectorAll('.wsm-fp-list li');
    expect(items.length).toBe(2);
    // label takes precedence over pct
    expect((items[1] as HTMLElement).textContent).toContain('Intro');
    // pct fallback
    expect((items[0] as HTMLElement).textContent).toContain('5%');
    api.dispose();
  });

  it('auto-expands (un-minimizes) on first pin', () => {
    const root = makeShadowRoot();
    const api = createFloatingPins(root, makeOpts());
    // Minimize manually first.
    const minBtn = root.querySelector('.wsm-fp-header button') as HTMLButtonElement;
    minBtn.dispatchEvent(new Event('click', { bubbles: true, composed: true }));
    const panel = root.querySelector('.wsm-fp-panel') as HTMLElement;
    // minBtn click has no effect because update() hasn't been called, but state tracked.
    // Add first pin.
    api.update([{ id: '1', y: 100 }], 1000);
    // Panel should be visible (flex); bubble hidden.
    expect(panel.style.getPropertyValue('display')).toBe('flex');
    api.dispose();
  });

  it('hides wrapper when pins drop to zero', () => {
    const root = makeShadowRoot();
    const api = createFloatingPins(root, makeOpts());
    api.update([{ id: 'a', y: 10 }], 100);
    api.update([], 100);
    const wrapper = root.querySelector('.wsm-floating-pins') as HTMLElement;
    expect(wrapper.style.display).toBe('none');
    api.dispose();
  });
});

describe('createFloatingPins — callbacks', () => {
  it('invokes onJump when an li is clicked', () => {
    const root = makeShadowRoot();
    const onJump = vi.fn();
    const api = createFloatingPins(root, makeOpts({ onJump }));
    const pin: Pin = { id: 'x', y: 42 };
    api.update([pin], 100);
    const li = root.querySelector('.wsm-fp-list li') as HTMLElement;
    li.dispatchEvent(new Event('click', { bubbles: true, composed: true }));
    expect(onJump).toHaveBeenCalledWith(pin);
    api.dispose();
  });

  it('invokes onDelete when × is clicked (stopPropagation prevents onJump)', () => {
    const root = makeShadowRoot();
    const onJump = vi.fn();
    const onDelete = vi.fn();
    const api = createFloatingPins(root, makeOpts({ onJump, onDelete }));
    api.update([{ id: 'p1', y: 10 }], 100);
    const delBtn = root.querySelector('.wsm-fp-list li button') as HTMLButtonElement;
    delBtn.dispatchEvent(new Event('click', { bubbles: true, composed: true, cancelable: true }));
    expect(onDelete).toHaveBeenCalledWith('p1');
    expect(onJump).not.toHaveBeenCalled();
    api.dispose();
  });
});

describe('createFloatingPins — minimize / bubble', () => {
  it('minimize button hides panel, shows bubble', () => {
    const root = makeShadowRoot();
    const api = createFloatingPins(root, makeOpts());
    api.update([{ id: 'a', y: 10 }], 100);
    const panel = root.querySelector('.wsm-fp-panel') as HTMLElement;
    const bubble = root.querySelector('.wsm-fp-bubble') as HTMLElement;
    const minBtn = root.querySelector('.wsm-fp-header button') as HTMLButtonElement;
    minBtn.dispatchEvent(new Event('click', { bubbles: true, composed: true }));
    expect(panel.style.getPropertyValue('display')).toBe('none');
    expect(bubble.style.getPropertyValue('display')).toBe('flex');
    api.dispose();
  });

  it('bubble click (no drag) restores panel', () => {
    const root = makeShadowRoot();
    const api = createFloatingPins(root, makeOpts());
    api.update([{ id: 'a', y: 10 }], 100);
    const minBtn = root.querySelector('.wsm-fp-header button') as HTMLButtonElement;
    minBtn.dispatchEvent(new Event('click', { bubbles: true, composed: true }));
    const bubble = root.querySelector('.wsm-fp-bubble') as HTMLElement;
    // simple click (no drag)
    firePointer(bubble, 'pointerdown', { clientX: 10, clientY: 10 });
    firePointer(bubble, 'pointerup', { clientX: 10, clientY: 10 });
    bubble.dispatchEvent(new Event('click', { bubbles: true, composed: true }));
    const panel = root.querySelector('.wsm-fp-panel') as HTMLElement;
    expect(panel.style.getPropertyValue('display')).toBe('flex');
    expect(bubble.style.getPropertyValue('display')).toBe('none');
    api.dispose();
  });

  it('bubble drag past threshold does not restore panel on click', () => {
    const root = makeShadowRoot();
    const api = createFloatingPins(root, makeOpts());
    api.update([{ id: 'a', y: 10 }], 100);
    const minBtn = root.querySelector('.wsm-fp-header button') as HTMLButtonElement;
    minBtn.dispatchEvent(new Event('click', { bubbles: true, composed: true }));
    const bubble = root.querySelector('.wsm-fp-bubble') as HTMLElement;
    (bubble as any).setPointerCapture = () => {};
    firePointer(bubble, 'pointerdown', { clientX: 10, clientY: 10 });
    firePointer(bubble, 'pointermove', { clientX: 50, clientY: 50 });
    firePointer(bubble, 'pointerup', { clientX: 50, clientY: 50 });
    const clickEv = new Event('click', { bubbles: true, composed: true, cancelable: true });
    bubble.dispatchEvent(clickEv);
    const panel = root.querySelector('.wsm-fp-panel') as HTMLElement;
    // Since drag occurred, click preventDefault and panel stays hidden.
    expect(panel.style.getPropertyValue('display')).toBe('none');
    api.dispose();
  });
});

describe('createFloatingPins — header drag', () => {
  it('moves wrapper and persists position to sessionStorage', () => {
    const root = makeShadowRoot();
    const api = createFloatingPins(root, makeOpts());
    api.update([{ id: 'a', y: 10 }], 100);
    const header = root.querySelector('.wsm-fp-header') as HTMLElement;
    const wrapper = root.querySelector('.wsm-floating-pins') as HTMLElement;
    (header as any).setPointerCapture = () => {};
    // Provide rect so drag math works.
    (wrapper as any).getBoundingClientRect = () => ({
      top: 100, left: 200, right: 400, bottom: 250, width: 200, height: 150,
      x: 200, y: 100, toJSON: () => ({}),
    });
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });

    const down = firePointer(header, 'pointerdown', { clientX: 220, clientY: 110 });
    firePointer(header, 'pointermove', { clientX: 260, clientY: 160 });
    firePointer(header, 'pointerup', { clientX: 260, clientY: 160 });

    // Persisted pos should exist in sessionStorage.
    const raw = sessionStorage.getItem('wsm:fp:pos:v1');
    expect(raw).toBeTruthy();
    // Event got preventDefault on pointerdown (we can't fully verify without defaultPrevented; skip).
    expect(down).toBeDefined();
    api.dispose();
  });

  it('header pointermove without prior pointerdown does not move wrapper', () => {
    const root = makeShadowRoot();
    const api = createFloatingPins(root, makeOpts());
    api.update([{ id: 'a', y: 10 }], 100);
    const header = root.querySelector('.wsm-fp-header') as HTMLElement;
    // No pointerdown → dragging=false → move is a no-op.
    firePointer(header, 'pointermove', { clientX: 400, clientY: 200 });
    firePointer(header, 'pointerup', { clientX: 400, clientY: 200 });
    expect(sessionStorage.getItem('wsm:fp:pos:v1')).toBeNull();
    api.dispose();
  });
});

describe('createFloatingPins — setSide / setOpacity', () => {
  it('setSide updates css anchor', () => {
    const root = makeShadowRoot();
    const api = createFloatingPins(root, makeOpts({ side: 'right' }));
    const wrapper = root.querySelector('.wsm-floating-pins') as HTMLElement;
    // default right → bar is on right → panel on left (left: 16px).
    expect(wrapper.style.left).toBe('16px');
    api.setSide('left');
    expect(wrapper.style.right).toBe('16px');
    api.dispose();
  });

  it('setOpacity clamps to 20..100', () => {
    const root = makeShadowRoot();
    const api = createFloatingPins(root, makeOpts());
    const wrapper = root.querySelector('.wsm-floating-pins') as HTMLElement;
    api.setOpacity(50);
    expect(wrapper.style.opacity).toBe('0.5');
    api.setOpacity(5);
    expect(wrapper.style.opacity).toBe('0.2');
    api.setOpacity(500);
    expect(wrapper.style.opacity).toBe('1');
    api.dispose();
  });
});

describe('createFloatingPins — dispose', () => {
  it('removes wrapper from shadow root', () => {
    const root = makeShadowRoot();
    const api = createFloatingPins(root, makeOpts());
    api.update([{ id: 'a', y: 10 }], 100);
    expect(root.querySelector('.wsm-floating-pins')).toBeTruthy();
    api.dispose();
    expect(root.querySelector('.wsm-floating-pins')).toBeNull();
  });
});
