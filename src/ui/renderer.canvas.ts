// Canvas 모드: 앵커 >=600 일 때. GPU 합성 + dirty region.

import { AnchorKind, type MinimapRenderer, type MinimapState, type Pin, type RendererOptions, type ScannerResult, type SearchHitMark, type TrailSegment, type ViewportRect } from '@core/types';
import { computeIndicatorStyle } from '@core/indicator';
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
  let lastState: MinimapState = 'slim';
  let lastViewport: ViewportRect = { scrollY: 0, height: 0, docHeight: 1 };
  const isRight = opts.side === 'right';

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
    lastState = state;
    lastViewport = viewport;
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

    // anchors — side-aware edge 앵커 (바의 보이는 가장자리에서 뻗어나감)
    for (const a of lastResult.anchors) {
      const y = a.y * scale;
      const h = LINE_HEIGHT_BY_KIND[a.type] ?? 1;
      let widthPct = 0.4;
      let color = palette.heading3;
      switch (a.type) {
        case AnchorKind.Heading1: widthPct = 0.9; color = palette.heading1; break;
        case AnchorKind.Heading2: widthPct = 0.75; color = palette.heading2; break;
        case AnchorKind.Heading3: widthPct = 0.6; color = palette.heading3; break;
        case AnchorKind.Image:
        case AnchorKind.Video: widthPct = 0.55; color = palette.media; break;
        case AnchorKind.StrongText: widthPct = 0.35; color = palette.heading3; break;
        case AnchorKind.LinkCluster: widthPct = 0.25; color = palette.link; break;
      }
      const w = W * widthPct;
      const x = isRight ? W - w : 0;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    }

    // viewport indicator — min 15% 강제 적용
    const idStyle = computeIndicatorStyle(viewport);
    const vpY = (idStyle.topPct / 100) * H;
    const vpH = Math.max(2, (idStyle.heightPct / 100) * H);
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

    // pins — 바의 보이는 가장자리에 solid dot (오렌지 핀 색)
    for (const p of lastPins) {
      const y = p.y * scale;
      ctx.fillStyle = p.color ?? palette.pin;
      const px = isRight ? W - 6 : 0;
      ctx.fillRect(px, y - 3, 6, 6);
    }

    ctx.restore();

    warnSlowFrame(performance.now() - t0);
  }

  // Canvas는 div 핀 요소가 없으므로 canvas 자체에 click 리스너로 y → pin 매칭.
  function onCanvasClick(e: MouseEvent) {
    if (!lastResult || lastPins.length === 0 || !opts.onPinTap) return;
    const rect = canvas.getBoundingClientRect();
    const yInCanvas = e.clientY - rect.top;
    const docH = lastResult.docHeight || 1;
    const scale = opts.height / docH;
    // 탭 영역 ±8px 허용
    let best: Pin | null = null;
    let bestDist = 8;
    for (const p of lastPins) {
      const py = p.y * scale;
      const d = Math.abs(py - yInCanvas);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    if (best) {
      e.stopPropagation();
      opts.onPinTap(best);
    }
  }

  return {
    mount() {
      root.appendChild(canvas);
      applyBackingStore(opts.width, opts.height);
      canvas.addEventListener('click', onCanvasClick);
    },
    update(result) {
      lastResult = result;
    },
    highlight(state, viewport) {
      drawAll(state, viewport);
    },
    setPins(pins) {
      lastPins = pins;
      // 즉시 재드로우 (dom renderer와 대칭)
      if (lastResult) drawAll(lastState, lastViewport);
    },
    setTrail(segs) {
      lastTrail = segs;
      if (lastResult) drawAll(lastState, lastViewport);
    },
    setSearchHits(hits) {
      lastHits = hits;
      if (lastResult) drawAll(lastState, lastViewport);
    },
    destroy() {
      canvas.removeEventListener('click', onCanvasClick);
      canvas.remove();
    },
  };
}
