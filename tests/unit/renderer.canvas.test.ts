import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createCanvasRenderer } from '@ui/renderer.canvas';
import { AnchorKind, type ScannerResult, type RendererOptions } from '@core/types';

// happy-dom은 canvas 2d context를 구현하지 않음 → 최소한의 stub 주입
beforeAll(() => {
  const ctxStub = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'canvas') return undefined;
        // 모든 메서드: no-op, 모든 속성: 기본 값
        return () => {};
      },
      set: () => true,
    },
  );
  // @ts-expect-error test stub
  HTMLCanvasElement.prototype.getContext = function () { return ctxStub; };
});

function makeShadowRoot(): ShadowRoot {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host.attachShadow({ mode: 'open' });
}

function baseOpts(overrides: Partial<RendererOptions> = {}): RendererOptions {
  return {
    width: 20,
    height: 400,
    dpr: 2,
    colorScheme: 'light',
    side: 'right',
    ...overrides,
  };
}

function makeResult(): ScannerResult {
  return {
    anchors: [
      { y: 100, type: AnchorKind.Heading1, weight: 1, textHash: 0, snippet: 'Intro' },
      { y: 500, type: AnchorKind.Heading2, weight: 1, textHash: 0, snippet: 'Ch1' },
      { y: 900, type: AnchorKind.Image, weight: 1, textHash: 0, snippet: '' },
      { y: 1100, type: AnchorKind.LinkCluster, weight: 1, textHash: 0, snippet: '' },
    ],
    blocks: [],
    docHeight: 2000,
    scannedAt: 0,
    elapsedMs: 0,
  };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('createCanvasRenderer — lifecycle', () => {
  it('mount() appends canvas with wsm-track class', () => {
    const root = makeShadowRoot();
    const r = createCanvasRenderer(root, baseOpts());
    r.mount();
    const c = root.querySelector('canvas.wsm-track') as HTMLCanvasElement;
    expect(c).toBeTruthy();
    // backing store scaled by dpr.
    expect(c.width).toBe(Math.max(1, Math.floor(20 * 2)));
    expect(c.height).toBe(Math.max(1, Math.floor(400 * 2)));
    r.destroy();
    expect(root.querySelector('canvas.wsm-track')).toBeNull();
  });

  it('highlight() without update() is a no-op (no throw)', () => {
    const root = makeShadowRoot();
    const r = createCanvasRenderer(root, baseOpts());
    r.mount();
    expect(() => r.highlight('slim', { scrollY: 0, height: 400, docHeight: 2000 })).not.toThrow();
    r.destroy();
  });

  it('update + highlight draws without throwing (canvas ctx minimal in happy-dom)', () => {
    const root = makeShadowRoot();
    const r = createCanvasRenderer(root, baseOpts());
    r.mount();
    r.update(makeResult());
    expect(() =>
      r.highlight('slim', { scrollY: 200, height: 400, docHeight: 2000 }),
    ).not.toThrow();
    r.destroy();
  });

  it('setPins / setTrail / setSearchHits / setPalette / setSide do not throw after update', () => {
    const root = makeShadowRoot();
    const r = createCanvasRenderer(root, baseOpts());
    r.mount();
    r.update(makeResult());
    expect(() => r.setPins([{ id: 'a', y: 100 }])).not.toThrow();
    expect(() => r.setTrail([{ yStart: 0, yEnd: 100, visitedAt: 0 }])).not.toThrow();
    expect(() => r.setSearchHits([{ y: 50 }, { y: 800 }])).not.toThrow();
    expect(() => r.setPalette({ pin: '#f00' })).not.toThrow();
    expect(() => r.setSide('left')).not.toThrow();
    r.destroy();
  });
});

describe('createCanvasRenderer — pin tap', () => {
  it('canvas click near pin y fires onPinTap', () => {
    const root = makeShadowRoot();
    const onPinTap = vi.fn();
    const r = createCanvasRenderer(root, baseOpts({ onPinTap }));
    r.mount();
    const c = root.querySelector('canvas.wsm-track') as HTMLCanvasElement;
    (c as any).getBoundingClientRect = () => ({
      top: 0, left: 0, right: 20, bottom: 400, width: 20, height: 400,
      x: 0, y: 0, toJSON: () => ({}),
    });
    r.update(makeResult());
    const pin = { id: 'p', y: 1000 };
    r.setPins([pin]);
    // docH=2000, h=400 → scale=0.2 → py=200
    const ev = new MouseEvent('click', { bubbles: true, clientY: 200, clientX: 10 });
    c.dispatchEvent(ev);
    expect(onPinTap).toHaveBeenCalledWith(pin);
  });

  it('canvas click far from any pin does not fire onPinTap', () => {
    const root = makeShadowRoot();
    const onPinTap = vi.fn();
    const r = createCanvasRenderer(root, baseOpts({ onPinTap }));
    r.mount();
    const c = root.querySelector('canvas.wsm-track') as HTMLCanvasElement;
    (c as any).getBoundingClientRect = () => ({
      top: 0, left: 0, right: 20, bottom: 400, width: 20, height: 400,
      x: 0, y: 0, toJSON: () => ({}),
    });
    r.update(makeResult());
    r.setPins([{ id: 'p', y: 1000 }]); // py=200
    const ev = new MouseEvent('click', { bubbles: true, clientY: 20, clientX: 10 });
    c.dispatchEvent(ev);
    expect(onPinTap).not.toHaveBeenCalled();
  });

  it('no pins → click is ignored', () => {
    const root = makeShadowRoot();
    const onPinTap = vi.fn();
    const r = createCanvasRenderer(root, baseOpts({ onPinTap }));
    r.mount();
    const c = root.querySelector('canvas.wsm-track') as HTMLCanvasElement;
    r.update(makeResult());
    c.dispatchEvent(new MouseEvent('click', { bubbles: true, clientY: 0 }));
    expect(onPinTap).not.toHaveBeenCalled();
  });
});
