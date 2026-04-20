// Canvas 모드: 앵커 >=600 일 때. GPU 합성 + dirty region.

import { AnchorKind, type MinimapRenderer, type MinimapState, type Pin, type RendererOptions, type ScannerResult, type SearchHitMark, type TrailSegment, type ViewportRect } from '@core/types';
import { TUNING } from '@config/tuning';
import { warnSlowFrame } from '@core/assert';
import { paletteFor, type Palette } from './palette';

const LINE_HEIGHT_BY_KIND: Record<AnchorKind, number> = {
  [AnchorKind.Heading1]: 2,
  [AnchorKind.Heading2]: 1.5,
  [AnchorKind.Heading3]: 1,
  [AnchorKind.Image]: 1.5,
  [AnchorKind.Video]: 1.5,
  [AnchorKind.StrongText]: 0.75,
  [AnchorKind.LinkCluster]: 0.5,
};

export function createCanvasRenderer(root: ShadowRoot, opts: RendererOptions): MinimapRenderer {
  const doc = root.ownerDocument ?? document;
  const canvas = doc.createElement('canvas');
  canvas.className = 'wsm-track';
  canvas.style.cssText = `width: ${opts.width}px; height: 100%;`;
  let palette: Palette = paletteFor(opts.colorScheme);
  let lastResult: ScannerResult | null = null;
  let lastPins: ReadonlyArray<Pin> = [];
  let lastTrail: ReadonlyArray<TrailSegment> = [];
  let lastHits: ReadonlyArray<SearchHitMark> = [];

  const ctx = canvas.getContext('2d');

  function applyBackingStore(width: number, height: number) {
    const dpr = opts.dpr;
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawAll(state: MinimapState, viewport: ViewportRect) {
    if (!ctx || !lastResult) return;
    const t0 = performance.now();
    const W = opts.width;
    const H = opts.height;
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = palette.track;
    ctx.fillRect(0, 0, W, H);

    const docH = lastResult.docHeight || 1;
    const scale = H / docH;
    // Sev2 fix: docH 왜곡 방지용 clip
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();

    // trail
    ctx.fillStyle = palette.trail;
    for (const seg of lastTrail) {
      const y0 = seg.yStart * scale;
      const y1 = seg.yEnd * scale;
      ctx.fillRect(0, y0, 1, Math.max(1, y1 - y0));
    }

    // anchors
    for (const a of lastResult.anchors) {
      const y = a.y * scale;
      const h = LINE_HEIGHT_BY_KIND[a.type] ?? 1;
      switch (a.type) {
        case AnchorKind.Heading1:
          ctx.fillStyle = palette.heading1; ctx.fillRect(W * 0.1, y, W * 0.8, h); break;
        case AnchorKind.Heading2:
          ctx.fillStyle = palette.heading2; ctx.fillRect(W * 0.2, y, W * 0.65, h); break;
        case AnchorKind.Heading3:
          ctx.fillStyle = palette.heading3; ctx.fillRect(W * 0.3, y, W * 0.5, h); break;
        case AnchorKind.Image:
        case AnchorKind.Video:
          ctx.fillStyle = palette.media; ctx.fillRect(W * 0.35, y, W * 0.45, h); break;
        case AnchorKind.StrongText:
          ctx.fillStyle = palette.heading3; ctx.fillRect(W * 0.45, y, W * 0.3, h); break;
        case AnchorKind.LinkCluster:
          ctx.fillStyle = palette.link; ctx.fillRect(W * 0.55, y, W * 0.25, h); break;
      }
    }

    // viewport indicator
    const vpY = viewport.scrollY * scale;
    const vpH = Math.max(2, viewport.height * scale);
    ctx.fillStyle = palette.indicator;
    ctx.fillRect(0, vpY, W, vpH);

    // search hits (발광 마커) — state 무관 상시 표시
    if (lastHits.length > 0) {
      ctx.fillStyle = palette.searchGlow;
      for (const h of lastHits) {
        const y = h.y * scale;
        ctx.fillRect(W * 0.62, y - 1.5, W * 0.32, 3);
      }
    }

    // pins
    for (const p of lastPins) {
      const y = p.y * scale;
      ctx.fillStyle = p.color ?? palette.heading1;
      ctx.fillRect(W * 0.05, y - 1.5, W * 0.2, 3);
    }

    ctx.restore();

    warnSlowFrame(performance.now() - t0);
  }

  return {
    mount() {
      root.appendChild(canvas);
      applyBackingStore(opts.width, opts.height);
    },
    update(result) {
      lastResult = result;
    },
    highlight(state, viewport) {
      drawAll(state, viewport);
    },
    setPins(pins) {
      lastPins = pins;
    },
    setTrail(segs) {
      lastTrail = segs;
    },
    setSearchHits(hits) {
      lastHits = hits;
    },
    destroy() {
      canvas.remove();
    },
  };
}
