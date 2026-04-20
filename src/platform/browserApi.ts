// Safari Web Extension / Chromium 공용 브라우저 API 어댑터.
// 테스트·개발 환경(브라우저 API 없음)에서는 no-op 스텁.

export interface StorageArea {
  get(keys: string | string[] | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

export interface RuntimeApi {
  sendMessage<T = unknown>(msg: unknown): Promise<T>;
  onMessage: {
    addListener(cb: (msg: unknown, sender: unknown, sendResponse: (r: unknown) => void) => boolean | void): void;
    removeListener(cb: (msg: unknown, sender: unknown, sendResponse: (r: unknown) => void) => boolean | void): void;
  };
}

export interface TabsApi {
  query(q: { active?: boolean; currentWindow?: boolean }): Promise<Array<{ id?: number }>>;
  sendMessage<T = unknown>(tabId: number, msg: unknown): Promise<T>;
}

export interface BrowserApi {
  storage: { local: StorageArea; session?: StorageArea };
  runtime: RuntimeApi;
  tabs?: TabsApi;
}

function findNative(): BrowserApi | null {
  const g = globalThis as unknown as {
    browser?: BrowserApi;
    chrome?: BrowserApi;
  };
  if (g.browser?.runtime?.onMessage) return g.browser;
  if (g.chrome?.runtime?.onMessage) return g.chrome;
  return null;
}

function memoryStorage(): StorageArea {
  const data = new Map<string, unknown>();
  return {
    async get(keys) {
      if (keys === null) {
        return Object.fromEntries(data);
      }
      const list = Array.isArray(keys) ? keys : [keys];
      const out: Record<string, unknown> = {};
      for (const k of list) if (data.has(k)) out[k] = data.get(k);
      return out;
    },
    async set(items) {
      for (const [k, v] of Object.entries(items)) data.set(k, v);
    },
    async remove(keys) {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const k of list) data.delete(k);
    },
  };
}

export function getBrowserApi(): BrowserApi {
  const native = findNative();
  if (native) return native;
  // dev/test fallback
  const noOpMsg: RuntimeApi = {
    async sendMessage() {
      throw new Error('runtime.sendMessage unavailable in this context');
    },
    onMessage: { addListener() {}, removeListener() {} },
  };
  return {
    storage: { local: memoryStorage(), session: memoryStorage() },
    runtime: noOpMsg,
  };
}
