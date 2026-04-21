// H5: window.scroll이 아닌 내부 스크롤 컨테이너를 쓰는 사이트(Gmail, Notion, Slack 등) 대응.
// 휴리스틱: overflow auto/scroll + scrollHeight > clientHeight + 적절한 높이 차지.

import type { ContainerTarget } from '@core/types';

export interface ContainerDetectOptions {
  minScrollRatio: number; // scrollHeight / clientHeight 최소 비율
  minHeightRatio: number; // 뷰포트 대비 컨테이너 높이 최소 비율
  maxCandidates: number;  // 전체 탐색 상한
}

const DEFAULT_OPTS: ContainerDetectOptions = {
  minScrollRatio: 1.5,
  minHeightRatio: 0.5,
  maxCandidates: 3,
};

function isScrollable(el: Element, win: Window): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const cs = win.getComputedStyle(el);
  const oy = cs.overflowY;
  if (oy !== 'auto' && oy !== 'scroll' && oy !== 'overlay') return false;
  return el.scrollHeight > el.clientHeight + 2;
}

export function windowTarget(win: Window = window, doc: Document = document): ContainerTarget {
  const scrollEl = () => doc.scrollingElement ?? doc.documentElement;
  return {
    kind: 'window',
    el: null,
    // H-REL-4: getScrollY와 setScrollY 좌표원을 일치. 이전엔 getScrollY가 win.scrollY,
    // setScrollY가 scrollingElement.scrollTop을 써서 iOS Safari에서 비대칭이 jitter 유발.
    getScrollY: () => {
      const el = scrollEl() as HTMLElement;
      return el.scrollTop;
    },
    // scrollTop 직접 할당 — 가장 단순, 확실. win.scrollTo는 smooth 스크롤로 해석되는 경우 있음.
    setScrollY: (y) => {
      const el = scrollEl() as HTMLElement;
      el.scrollTop = y;
    },
    // iOS Safari: clientY는 visual viewport 기준 → vpH도 visualViewport.height 우선.
    // innerHeight는 layout viewport일 수 있어 mapEventToY의 vpH/2 오프셋이 과도해짐 →
    // finger가 indicator 하단에 위치하는 증상. visualViewport로 일관성 확보.
    getHeight: () => {
      const vv = (win as unknown as { visualViewport?: VisualViewport }).visualViewport;
      return vv && vv.height > 0 ? vv.height : win.innerHeight;
    },
    getDocHeight: () => scrollEl().scrollHeight,
  };
}

export function elementTarget(el: HTMLElement): ContainerTarget {
  return {
    kind: 'element',
    el,
    getScrollY: () => el.scrollTop,
    setScrollY: (y) => {
      el.scrollTop = y;
    },
    getHeight: () => el.clientHeight,
    getDocHeight: () => el.scrollHeight,
  };
}

// Window 스크롤이 유효하면 우선. 아니면 최대 scrollable 내부 컨테이너를 찾는다.
export function detectScrollContainer(
  doc: Document = document,
  win: Window = window,
  opts: Partial<ContainerDetectOptions> = {},
): ContainerTarget {
  const o: ContainerDetectOptions = { ...DEFAULT_OPTS, ...opts };
  const scrollEl = doc.scrollingElement ?? doc.documentElement;

  // 1) window scroll이 이미 충분하면 그것을 씀
  if (scrollEl.scrollHeight > win.innerHeight * o.minScrollRatio) {
    return windowTarget(win, doc);
  }

  // 2) 내부 컨테이너 후보 수집 — body 전체 순회는 비쌈. main/article/role=main 우선.
  const selectorPool = ['main', 'article', '[role="main"]', 'body *'];
  const seen = new Set<Element>();
  const scored: { el: HTMLElement; score: number }[] = [];

  outer: for (const sel of selectorPool) {
    const nodes = doc.querySelectorAll<HTMLElement>(sel);
    for (const el of nodes) {
      if (seen.has(el)) continue;
      seen.add(el);
      if (!isScrollable(el, win)) continue;
      const h = el.clientHeight;
      if (h < win.innerHeight * o.minHeightRatio) continue;
      const ratio = el.scrollHeight / Math.max(1, h);
      if (ratio < o.minScrollRatio) continue;
      scored.push({ el, score: ratio * h });
      if (scored.length >= o.maxCandidates * 8) break outer;
    }
    if (scored.length >= o.maxCandidates) break;
  }

  if (scored.length === 0) return windowTarget(win, doc);
  scored.sort((a, b) => b.score - a.score);
  return elementTarget(scored[0]!.el);
}
