// Hot path 규칙:
// - getBoundingClientRect 금지 (layout thrash). offsetTop + offsetParent 누적만.
// - 루프 내 new/[]/{} 할당 지양. 결과 배열은 1회만 확보.

import { AnchorKind, type AnchorPoint, type ScanOptions, type ScannerResult, type DensityBlock, type ContainerTarget, type Disposable } from './types';
import { djb2 } from './hash';
import { warnSlowScan } from './assert';
import { TUNING } from '@config/tuning';

const SELECTOR =
  'h1,h2,h3,h4,h5,h6,img,video,strong,b,a';

export interface ScannerDeps {
  now(): number;
  random(): number;
  createObserver(target: Node, cb: (records: MutationRecord[]) => void): Disposable;
}

export interface Scanner {
  scan(root: Element, opts?: Partial<ScanOptions>): ScannerResult;
  detectContainer(): ContainerTarget;
  dispose(): void;
}

function classify(el: Element): AnchorKind | null {
  const tag = el.tagName;
  if (tag === 'H1') return AnchorKind.Heading1;
  if (tag === 'H2') return AnchorKind.Heading2;
  if (tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6') return AnchorKind.Heading3;
  if (tag === 'IMG') return AnchorKind.Image;
  if (tag === 'VIDEO') return AnchorKind.Video;
  if (tag === 'STRONG' || tag === 'B') return AnchorKind.StrongText;
  if (tag === 'A') return AnchorKind.LinkCluster;
  return null;
}

function weightFor(kind: AnchorKind): number {
  switch (kind) {
    case AnchorKind.Heading1: return 1.0;
    case AnchorKind.Heading2: return 0.75;
    case AnchorKind.Heading3: return 0.5;
    case AnchorKind.Image: return 0.6;
    case AnchorKind.Video: return 0.7;
    case AnchorKind.StrongText: return 0.3;
    case AnchorKind.LinkCluster: return 0.2;
  }
}

// offsetTop 누적: fixed/sticky 제외. offsetParent 체인을 따라 올라간다.
// Sev1 fix: 체인 중간에 offsetParent가 null이면 detached/display:none이므로 -1 반환.
function cumulativeOffsetTop(el: HTMLElement): number {
  if (el.offsetParent === null && el.tagName !== 'BODY') return -1;
  let y = 0;
  let cur: HTMLElement | null = el;
  while (cur) {
    y += cur.offsetTop;
    cur = cur.offsetParent as HTMLElement | null;
  }
  return y;
}

function buildDensityBlocks(anchors: ReadonlyArray<AnchorPoint>, docHeight: number): DensityBlock[] {
  const BLOCK_COUNT = 64;
  if (docHeight <= 0) return [];
  const step = docHeight / BLOCK_COUNT;
  const blocks: DensityBlock[] = [];
  for (let i = 0; i < BLOCK_COUNT; i++) {
    blocks.push({
      yStart: i * step,
      yEnd: (i + 1) * step,
      textScore: 0,
      mediaScore: 0,
      linkScore: 0,
    });
  }
  for (const a of anchors) {
    const idx = Math.min(BLOCK_COUNT - 1, Math.max(0, Math.floor(a.y / step)));
    const b = blocks[idx];
    if (!b) continue;
    switch (a.type) {
      case AnchorKind.Heading1:
      case AnchorKind.Heading2:
      case AnchorKind.Heading3:
      case AnchorKind.StrongText:
        b.textScore += a.weight;
        break;
      case AnchorKind.Image:
      case AnchorKind.Video:
        b.mediaScore += a.weight;
        break;
      case AnchorKind.LinkCluster:
        b.linkScore += a.weight;
        break;
    }
  }
  return blocks;
}

export function createScanner(deps: ScannerDeps): Scanner {
  const lifecycle: Disposable[] = [];

  return {
    scan(root: Element, opts?: Partial<ScanOptions>): ScannerResult {
      const maxAnchors = opts?.maxAnchors ?? TUNING.maxAnchors;
      const t0 = deps.now();
      const elements = root.querySelectorAll<HTMLElement>(SELECTOR);
      const anchors: AnchorPoint[] = [];

      for (let i = 0; i < elements.length && anchors.length < maxAnchors; i++) {
        const el = elements[i];
        if (!el) continue;
        if (el.offsetParent === null && el.tagName !== 'BODY') continue; // display:none
        if (el.offsetHeight === 0) continue;
        const kind = classify(el);
        if (kind === null) continue;
        const y = cumulativeOffsetTop(el);
        if (y < 0) continue;
        const rawText = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);
        // 프라이버시: snippet은 heading/strong 계열에만 저장 (제목 맥락).
        // 이미지/링크 클러스터는 snippet 비움 (사용자 입력 유출 방지).
        const keepSnippet =
          kind === AnchorKind.Heading1 ||
          kind === AnchorKind.Heading2 ||
          kind === AnchorKind.Heading3 ||
          kind === AnchorKind.StrongText;
        anchors.push({
          y,
          type: kind,
          weight: weightFor(kind),
          textHash: djb2(rawText),
          snippet: keepSnippet ? rawText : '',
        });
      }

      anchors.sort((a, b) => a.y - b.y);
      const scrollEl = document.scrollingElement ?? document.documentElement;
      const docHeight = scrollEl.scrollHeight;
      const blocks = buildDensityBlocks(anchors, docHeight);
      const elapsedMs = deps.now() - t0;
      warnSlowScan(elapsedMs);

      return {
        anchors,
        blocks,
        docHeight,
        scannedAt: deps.now(),
        elapsedMs,
      };
    },

    detectContainer(): ContainerTarget {
      // 1차: window 스크롤. H5 (내부 스크롤 컨테이너)는 후속 사이클에서 수동 피커.
      return {
        kind: 'window',
        el: null,
        getScrollY: () => window.scrollY,
        setScrollY: (y: number) => window.scrollTo(0, y), // D6: 즉시 모드, smooth 금지
        getHeight: () => window.innerHeight,
        getDocHeight: () => (document.scrollingElement ?? document.documentElement).scrollHeight,
      };
    },

    dispose() {
      for (const d of lifecycle) d.dispose();
      lifecycle.length = 0;
    },
  };
}
