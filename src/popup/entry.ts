// Popup 스크립트. background runtime API로 settings 조회/변경.

import { DEFAULT_SETTINGS, type Settings, type WsmResponse, type PageStatus, type PinSummary } from '@core/messages';
import { getBrowserApi } from '@platform/browserApi';

const api = getBrowserApi();

function applyI18n(root: Document) {
  const get = (k: string): string | null => {
    try {
      const native = (globalThis as unknown as { browser?: { i18n?: { getMessage(k: string): string } }; chrome?: { i18n?: { getMessage(k: string): string } } });
      const msg = native.browser?.i18n?.getMessage(k) ?? native.chrome?.i18n?.getMessage(k);
      return msg && msg.length > 0 ? msg : null;
    } catch {
      return null;
    }
  };
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const k = el.dataset.i18n;
    if (!k) return;
    const v = get(k);
    if (v !== null) el.textContent = v;
  });
}

async function fetchSettings(): Promise<Settings> {
  try {
    const r = (await api.runtime.sendMessage({ type: 'get-settings' })) as WsmResponse;
    if (r.ok && r.settings) return r.settings;
  } catch {
    // fall through
  }
  return { ...DEFAULT_SETTINGS };
}

async function saveSettings(patch: Partial<Settings>): Promise<Settings | null> {
  try {
    const r = (await api.runtime.sendMessage({ type: 'set-settings', settings: patch })) as WsmResponse;
    if (r.ok && r.settings) return r.settings;
  } catch {
    // fall through
  }
  return null;
}

async function fetchStatus(): Promise<PageStatus | null> {
  try {
    const r = (await api.runtime.sendMessage({ type: 'get-status' })) as WsmResponse;
    if (r.ok && r.status) return r.status;
  } catch {
    // content script not loaded
  }
  return null;
}

async function fetchPins(): Promise<PinSummary[]> {
  try {
    const r = (await api.runtime.sendMessage({ type: 'get-pins' })) as WsmResponse;
    if (r.ok && r.pins) return r.pins;
  } catch {
    // noop
  }
  return [];
}

async function jumpToPin(id: string): Promise<void> {
  try {
    await api.runtime.sendMessage({ type: 'jump-to-pin', pinId: id });
  } catch {
    // noop
  }
}

async function deletePin(id: string): Promise<void> {
  try {
    await api.runtime.sendMessage({ type: 'delete-pin', pinId: id });
  } catch {
    // noop
  }
}

function renderPins(pins: ReadonlyArray<PinSummary>, refresh: () => Promise<void>) {
  const list = document.getElementById('pins-list') as HTMLUListElement | null;
  const empty = document.getElementById('pins-empty');
  if (!list) return;
  list.textContent = '';
  if (pins.length === 0) {
    empty?.classList.add('wsm-visible');
    return;
  }
  empty?.classList.remove('wsm-visible');
  pins.forEach((p, i) => {
    const li = document.createElement('li');
    li.setAttribute('role', 'button');
    li.tabIndex = 0;

    const dot = document.createElement('span');
    dot.className = 'wsm-pin-dot';
    if (p.color) dot.style.background = p.color;

    const info = document.createElement('span');
    info.className = 'wsm-pin-info';
    info.textContent = `#${i + 1} · ${p.pct}%`;

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'wsm-pin-delete';
    del.textContent = '×';
    del.setAttribute('aria-label', `Delete pin ${i + 1}`);
    del.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deletePin(p.id);
      await refresh();
    });

    li.append(dot, info, del);
    li.addEventListener('click', async () => {
      await jumpToPin(p.id);
      // 창 자동 닫기 (iOS Safari는 확장 popup 닫기 API 없음, 효과는 제한적)
      window.close?.();
    });
    li.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        await jumpToPin(p.id);
        window.close?.();
      }
    });

    list.appendChild(li);
  });
}

function render(settings: Settings, status: PageStatus | null) {
  const enabled = document.getElementById('enabled') as HTMLInputElement | null;
  if (enabled) enabled.checked = settings.enabled;

  document.querySelectorAll<HTMLButtonElement>('[data-side]').forEach((b) => {
    b.setAttribute('aria-pressed', b.dataset.side === settings.side ? 'true' : 'false');
  });
  document.querySelectorAll<HTMLButtonElement>('[data-margin]').forEach((b) => {
    b.setAttribute('aria-pressed', String(Number(b.dataset.margin)) === String(settings.marginPx) ? 'true' : 'false');
  });

  const el = document.getElementById('status');
  if (el) {
    if (!status) {
      el.textContent = 'content script 미주입 (페이지 새로고침 필요)';
    } else if (!status.activatable) {
      el.textContent = '이 페이지는 너무 짧아 비활성 (지도화할 구조 없음)';
    } else {
      const kind =
        status.containerKind === 'element'
          ? ' · 내부 스크롤'
          : '';
      el.textContent = `${status.anchorCount} anchors · ${status.pinCount} pins${kind}`;
    }
  }
}

async function init() {
  applyI18n(document);
  let settings = await fetchSettings();
  const status = await fetchStatus();
  render(settings, status);

  async function refreshPins() {
    const pins = await fetchPins();
    renderPins(pins, refreshPins);
  }
  await refreshPins();

  document.getElementById('enabled')?.addEventListener('change', async (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    const next = await saveSettings({ enabled: checked });
    if (next) {
      settings = next;
      render(settings, status);
    }
  });

  document.querySelectorAll<HTMLButtonElement>('[data-side]').forEach((b) =>
    b.addEventListener('click', async () => {
      const side = b.dataset.side === 'left' ? 'left' : 'right';
      const next = await saveSettings({ side });
      if (next) {
        settings = next;
        render(settings, status);
      }
    }),
  );

  document.querySelectorAll<HTMLButtonElement>('[data-margin]').forEach((b) =>
    b.addEventListener('click', async () => {
      const raw = Number(b.dataset.margin);
      const m = raw === 0 || raw === 24 ? raw : 16;
      const next = await saveSettings({ marginPx: m });
      if (next) {
        settings = next;
        render(settings, status);
      }
    }),
  );

  document.getElementById('clear-pins')?.addEventListener('click', async () => {
    try {
      await api.runtime.sendMessage({ type: 'clear-pins' });
      await refreshPins();
    } catch {
      // silent
    }
  });
  document.getElementById('clear-trail')?.addEventListener('click', async () => {
    try {
      await api.runtime.sendMessage({ type: 'clear-trail' });
    } catch {
      // silent
    }
  });
}

void init();
