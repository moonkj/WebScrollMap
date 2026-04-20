// DOM 모드: 앵커 <600. CSS transform 기반. 접근성(role=scrollbar) 네이티브 이점.

import { AnchorKind, type MinimapRenderer, type MinimapState, type Pin, type RendererOptions, type ScannerResult, type SearchHitMark, type TrailSegment, type ViewportRect } from '@core/types';
import { paletteFor, type Palette } from './palette';

export function createDomRenderer(root: ShadowRoot, opts: RendererOptions): MinimapRenderer {
  const doc = root.ownerDocument ?? document;
  const container = doc.createElement('div');
  container.className = 'wsm-track';
  container.setAttribute('role', 'scrollbar');
  container.setAttribute('aria-orientation', 'vertical');
  container.style.cssText = `width: ${opts.width}px; height: 100%; position: absolute; top: 0; right: 0;`;

  const track = doc.createElement('div');
  track.style.cssText = 'position: absolute; inset: 0;';
  container.appendChild(track);

  const indicator = doc.createElement('div');
  indicator.style.cssText = 'position: absolute; left: 0; right: 0; pointer-events: none;';
  container.appendChild(indicator);

  const trailLayer = doc.createElement('div');
  trailLayer.style.cssText = 'position: absolute; top: 0; left: 0; width: 1px; height: 100%;';
  container.appendChild(trailLayer);

  const pinsLayer = doc.createElement('div');
  pinsLayer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;';
  container.appendChild(pinsLayer);

  const glowLayer = doc.createElement('div');
  glowLayer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;';
  container.appendChild(glowLayer);

  let palette: Palette = paletteFor(opts.colorScheme);
  let docHeight = 1;

  function applyPalette() {
    container.style.backgroundColor = palette.track;
    indicator.style.backgroundColor = palette.indicator;
  }

  function renderAnchors(result: ScannerResult) {
    track.textContent = '';
    docHeight = result.docHeight || 1;
    for (const a of result.anchors) {
      const marker = doc.createElement('div');
      const yPct = (a.y / docHeight) * 100;
      let w = 40, left = 30, color = palette.heading3;
      switch (a.type) {
        case AnchorKind.Heading1: w = 80; left = 10; color = palette.heading1; break;
        case AnchorKind.Heading2: w = 65; left = 20; color = palette.heading2; break;
        case AnchorKind.Heading3: w = 50; left = 30; color = palette.heading3; break;
        case AnchorKind.Image:
        case AnchorKind.Video: w = 45; left = 35; color = palette.media; break;
        case AnchorKind.StrongText: w = 30; left = 45; color = palette.heading3; break;
        case AnchorKind.LinkCluster: w = 25; left = 55; color = palette.link; break;
      }
      marker.style.cssText = `position:absolute;top:${yPct.toFixed(3)}%;left:${left}%;width:${w}%;height:1px;background:${color};`;
      track.appendChild(marker);
    }
  }

  return {
    mount() {
      applyPalette();
      root.appendChild(container);
    },
    update(result) {
      renderAnchors(result);
    },
    highlight(_state: MinimapState, viewport: ViewportRect) {
      const docH = viewport.docHeight || docHeight || 1;
      const topPct = (viewport.scrollY / docH) * 100;
      const hPct = (viewport.height / docH) * 100;
      indicator.style.top = `${topPct.toFixed(3)}%`;
      indicator.style.height = `${Math.max(1, hPct).toFixed(3)}%`;
      const pct = docH > 0 ? viewport.scrollY / (docH - viewport.height || 1) : 0;
      container.setAttribute('aria-valuenow', String(Math.round(pct * 100)));
      container.setAttribute('aria-valuemin', '0');
      container.setAttribute('aria-valuemax', '100');
    },
    setPins(pins: ReadonlyArray<Pin>) {
      pinsLayer.textContent = '';
      for (const p of pins) {
        const el = doc.createElement('div');
        const yPct = (p.y / (docHeight || 1)) * 100;
        el.style.cssText = `position:absolute;top:${yPct.toFixed(3)}%;left:5%;width:20%;height:3px;background:${p.color ?? palette.heading1};border-radius:2px;`;
        if (p.label) el.setAttribute('aria-label', p.label);
        pinsLayer.appendChild(el);
      }
    },
    setTrail(segs: ReadonlyArray<TrailSegment>) {
      trailLayer.textContent = '';
      for (const s of segs) {
        const top = (s.yStart / (docHeight || 1)) * 100;
        const h = ((s.yEnd - s.yStart) / (docHeight || 1)) * 100;
        const line = doc.createElement('div');
        line.style.cssText = `position:absolute;top:${top.toFixed(3)}%;left:0;width:1px;height:${Math.max(0.1, h).toFixed(3)}%;background:${palette.trail};`;
        trailLayer.appendChild(line);
      }
    },
    setSearchHits(hits: ReadonlyArray<SearchHitMark>) {
      glowLayer.textContent = '';
      for (const h of hits) {
        const top = (h.y / (docHeight || 1)) * 100;
        const dot = doc.createElement('div');
        dot.style.cssText = `position:absolute;top:${top.toFixed(3)}%;left:62%;width:32%;height:3px;background:${palette.searchGlow};border-radius:2px;`;
        glowLayer.appendChild(dot);
      }
    },
    destroy() {
      container.remove();
    },
  };
}
