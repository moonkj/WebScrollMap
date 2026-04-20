// Pin Drop: 세션별 최대 3개 위치 고정. sessionStorage + HMAC.
// S6 방어: same-origin same-path만 저장. URL은 pathname만 키로 사용.

import type { Pin } from './types';
import type { Storage } from './storage';

export const MAX_PINS = 5;

export interface PinStore {
  list(): ReadonlyArray<Pin>;
  add(pin: Omit<Pin, 'id'>): Pin | null; // null: 포화
  remove(id: string): void;
  clear(): void;
}

function keyFor(pathname: string): string {
  return `wsm:pins:${pathname}`;
}

function makeId(random: () => number): string {
  return Math.floor(random() * 1e9).toString(36);
}

export function createPinStore(
  storage: Storage,
  pathname: string,
  random: () => number = Math.random,
): PinStore {
  const key = keyFor(pathname);
  let cache: Pin[] = storage.read<Pin[]>(key) ?? [];

  function persist() {
    if (cache.length === 0) {
      storage.remove(key);
    } else {
      storage.write<Pin[]>(key, cache);
    }
  }

  return {
    list() {
      return cache.slice();
    },
    add(pin) {
      if (cache.length >= MAX_PINS) return null;
      const newPin: Pin = { id: makeId(random), ...pin };
      cache = [...cache, newPin];
      persist();
      return newPin;
    },
    remove(id) {
      const before = cache.length;
      cache = cache.filter((p) => p.id !== id);
      if (cache.length !== before) persist();
    },
    clear() {
      cache = [];
      storage.remove(key);
    },
  };
}
