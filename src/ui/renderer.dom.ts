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
  // Pin 탭 이벤트 수신을 위해 pointer-events auto. 개별 pin 요소에 click 핸들러.
  pinsLayer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;';
  container.appendChild(pinsLayer);

  const glowLayer = doc.createElement('div');
  glowLayer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;';
  container.appendChild(glowLayer);

  let palette: Palette = paletteFor(opts.colorScheme);
  let docHeight = 1;
  const isRight = opts.side === 'right';

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
      // width/height 강화: 히트맵 느낌. 큰 anchor는 두꺼운 바.
      let w = 40, h = 2, color = palette.heading3;
      switch (a.type) {
        case AnchorKind.Heading1: w = 90; h = 3; color = palette.heading1; break;
        case AnchorKind.Heading2: w = 75; h = 2; color = palette.heading2; break;
        case AnchorKind.Heading3: w = 60; h = 2; color = palette.heading3; break;
        case AnchorKind.Image:
        case AnchorKind.Video: w = 55; h = 3; color = palette.media; break;
        case AnchorKind.StrongText: w = 35; h = 1; color = palette.heading3; break;
        case AnchorKind.LinkCluster: w = 25; h = 1; color = palette.link; break;
      }
      // side-aware: 바의 보이는 edge(우측이면 right 0, 좌측이면 left 0)에서 뻗어나감
      const edgeStyle = isRight
        ? `right:2%;width:${w}%;`
        : `left:2%;width:${w}%;`;
      marker.style.cssText = `position:absolute;top:${yPct.toFixed(3)}%;${edgeStyle}height:${h}px;background:${color};`;
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
        const color = p.color ?? palette.pin;
        // 히트 영역 확장: 보이는 6px 도트 + 주변 히트 영역(12px 높이, 바 전체 폭)
        const edgeStyle = isRight
          ? 'right:0;width:100%;'
          : 'left:0;width:100%;';
        el.style.cssText = `position:absolute;top:${yPct.toFixed(3)}%;transform:translateY(-50%);${edgeStyle}height:12px;pointer-events:auto;cursor:pointer;`;
        // 내부 visible dot
        const dot = doc.createElement('div');
        const dotEdge = isRight ? 'right:0;' : 'left:0;';
        dot.style.cssText = `position:absolute;top:50%;transform:translateY(-50%);${dotEdge}width:6px;height:6px;background:${color};border-radius:3px;box-shadow:0 0 6px ${color},0 0 2px #fff;animation:wsm-pin-pulse 500ms ease-out;pointer-events:none;`;
        el.appendChild(dot);
        if (p.label) el.setAttribute('aria-label', p.label);
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          opts.onPinTap?.(p);
        });
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
