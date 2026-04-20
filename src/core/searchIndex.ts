// S7: 네이티브 Cmd+F 가로채기 금지. 자체 검색 패널이 사용할 텍스트 인덱스.
// 페이지 내 TextNode를 순회하며 y 위치와 snippet만 수집. 원문은 저장하지 않음 (메모리/프라이버시).
// 검색어는 in-memory only (sessionStorage 저장 금지 — S7).

export interface SearchIndexEntry {
  y: number;         // document Y
  textLower: string; // lower-cased sampled text (최대 120자)
}

export interface SearchHit {
  y: number;
}

// Sev1/Sev2 fix: cap 2000으로 축소 + 부모 offsetTop 캐시 (동일 단락 내 텍스트노드 반복 방지).
const MAX_ENTRIES = 2000;
const SAMPLE_LEN = 120;

function offsetTopOf(el: HTMLElement): number {
  if (el.offsetParent === null && el.tagName !== 'BODY') return -1;
  let y = 0;
  let cur: HTMLElement | null = el;
  while (cur) {
    y += cur.offsetTop;
    cur = cur.offsetParent as HTMLElement | null;
  }
  return y;
}

export function buildSearchIndex(root: Element): SearchIndexEntry[] {
  const out: SearchIndexEntry[] = [];
  const cache = new WeakMap<HTMLElement, number>();
  // 텍스트 보유 가능 태그만 (script/style 등은 walker가 자동 스킵)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const p = n.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      const t = p.tagName;
      if (t === 'SCRIPT' || t === 'STYLE' || t === 'NOSCRIPT' || t === 'TEMPLATE') return NodeFilter.FILTER_REJECT;
      const text = n.nodeValue;
      if (!text || text.trim().length < 2) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node: Node | null = walker.nextNode();
  while (node && out.length < MAX_ENTRIES) {
    const p = node.parentElement!;
    let y = cache.get(p);
    if (y === undefined) {
      y = offsetTopOf(p);
      cache.set(p, y);
    }
    if (y >= 0) {
      out.push({
        y,
        textLower: (node.nodeValue ?? '').slice(0, SAMPLE_LEN).toLowerCase(),
      });
    }
    node = walker.nextNode();
  }
  return out;
}

export function searchIndex(
  entries: ReadonlyArray<SearchIndexEntry>,
  query: string,
): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const hits: SearchHit[] = [];
  for (const e of entries) {
    if (e.textLower.includes(q)) hits.push({ y: e.y });
  }
  // dedupe nearby hits (same paragraph splits)
  hits.sort((a, b) => a.y - b.y);
  const deduped: SearchHit[] = [];
  for (const h of hits) {
    const last = deduped[deduped.length - 1];
    if (!last || Math.abs(h.y - last.y) > 8) deduped.push(h);
  }
  return deduped;
}
