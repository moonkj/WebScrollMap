export const enum AnchorKind {
  Heading1 = 1,
  Heading2 = 2,
  Heading3 = 3,
  Image = 4,
  Video = 5,
  StrongText = 6,
  LinkCluster = 7,
}

export interface AnchorPoint {
  y: number;
  type: AnchorKind;
  weight: number;
  textHash: number;
  /** 최대 40자 — 매그니파이/섹션 배지 표시용. heading 계열만 채워짐, 그 외 empty */
  snippet: string;
}

export interface DensityBlock {
  yStart: number;
  yEnd: number;
  textScore: number;
  mediaScore: number;
  linkScore: number;
}

export interface ScanOptions {
  maxAnchors: number;
  timeBudgetMs: number;
  containerRoot?: Element;
}

export interface ScannerResult {
  anchors: ReadonlyArray<AnchorPoint>;
  blocks: ReadonlyArray<DensityBlock>;
  docHeight: number;
  scannedAt: number;
  elapsedMs: number;
}

export type RenderMode = 'dom' | 'canvas';

export type MinimapState =
  | 'slim'
  | 'expanded'
  | 'scrubbing'
  | 'search'
  | 'inactive'
  | 'loading'
  | 'error'
  | 'dark';

export interface ViewportRect {
  scrollY: number;
  height: number;
  docHeight: number;
}

export interface Pin {
  id: string;
  y: number;
  color?: string;
  label?: string;
}

export interface TrailSegment {
  yStart: number;
  yEnd: number;
  visitedAt: number;
}

export interface ContainerTarget {
  kind: 'window' | 'element';
  el: HTMLElement | null;
  getScrollY(): number;
  setScrollY(y: number): void;
  getHeight(): number;
  getDocHeight(): number;
}

export interface Disposable {
  dispose(): void;
}

export interface RendererOptions {
  width: number;
  height: number;
  dpr: number;
  colorScheme: 'light' | 'dark';
  side: 'left' | 'right';
  onSlowFrame?(ms: number): void;
  /** Pin 탭 → 해당 y로 점프 */
  onPinTap?(pin: Pin): void;
}

export interface SearchHitMark {
  y: number;
}

// Sev1 계약: Canvas/DOM 구현체가 반드시 준수. 드리프트 방지.
export interface MinimapRenderer {
  mount(): void;
  update(result: ScannerResult): void;
  highlight(state: MinimapState, viewport: ViewportRect): void;
  setPins(pins: ReadonlyArray<Pin>): void;
  setTrail(segs: ReadonlyArray<TrailSegment>): void;
  setSearchHits(hits: ReadonlyArray<SearchHitMark>): void;
  destroy(): void;
}
