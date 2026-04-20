// S6 방어: sessionStorage는 페이지 JS·타 확장이 동일 origin에서 쓸 수 있다.
// HMAC 서명으로 역직렬화 전 검증. 실패 시 전량 파기.
//
// 주의 (S10): HMAC 키는 "무결성"만 보장. 비밀 보호가 아니다.
// 페이지 JS가 번들을 디컴파일하면 동일 key로 서명 가능.
// 따라서 이 레이어는 "우리가 쓰지 않은 값이 들어오는 사고" 방지 목적 — 크래킹 방지는 Store Kit에서.
//
// 스키마 버전 마이그레이션:
// - v1 (초기): 32bit djb2 signature → `h: number`
// - v2 (보안 강화): 64bit `sign64` (djb2+fnv1a) → `h: string`
// v1 레코드는 read() 시 version mismatch로 자동 파기. sessionStorage 세션 단위이므로
// 사용자 영향은 현재 세션 내 pins/trail 1회 리셋만 — 별도 마이그레이션 로직 불필요.

import { sign64 } from './hash';

export interface SignedRecord<T> {
  v: number;      // schema version (v>=2: h는 64bit 합성 문자열)
  ts: number;     // wrote at
  h: string;      // 64bit 합성 서명 (djb2+fnv1a)
  d: T;           // payload
}

const KEY_SALT = 0x5a17a17a; // bundle-wide fixed salt (소프트 변조 감지용)

function signBlob(body: string, salt: number): string {
  return sign64(body, salt);
}

export interface Storage {
  read<T>(key: string): T | null;
  write<T>(key: string, data: T): void;
  remove(key: string): void;
}

export function createSignedStorage(
  backend: Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>,
  opts?: { version?: number; now?: () => number; salt?: number },
): Storage {
  const version = opts?.version ?? 1;
  const now = opts?.now ?? (() => Date.now());
  const salt = opts?.salt ?? KEY_SALT;

  return {
    read<T>(key: string): T | null {
      let raw: string | null;
      try {
        raw = backend.getItem(key);
      } catch {
        return null;
      }
      if (raw === null) return null;
      let parsed: SignedRecord<T>;
      try {
        parsed = JSON.parse(raw) as SignedRecord<T>;
      } catch {
        backend.removeItem(key);
        return null;
      }
      if (!parsed || typeof parsed !== 'object' || parsed.v !== version) {
        backend.removeItem(key);
        return null;
      }
      const body = JSON.stringify({ v: parsed.v, ts: parsed.ts, d: parsed.d });
      const expected = signBlob(body, salt);
      if (expected !== parsed.h) {
        // S6: 외부 오염 감지. 전량 파기.
        backend.removeItem(key);
        return null;
      }
      return parsed.d;
    },
    write<T>(key: string, data: T): void {
      // Sev2 fix: now()을 한 번만 호출. 두 번 호출 시 ts가 달라져 read 시 HMAC 불일치 → 항상 파기.
      const ts = now();
      const body = JSON.stringify({ v: version, ts, d: data });
      const h = signBlob(body, salt);
      const record: SignedRecord<T> = { v: version, ts, h, d: data };
      try {
        backend.setItem(key, JSON.stringify(record));
      } catch {
        // quota/private-mode — silent fail (S12: Private 탭 정책)
      }
    },
    remove(key: string): void {
      try {
        backend.removeItem(key);
      } catch {
        // silent
      }
    },
  };
}
