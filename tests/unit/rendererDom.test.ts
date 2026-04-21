import { describe, expect, it, vi } from 'vitest';
import { createDomRenderer } from '@ui/renderer.dom';
import {
  AnchorKind,
  type AnchorPoint,
  type Pin,
  type RendererOptions,
  type ScannerResult,
  type SearchHitMark,
  type TrailSegment,
  type ViewportRect,
} from '@core/types';

function mkRoot(): ShadowRoot {
  document.body.innerHTML = '';
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host.attachShadow({ mode: 'open' });
}

function baseOpts(overrides: Partial<RendererOptions> = {}): RendererOptions {
  return {
    width: 44,
    height: 800,
    dpr: 2,
    colorScheme: 'light',
    side: 'right',
    ...overrides,
  };
}

function anchor(y: number, type: AnchorKind): AnchorPoint {
  return { y, type, weight: 1, textHash: 0, snippet: '' };
}

function result(anchors: AnchorPoint[], docHeight = 1000): ScannerResult {
  return { anchors, blocks: [], docHeight, scannedAt: 0, elapsedMs: 0 };
}

function vp(scrollY: number, height: number, docHeight: number): ViewportRect {
  return { scrollY, height, docHeight };
}

describe('createDomRenderer', () => {
  it('mount() appends track container with role=scrollbar', () => {
    const root = mkRoot();
    const r = createDomRenderer(root, baseOpts());
    r.mount();
    const track = root.querySelector('.wsm-track') as HTMLElement;
    expect(track).toBeTruthy();
    expect(track.getAttribute('role')).toBe('scrollbar');
    expect(track.getAttribute('aria-orientation')).toBe('vertical');
    expect(track.style.width).toBe('44px');
    r.destroy();
  });

  it('applyPalette sets background on track', () => {
    const root = mkRoot();
    const r = createDomRenderer(root, baseOpts({ colorScheme: 'light' }));
    r.mount();
    const track = root.querySelector('.wsm-track') as HTMLElement;
    expect(track.style.backgroundColor).toContain('rgba');
    r.destroy();
  });

  it('update() renders one marker per anchor with varying widths', () => {
    const root = mkRoot();
    const r = createDomRenderer(root, baseOpts());
    r.mount();
    r.update(result([
      anchor(100, AnchorKind.Heading1),
      anchor(200, AnchorKind.Heading2),
      anchor(300, AnchorKind.Heading3),
      anchor(400, AnchorKind.Image),
      anchor(500, AnchorKind.Video),
      anchor(600, AnchorKind.StrongText),
      anchor(700, AnchorKind.LinkCluster),
    ], 1000));
    const markers = root.querySelectorAll('.wsm-track > div > div');
    // track is first child of container; markers are inside track
    const trackInner = (root.querySelector('.wsm-track') as HTMLElement).firstElementChild!;
    expect(trackInner.children.length).toBe(7);
    r.destroy();
  });

  it('update() with empty anchors clears markers', () => {
    const root = mkRoot();
    const r = createDomRenderer(root, baseOpts());
    r.mount();
    r.update(result([anchor(100, AnchorKind.Heading1)]));
    r.update(result([]));
    const trackInner = (root.querySelector('.wsm-track') as HTMLElement).firstElementChild!;
    expect(trackInner.children.length).toBe(0);
    r.destroy();
  });

  it('highlight() updates indicator top/height and aria-valuenow', () => {
    const root = mkRoot();
    const r = createDomRenderer(root, baseOpts());
    r.mount();
    r.update(result([], 2000));
    r.highlight('slim', vp(500, 800, 2000));
    const track = root.querySelector('.wsm-track') as HTMLElement;
    // indicator is second child
    const indicator = track.children[1] as HTMLElement;
    expect(indicator.style.top).toMatch(/%$/);
    expect(indicator.style.height).toMatch(/%$/);
    const vnow = parseInt(track.getAttribute('aria-valuenow') || '0', 10);
    expect(vnow).toBeGreaterThanOrEqual(0);
    expect(vnow).toBeLessThanOrEqual(100);
    expect(track.getAttribute('aria-valuemin')).toBe('0');
    expect(track.getAttribute('aria-valuemax')).toBe('100');
    r.destroy();
  });

  it('setPins() renders pin elements as visual-only (pointer-events:none)', () => {
    const root = mkRoot();
    const r = createDomRenderer(root, baseOpts());
    r.mount();
    r.update(result([], 1000));
    const pins: Pin[] = [
      { id: 'a', y: 100 },
      { id: 'b', y: 500, color: '#f00' },
    ];
    r.setPins(pins);
    const track = root.querySelector('.wsm-track') as HTMLElement;
    const pinsLayer = track.children[3] as HTMLElement;
    expect(pinsLayer.children.length).toBe(2);
    // 바 터치 간섭 차단을 위해 wrapper는 pointer-events:none.
    const first = pinsLayer.children[0] as HTMLElement;
    expect(first.style.pointerEvents).toBe('none');
    r.destroy();
  });

  it('setTrail() renders trail segments', () => {
    const root = mkRoot();
    const r = createDomRenderer(root, baseOpts());
    r.mount();
    r.update(result([], 1000));
    const segs: TrailSegment[] = [
      { yStart: 0, yEnd: 100, visitedAt: 1 },
      { yStart: 200, yEnd: 400, visitedAt: 2 },
    ];
    r.setTrail(segs);
    const track = root.querySelector('.wsm-track') as HTMLElement;
    const trailLayer = track.children[2] as HTMLElement;
    expect(trailLayer.children.length).toBe(2);
    r.destroy();
  });

  it('setSearchHits() renders hit marks', () => {
    const root = mkRoot();
    const r = createDomRenderer(root, baseOpts());
    r.mount();
    r.update(result([], 1000));
    const hits: SearchHitMark[] = [{ y: 100 }, { y: 300 }, { y: 900 }];
    r.setSearchHits(hits);
    const track = root.querySelector('.wsm-track') as HTMLElement;
    const glowLayer = track.children[4] as HTMLElement;
    expect(glowLayer.children.length).toBe(3);
    r.destroy();
  });

  it('setPalette() re-applies colors and re-renders existing content', () => {
    const root = mkRoot();
    const r = createDomRenderer(root, baseOpts());
    r.mount();
    r.update(result([anchor(100, AnchorKind.Heading1)], 1000));
    r.setPins([{ id: 'a', y: 50 }]);
    r.setTrail([{ yStart: 0, yEnd: 10, visitedAt: 1 }]);
    r.setSearchHits([{ y: 80 }]);
    r.setPalette({ track: 'rgb(1,2,3)', indicator: 'rgb(4,5,6)' });
    const track = root.querySelector('.wsm-track') as HTMLElement;
    expect(track.style.backgroundColor.replace(/\s+/g, '')).toBe('rgb(1,2,3)');
    r.destroy();
  });

  it('setSide() switches edge rendering between right and left', () => {
    const root = mkRoot();
    const r = createDomRenderer(root, baseOpts({ side: 'right' }));
    r.mount();
    r.update(result([anchor(100, AnchorKind.Heading1)], 1000));
    r.setPins([{ id: 'a', y: 200 }]);
    r.setSide('left');
    const track = root.querySelector('.wsm-track') as HTMLElement;
    const trackInner = track.firstElementChild as HTMLElement;
    const marker = trackInner.firstElementChild as HTMLElement;
    expect(marker.style.cssText.replace(/\s+/g, '')).toContain('left:2%');
    // switch back
    r.setSide('right');
    const marker2 = (track.firstElementChild as HTMLElement).firstElementChild as HTMLElement;
    expect(marker2.style.cssText.replace(/\s+/g, '')).toContain('right:2%');
    r.destroy();
  });

  it('destroy() removes container from root', () => {
    const root = mkRoot();
    const r = createDomRenderer(root, baseOpts());
    r.mount();
    expect(root.querySelector('.wsm-track')).toBeTruthy();
    r.destroy();
    expect(root.querySelector('.wsm-track')).toBeNull();
  });

  it('highlight() handles docHeight=0 edge case safely', () => {
    const root = mkRoot();
    const r = createDomRenderer(root, baseOpts());
    r.mount();
    r.update(result([], 0));
    expect(() => r.highlight('slim', vp(0, 800, 0))).not.toThrow();
    r.destroy();
  });

  it('update() avoids duplicate style churn when top/height unchanged', () => {
    const root = mkRoot();
    const r = createDomRenderer(root, baseOpts());
    r.mount();
    r.update(result([], 2000));
    r.highlight('slim', vp(500, 800, 2000));
    const track = root.querySelector('.wsm-track') as HTMLElement;
    const indicator = track.children[1] as HTMLElement;
    const topBefore = indicator.style.top;
    r.highlight('slim', vp(500, 800, 2000));
    expect(indicator.style.top).toBe(topBefore);
    r.destroy();
  });

  it('palette override via opts.palette merges with default', () => {
    const root = mkRoot();
    const r = createDomRenderer(root, baseOpts({ palette: { track: 'rgb(9,9,9)' } }));
    r.mount();
    const track = root.querySelector('.wsm-track') as HTMLElement;
    expect(track.style.backgroundColor.replace(/\s+/g, '')).toBe('rgb(9,9,9)');
    r.destroy();
  });
});
