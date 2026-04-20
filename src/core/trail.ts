// Progress Trail: 읽은 스크롤 구간 누적. 세션별(pathname) 저장. merge-on-write.

import type { TrailSegment } from './types';
import type { Storage } from './storage';

export const MAX_TRAIL_SEGMENTS = 256;
const MERGE_GAP_PX = 48;

export interface TrailStore {
  list(): ReadonlyArray<TrailSegment>;
  record(yStart: number, yEnd: number, now: number): void;
  clear(): void;
}

function keyFor(pathname: string): string {
  return `wsm:trail:${pathname}`;
}

function mergeInto(segs: TrailSegment[], next: TrailSegment): TrailSegment[] {
  // segs는 yStart 정렬 유지 가정.
  // Sev2 fix: next가 확장되면 이후 세그먼트와도 또 겹칠 수 있으므로 끝까지 쭉 훑어 모두 흡수.
  if (next.yEnd <= next.yStart) return segs;
  const kept: TrailSegment[] = [];
  let merged = { ...next };
  for (const s of segs) {
    const overlaps = s.yEnd + MERGE_GAP_PX >= merged.yStart && s.yStart - MERGE_GAP_PX <= merged.yEnd;
    if (overlaps) {
      merged = {
        yStart: Math.min(s.yStart, merged.yStart),
        yEnd: Math.max(s.yEnd, merged.yEnd),
        visitedAt: Math.max(s.visitedAt, merged.visitedAt),
      };
    } else {
      kept.push(s);
    }
  }
  kept.push(merged);
  kept.sort((a, b) => a.yStart - b.yStart);
  // cap
  if (kept.length > MAX_TRAIL_SEGMENTS) {
    kept.sort((a, b) => a.visitedAt - b.visitedAt);
    kept.splice(0, kept.length - MAX_TRAIL_SEGMENTS);
    kept.sort((a, b) => a.yStart - b.yStart);
  }
  return kept;
}

export function createTrailStore(storage: Storage, pathname: string): TrailStore {
  const key = keyFor(pathname);
  let cache: TrailSegment[] = (storage.read<TrailSegment[]>(key) ?? []).slice();
  cache.sort((a, b) => a.yStart - b.yStart);

  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  function flushLater() {
    if (flushTimer !== null) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      if (cache.length === 0) storage.remove(key);
      else storage.write<TrailSegment[]>(key, cache);
    }, 1000);
  }

  return {
    list() {
      return cache;
    },
    record(yStart, yEnd, now) {
      cache = mergeInto(cache, { yStart, yEnd, visitedAt: now });
      flushLater();
    },
    clear() {
      cache = [];
      storage.remove(key);
    },
  };
}
