// Popup — Pro tier 인식 + 결제 + 복원 + 확장 설정.

import {
  DEFAULT_SETTINGS,
  type Settings,
  type WsmResponse,
  type PageStatus,
  type PinSummary,
} from '@core/messages';
import { getBrowserApi } from '@platform/browserApi';
import type { Tier, Entitlement } from '@core/entitlement';

const api = getBrowserApi();

function applyI18n(root: Document) {
  const get = (k: string): string | null => {
    try {
      const n = globalThis as unknown as {
        browser?: { i18n?: { getMessage(k: string): string } };
        chrome?: { i18n?: { getMessage(k: string): string } };
      };
      const msg = n.browser?.i18n?.getMessage(k) ?? n.chrome?.i18n?.getMessage(k);
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
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

async function saveSettings(patch: Partial<Settings>): Promise<Settings | null> {
  try {
    const r = (await api.runtime.sendMessage({ type: 'set-settings', settings: patch })) as WsmResponse;
    if (r.ok && r.settings) return r.settings;
  } catch {}
  return null;
}

async function fetchStatus(): Promise<PageStatus | null> {
  try {
    const r = (await api.runtime.sendMessage({ type: 'get-status' })) as WsmResponse;
    if (r.ok && r.status) return r.status;
  } catch {}
  return null;
}

async function fetchEntitlement(): Promise<{ tier: Tier; entitlement: Entitlement | null }> {
  try {
    const r = (await api.runtime.sendMessage({ type: 'get-entitlement' })) as WsmResponse;
    if (r.ok) return { tier: r.tier ?? 'free', entitlement: r.entitlement ?? null };
  } catch {}
  return { tier: 'free', entitlement: null };
}

async function purchasePro(): Promise<Tier> {
  try {
    const r = (await api.runtime.sendMessage({ type: 'purchase-pro' })) as WsmResponse;
    if (r.ok) return r.tier ?? 'free';
  } catch {}
  return 'free';
}

async function restorePurchases(): Promise<Tier> {
  try {
    const r = (await api.runtime.sendMessage({ type: 'restore-purchases' })) as WsmResponse;
    if (r.ok) return r.tier ?? 'free';
  } catch {}
  return 'free';
}

async function fetchPins(): Promise<PinSummary[]> {
  try {
    const r = (await api.runtime.sendMessage({ type: 'get-pins' })) as WsmResponse;
    if (r.ok && r.pins) return r.pins;
  } catch {}
  return [];
}

async function jumpToPin(id: string) {
  try {
    await api.runtime.sendMessage({ type: 'jump-to-pin', pinId: id });
  } catch {}
}

async function deletePin(id: string) {
  try {
    await api.runtime.sendMessage({ type: 'delete-pin', pinId: id });
  } catch {}
}

function applyTierUI(tier: Tier) {
  const badge = document.getElementById('tier-badge');
  if (badge) {
    badge.textContent = tier === 'pro' ? 'PRO' : 'FREE';
    badge.classList.toggle('pro', tier === 'pro');
  }
  const banner = document.getElementById('upgrade-banner');
  if (banner) banner.hidden = tier === 'pro';
  document.querySelectorAll<HTMLElement>('.wsm-pro').forEach((el) => {
    el.classList.toggle('wsm-locked', tier === 'free');
  });
}

function renderSettingsUI(settings: Settings) {
  const enabled = document.getElementById('enabled') as HTMLInputElement | null;
  if (enabled) enabled.checked = settings.enabled;
  document.querySelectorAll<HTMLButtonElement>('[data-side]').forEach((b) => {
    b.setAttribute('aria-pressed', b.dataset.side === settings.side ? 'true' : 'false');
  });
  document.querySelectorAll<HTMLButtonElement>('[data-margin]').forEach((b) => {
    b.setAttribute('aria-pressed', String(Number(b.dataset.margin)) === String(settings.marginPx) ? 'true' : 'false');
  });
  document.querySelectorAll<HTMLButtonElement>('[data-barwidth]').forEach((b) => {
    b.setAttribute('aria-pressed', String(Number(b.dataset.barwidth)) === String(settings.barWidthPx) ? 'true' : 'false');
  });
  document.querySelectorAll<HTMLButtonElement>('[data-opacity]').forEach((b) => {
    b.setAttribute('aria-pressed', String(Number(b.dataset.opacity)) === String(settings.floatingOpacity) ? 'true' : 'false');
  });
  document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) => {
    b.setAttribute('aria-pressed', b.dataset.filter === settings.smartFilter ? 'true' : 'false');
  });
  document.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((b) => {
    b.setAttribute('aria-pressed', b.dataset.theme === settings.theme ? 'true' : 'false');
    const color = b.dataset.color;
    if (color) b.style.setProperty('--color', color);
    b.style.color = color ?? '#f97316';
  });
}

function renderStatus(status: PageStatus | null) {
  const el = document.getElementById('status');
  if (!el) return;
  if (!status) {
    el.textContent = 'content script 미주입 (새로고침 필요)';
    return;
  }
  if (!status.activatable) {
    el.textContent = '이 페이지는 너무 짧아 비활성';
    return;
  }
  const kind = status.containerKind === 'element' ? ' · 내부 스크롤' : '';
  el.textContent = `${status.anchorCount} anchors · ${status.pinCount} pins${kind}`;
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

async function init() {
  applyI18n(document);
  let settings = await fetchSettings();
  let { tier } = await fetchEntitlement();
  const status = await fetchStatus();
  applyTierUI(tier);
  renderSettingsUI(settings);
  renderStatus(status);

  async function refreshPins() {
    const pins = await fetchPins();
    renderPins(pins, refreshPins);
  }
  if (tier === 'pro') await refreshPins();

  // enabled 토글
  document.getElementById('enabled')?.addEventListener('change', async (e) => {
    const checked = (e.target as HTMLInputElement).checked;
    const next = await saveSettings({ enabled: checked });
    if (next) { settings = next; renderSettingsUI(settings); }
  });

  // side
  document.querySelectorAll<HTMLButtonElement>('[data-side]').forEach((b) =>
    b.addEventListener('click', async () => {
      const side = b.dataset.side === 'left' ? 'left' : 'right';
      const next = await saveSettings({ side });
      if (next) { settings = next; renderSettingsUI(settings); }
    }),
  );

  // margin
  document.querySelectorAll<HTMLButtonElement>('[data-margin]').forEach((b) =>
    b.addEventListener('click', async () => {
      const raw = Number(b.dataset.margin);
      const m = ([0, 8, 16, 24, 32] as const).includes(raw as 0) ? (raw as 0 | 8 | 16 | 24 | 32) : 16;
      const next = await saveSettings({ marginPx: m });
      if (next) { settings = next; renderSettingsUI(settings); }
    }),
  );

  // bar width
  document.querySelectorAll<HTMLButtonElement>('[data-barwidth]').forEach((b) =>
    b.addEventListener('click', async () => {
      const raw = Number(b.dataset.barwidth);
      const w = ([3, 6, 12] as const).includes(raw as 3) ? (raw as 3 | 6 | 12) : 6;
      const next = await saveSettings({ barWidthPx: w });
      if (next) { settings = next; renderSettingsUI(settings); }
    }),
  );

  // opacity
  document.querySelectorAll<HTMLButtonElement>('[data-opacity]').forEach((b) =>
    b.addEventListener('click', async () => {
      const raw = Number(b.dataset.opacity);
      const v = (raw === 40 || raw === 70 ? raw : 100) as 40 | 70 | 100;
      const next = await saveSettings({ floatingOpacity: v });
      if (next) { settings = next; renderSettingsUI(settings); }
    }),
  );

  // smart filter
  document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) =>
    b.addEventListener('click', async () => {
      const f = (['all', 'headings', 'media'] as const).includes(b.dataset.filter as 'all') ? (b.dataset.filter as 'all' | 'headings' | 'media') : 'all';
      const next = await saveSettings({ smartFilter: f });
      if (next) { settings = next; renderSettingsUI(settings); }
    }),
  );

  // theme
  document.querySelectorAll<HTMLButtonElement>('[data-theme]').forEach((b) =>
    b.addEventListener('click', async () => {
      const t = b.dataset.theme as 'default' | 'sunset' | 'ocean' | 'forest' | 'mono';
      const next = await saveSettings({ theme: t });
      if (next) { settings = next; renderSettingsUI(settings); }
    }),
  );

  // Upgrade
  document.getElementById('upgrade-btn')?.addEventListener('click', async () => {
    const newTier = await purchasePro();
    tier = newTier;
    applyTierUI(tier);
    if (tier === 'pro') await refreshPins();
  });

  // Restore
  document.getElementById('restore-btn')?.addEventListener('click', async () => {
    const newTier = await restorePurchases();
    tier = newTier;
    applyTierUI(tier);
    if (tier === 'pro') await refreshPins();
  });

  // Clear pins/trail
  document.getElementById('clear-pins')?.addEventListener('click', async () => {
    try {
      await api.runtime.sendMessage({ type: 'clear-pins' });
      await refreshPins();
    } catch {}
  });
  document.getElementById('clear-trail')?.addEventListener('click', async () => {
    try {
      await api.runtime.sendMessage({ type: 'clear-trail' });
    } catch {}
  });
}

void init();
