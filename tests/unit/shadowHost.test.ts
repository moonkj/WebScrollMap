import { describe, expect, it, beforeEach } from 'vitest';
import { mountShadowHost } from '@ui/shadowHost';

describe('mountShadowHost', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('creates a host with randomized tag name prefixed wsm-root-', () => {
    const { host, unmount } = mountShadowHost(document, 2147483000, () => 0.5);
    expect(host.tagName.toLowerCase()).toMatch(/^wsm-root-[a-z0-9]+$/);
    unmount();
  });

  it('different random values yield different tag names', () => {
    const a = mountShadowHost(document, 1, () => 0.1);
    const b = mountShadowHost(document, 1, () => 0.9);
    expect(a.host.tagName).not.toBe(b.host.tagName);
    a.unmount();
    b.unmount();
  });

  it('sets data-wsm attribute on host', () => {
    const { host, unmount } = mountShadowHost(document, 100, () => 0);
    expect(host.getAttribute('data-wsm')).toBe('1');
    unmount();
  });

  it('applies important inline styles with specified zIndex', () => {
    const { host, unmount } = mountShadowHost(document, 9999, () => 0);
    const css = host.style.cssText;
    expect(css).toContain('position:');
    expect(css).toContain('fixed');
    expect(css).toContain('44px');
    expect(css).toContain('9999');
    expect(css).toContain('touch-action');
    expect(css).toContain('pointer-events');
    unmount();
  });

  it('attaches open shadow root', () => {
    const { host, root, unmount } = mountShadowHost(document, 1, () => 0);
    expect(host.shadowRoot).toBe(root);
    expect(root).toBeTruthy();
    unmount();
  });

  it('inserts a <style> child inside shadow root', () => {
    const { root, unmount } = mountShadowHost(document, 1, () => 0);
    const style = root.querySelector('style');
    expect(style).toBeTruthy();
    expect(style!.textContent).toContain('.wsm-track');
    expect(style!.textContent).toContain('.wsm-section-badge');
    unmount();
  });

  it('appends host to document.body', () => {
    const { host, unmount } = mountShadowHost(document, 1, () => 0);
    expect(host.parentNode).toBe(document.body);
    unmount();
  });

  it('falls back to documentElement when body is missing', () => {
    const doc = document.implementation.createHTMLDocument('t');
    // remove body to simulate
    const body = doc.body;
    if (body) body.remove();
    const { host, unmount } = mountShadowHost(doc, 5, () => 0);
    const parent = host.parentNode;
    // Either body (if recreated) or documentElement is acceptable
    expect(parent === doc.body || parent === doc.documentElement).toBe(true);
    unmount();
  });

  it('unmount() removes host from DOM', () => {
    const { host, unmount } = mountShadowHost(document, 1, () => 0);
    expect(host.isConnected).toBe(true);
    unmount();
    expect(host.isConnected).toBe(false);
  });

  it('uses default random=Math.random when omitted', () => {
    const { host, unmount } = mountShadowHost(document, 1);
    expect(host.tagName.toLowerCase()).toMatch(/^wsm-root-/);
    unmount();
  });

  it('style contains media query for prefers-reduced-motion', () => {
    const { root, unmount } = mountShadowHost(document, 1, () => 0);
    const style = root.querySelector('style');
    expect(style!.textContent).toContain('prefers-reduced-motion');
    unmount();
  });

  it('supports multiple independent mounts', () => {
    const a = mountShadowHost(document, 1, () => 0.1);
    const b = mountShadowHost(document, 2, () => 0.2);
    expect(document.body.children.length).toBeGreaterThanOrEqual(2);
    a.unmount();
    b.unmount();
  });
});
