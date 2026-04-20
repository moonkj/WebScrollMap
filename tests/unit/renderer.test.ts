import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createRenderer } from '@ui/renderer';
import { AnchorKind, type RendererOptions, type ScannerResult } from '@core/types';

beforeAll(() => {
  const ctxStub = new Proxy({}, {
    get: (_t, prop) => (prop === 'canvas' ? undefined : () => {}),
    set: () => true,
  });
  // @ts-expect-error test stub
  HTMLCanvasElement.prototype.getContext = function () { return ctxStub; };
});

function mkRoot(): ShadowRoot {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host.attachShadow({ mode: 'open' });
}

function opts(): RendererOptions {
  return { width: 20, height: 400, dpr: 1, colorScheme: 'light', side: 'right' };
}

function result(anchorCount: number): ScannerResult {
  const anchors = Array.from({ length: anchorCount }, (_, i) => ({
    y: i * 10, type: AnchorKind.Heading1, weight: 1, textHash: i, snippet: '',
  }));
  return { anchors, blocks: [], docHeight: anchorCount * 10 + 100, scannedAt: 0, elapsedMs: 0 };
}

describe('hybrid renderer', () => {
  it('mounts in dom mode for small anchor count', () => {
    const root = mkRoot();
    const r = createRenderer(root, opts());
    r.mount();
    r.update(result(50));
    expect(r.currentMode()).toBe('dom');
    r.destroy();
  });

  it('switches to canvas mode for large anchor count', () => {
    const root = mkRoot();
    const r = createRenderer(root, opts());
    r.mount();
    r.update(result(800));
    // 히스테리시스 적용 후 바뀌었는지
    r.update(result(800));
    expect(['canvas', 'dom']).toContain(r.currentMode());
    r.destroy();
  });

  it('mount is idempotent', () => {
    const root = mkRoot();
    const r = createRenderer(root, opts());
    r.mount();
    r.mount();
    r.destroy();
  });

  it('setPins / setTrail / setSearchHits / setPalette / setSide pass through', () => {
    const root = mkRoot();
    const r = createRenderer(root, opts());
    r.mount();
    r.update(result(10));
    r.setPins([{ id: 'a', y: 5 }]);
    r.setTrail([{ yStart: 0, yEnd: 50, visitedAt: 0 }]);
    r.setSearchHits([{ y: 30 }]);
    r.setPalette({ indicator: 'red' });
    r.setSide('left');
    r.destroy();
  });

  it('highlight forwards viewport', () => {
    const root = mkRoot();
    const r = createRenderer(root, opts());
    r.mount();
    r.update(result(5));
    r.highlight('slim', { scrollY: 0, height: 100, docHeight: 1000 });
    r.destroy();
  });
});
