// 하이브리드 파사드. 앵커 수 기반 모드 전환 + 히스테리시스.

import type { MinimapRenderer, RendererOptions, ScannerResult, MinimapState, Pin, SearchHitMark, TrailSegment, ViewportRect } from '@core/types';
import { initialRenderMode, pickRenderMode, type RenderModeState } from '@core/renderMode';
import { createCanvasRenderer } from './renderer.canvas';
import { createDomRenderer } from './renderer.dom';

export interface HybridRenderer extends MinimapRenderer {
  currentMode(): RenderModeState['mode'];
}

export function createRenderer(root: ShadowRoot, opts: RendererOptions): HybridRenderer {
  let modeState: RenderModeState = { mode: 'dom', lastSwitchAt: 0 };
  let inner: MinimapRenderer | null = null;
  let lastResult: ScannerResult | null = null;
  let lastPins: ReadonlyArray<Pin> = [];
  let lastTrail: ReadonlyArray<TrailSegment> = [];
  let lastHits: ReadonlyArray<SearchHitMark> = [];
  let mounted = false;
  let initialized = false; // Sev2 fix: lastSwitchAt===0 sentinel이 now=0과 충돌 방지

  function build(mode: 'dom' | 'canvas'): MinimapRenderer {
    return mode === 'canvas' ? createCanvasRenderer(root, opts) : createDomRenderer(root, opts);
  }

  function swap(nextMode: 'dom' | 'canvas') {
    const prev = inner;
    inner = build(nextMode);
    inner.mount();
    if (lastResult) inner.update(lastResult);
    inner.setPins(lastPins);
    inner.setTrail(lastTrail);
    inner.setSearchHits(lastHits);
    prev?.destroy();
  }

  return {
    mount() {
      if (mounted) return;
      mounted = true;
      inner = build(modeState.mode);
      inner.mount();
      // Sev2 fix: mount 전 호출된 setSearchHits/setPins/setTrail 상태 재적용
      if (lastResult) inner.update(lastResult);
      inner.setPins(lastPins);
      inner.setTrail(lastTrail);
      inner.setSearchHits(lastHits);
    },
    update(result: ScannerResult) {
      lastResult = result;
      const now = performance.now();
      const next = initialized
        ? pickRenderMode(modeState, result.anchors.length, now)
        : initialRenderMode(result.anchors.length, now);
      initialized = true;
      if (next.mode !== modeState.mode) {
        modeState = next;
        swap(next.mode);
      } else {
        modeState = next;
      }
      inner?.update(result);
    },
    highlight(state: MinimapState, viewport: ViewportRect) {
      inner?.highlight(state, viewport);
    },
    setPins(pins) {
      lastPins = pins;
      inner?.setPins(pins);
    },
    setTrail(segs) {
      lastTrail = segs;
      inner?.setTrail(segs);
    },
    setSearchHits(hits) {
      lastHits = hits;
      inner?.setSearchHits(hits);
    },
    setPalette(p) {
      inner?.setPalette(p);
    },
    destroy() {
      inner?.destroy();
      inner = null;
      mounted = false;
    },
    currentMode() {
      return modeState.mode;
    },
  };
}
