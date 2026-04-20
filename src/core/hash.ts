// djb2 — 결정적 textHash. 스캔 스냅샷 테스트 지원.
export function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}
