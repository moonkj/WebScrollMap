// djb2 — 결정적 textHash. 스캔 스냅샷 테스트 지원.
export function djb2(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

// FNV-1a 32bit — djb2와 독립적인 다른 해시. 서명 강도 강화용.
export function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/**
 * 64-bit 서명 = djb2 + fnv1a를 '-'로 연결. 단일 32bit djb2 대비 충돌/위조 저항 ~2^32배.
 * 클라이언트 서명이라 궁극적 위조 방지는 불가 — 그러나 시간·전문성 요구를 대폭 상승.
 * 실제 보안은 StoreKit receipt(Apple) 서버 검증 추가가 근본 해법.
 */
export function sign64(body: string, salt: string | number): string {
  const s = typeof salt === 'number' ? salt.toString(16).padStart(8, '0') : salt;
  const a = djb2(`${s}:${body}`);
  const b = fnv1a(`${s}#${body}`);
  // 8-char zero-padding — JS/Swift 양쪽 길이 일치 보장.
  return `${a.toString(16).padStart(8, '0')}-${b.toString(16).padStart(8, '0')}`;
}
